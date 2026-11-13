"""Serializers for accounts app."""

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

User = get_user_model()


def _check_password(password, user=None):
    """Django's password rules (too short, too common, all digits, too like the username), reported on the password field."""
    try:
        validate_password(password, user=user)
    except DjangoValidationError as e:
        raise serializers.ValidationError({"password": list(e.messages)})


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "role", "gender", "phone", "password", "password2",
        ]
        extra_kwargs = {"email": {"required": True, "allow_blank": False}}

    def validate_email(self, value):
        value = value.strip().lower()
        if not value:
            raise serializers.ValidationError("Email is required.")
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password2"):
            raise serializers.ValidationError({"password": "Passwords do not match."})
        _check_password(attrs["password"], User(username=attrs.get("username"), email=attrs.get("email")))
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6)
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        _check_password(attrs["password"])
        return attrs


class CompleteProfileSerializer(serializers.ModelSerializer):
    """The details a Google sign-up didn't give us. The email came from Google and can't be changed here."""

    role = serializers.ChoiceField(choices=[User.Role.STUDENT, User.Role.COMPANY, User.Role.UNIVERSITY])
    gender = serializers.ChoiceField(choices=User.Gender.choices)

    class Meta:
        model = User
        fields = ["role", "gender", "first_name", "last_name", "username"]
        extra_kwargs = {
            "first_name": {"required": True, "allow_blank": False},
            "last_name": {"required": True, "allow_blank": False},
            "username": {"required": True},
        }

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("That username is taken.")
        return value

    def update(self, instance, validated_data):
        validated_data["profile_completed"] = True
        return super().update(instance, validated_data)


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "full_name", "role", "gender", "phone", "profile_photo",
            "is_active", "profile_completed", "created_at",
        ]
        read_only_fields = ["id", "created_at", "profile_completed"]

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "gender", "phone", "profile_photo"]

    def validate_email(self, value):
        value = value.strip().lower()
        if value and User.objects.filter(email__iexact=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("Another account already uses this email.")
        return value

    def validate_profile_photo(self, value):
        if value and value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Photo must be 5 MB or smaller.")
        return value
