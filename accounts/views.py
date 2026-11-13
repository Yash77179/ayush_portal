"""Views for accounts app — registration (with an emailed code), password reset, profile."""

import re

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import generics, permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from .google import GoogleAuthError, google_identity
from .models import EmailOTP
from .otp import OTP_TTL, RESEND_COOLDOWN, OTPError, OTPSendError, consume_otp, issue_otp
from .serializers import (
    CompleteProfileSerializer,
    PasswordResetConfirmSerializer,
    UserRegistrationSerializer,
    UserSerializer,
    UserProfileUpdateSerializer,
)

User = get_user_model()


class OTPThrottle(AnonRateThrottle):
    """Caps code requests and guesses per IP, on top of the per-code limits."""
    rate = "30/hour"


def _send_code(email, purpose):
    """Email a code and answer the frontend; a cooldown is a 429, a failed send a 503."""
    try:
        issue_otp(email, purpose)
    except OTPSendError as e:
        return Response({"detail": str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except OTPError as e:
        return Response({"detail": str(e)}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    return _otp_sent(email)


def _otp_sent(email):
    return Response(
        {
            "message": f"We sent a 6-digit code to {email}.",
            "expires_in": int(OTP_TTL.total_seconds()),
            "resend_in": int(RESEND_COOLDOWN.total_seconds()),
        }
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
@throttle_classes([OTPThrottle])
def register_send_otp(request):
    """Step 1 of sign-up: check the whole form, then email a code. Nothing is saved yet."""
    serializer = UserRegistrationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return _send_code(serializer.validated_data["email"], EmailOTP.Purpose.REGISTRATION)


class RegisterView(generics.CreateAPIView):
    """Step 2 of sign-up: the same form plus the emailed code. The account is created only if the code is right."""
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [OTPThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            consume_otp(serializer.validated_data["email"], EmailOTP.Purpose.REGISTRATION, request.data.get("otp"))
        except OTPError as e:
            raise serializers.ValidationError({"otp": [str(e)]})
        user = serializer.save()
        return Response(
            {"message": "Account created successfully.", "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
@throttle_classes([OTPThrottle])
def password_reset_send_otp(request):
    """Email a reset code. Answers the same whether or not the email has an account, so it can't be used to look accounts up."""
    try:
        email = serializers.EmailField().run_validation(request.data.get("email"))
    except serializers.ValidationError as e:
        raise serializers.ValidationError({"email": e.detail})
    email = email.strip().lower()
    if User.objects.filter(email__iexact=email, is_active=True).exists():
        return _send_code(email, EmailOTP.Purpose.PASSWORD_RESET)
    return _otp_sent(email)


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
@throttle_classes([OTPThrottle])
def password_reset_verify_otp(request):
    """Check a reset code without using it up, so the next screen can ask for the new password."""
    email = (request.data.get("email") or "").strip().lower()
    try:
        consume_otp(email, EmailOTP.Purpose.PASSWORD_RESET, request.data.get("otp"), keep=True)
    except OTPError as e:
        raise serializers.ValidationError({"otp": [str(e)]})
    return Response({"message": "Code verified."})


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
@throttle_classes([OTPThrottle])
def password_reset_confirm(request):
    """The emailed code and a new password: sets it on the account with that email."""
    serializer = PasswordResetConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    try:
        consume_otp(data["email"], EmailOTP.Purpose.PASSWORD_RESET, data["otp"])
    except OTPError as e:
        raise serializers.ValidationError({"otp": [str(e)]})
    with transaction.atomic():
        users = list(User.objects.filter(email__iexact=data["email"], is_active=True))
        for user in users:
            user.set_password(data["password"])
            user.save(update_fields=["password"])
    if not users:
        raise serializers.ValidationError({"otp": ["This code has expired. Ask for a new one."]})
    return Response({"message": "Password updated. You can sign in now.", "username": users[0].username})


def _unique_username(email):
    base = re.sub(r"[^\w.@+-]", "", email.split("@")[0])[:140] or "user"
    name, n = base, 1
    while User.objects.filter(username__iexact=name).exists():
        n += 1
        name = f"{base}{n}"
    return name


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
@throttle_classes([OTPThrottle])
def google_auth(request):
    """
    Sign in (or sign up) with Google. The frontend sends the access token from Google's popup; we check it with
    Google, then sign in the account with that email — creating one on first use (with the role chosen on the
    sign-up page, student by default). Answers with our own JWT pair, like /api/token/.
    """
    try:
        who = google_identity(request.data.get("access_token"))
    except GoogleAuthError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(email__iexact=who["email"]).order_by("id").first()
    created = False
    if user is None:
        role = request.data.get("role")
        if role not in (User.Role.STUDENT, User.Role.COMPANY, User.Role.UNIVERSITY):
            role = User.Role.STUDENT
        user = User(username=_unique_username(who["email"]), email=who["email"], first_name=who["first_name"], last_name=who["last_name"], role=role)
        user.set_unusable_password()  # they can set one later with "Forgot password?"
        user.profile_completed = False  # role, gender, name and username are picked on /complete-profile
        user.save()
        created = True
    elif not user.is_active:
        return Response({"detail": "This account has been deactivated."}, status=status.HTTP_403_FORBIDDEN)

    refresh = RefreshToken.for_user(user)
    return Response({"access": str(refresh.access_token), "refresh": str(refresh), "created": created, "user": UserSerializer(user).data})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def complete_profile(request):
    """The one-time "finish your profile" step for Google sign-ups: role, gender, name and username."""
    if request.user.profile_completed:
        return Response({"detail": "Your profile is already complete."}, status=status.HTTP_400_BAD_REQUEST)
    serializer = CompleteProfileSerializer(request.user, data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return Response(UserSerializer(user).data)


class ProfileView(generics.RetrieveUpdateAPIView):
    """Get or update the authenticated user's own profile."""
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return UserProfileUpdateSerializer
        return UserSerializer


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def me_view(request):
    """Quick endpoint for the frontend to confirm auth status and get user data."""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)
