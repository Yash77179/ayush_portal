"""URL patterns for the accounts app."""

from django.urls import path
from .views import (
    ProfileView,
    RegisterView,
    complete_profile,
    google_auth,
    me_view,
    password_reset_confirm,
    password_reset_send_otp,
    password_reset_verify_otp,
    register_send_otp,
)

urlpatterns = [
    path("register/send-otp/", register_send_otp, name="register-send-otp"),
    path("register/", RegisterView.as_view(), name="register"),
    path("password-reset/send-otp/", password_reset_send_otp, name="password-reset-send-otp"),
    path("password-reset/verify-otp/", password_reset_verify_otp, name="password-reset-verify-otp"),
    path("password-reset/confirm/", password_reset_confirm, name="password-reset-confirm"),
    path("google/", google_auth, name="google-auth"),
    path("complete-profile/", complete_profile, name="complete-profile"),
    path("profile/", ProfileView.as_view(), name="profile"),
    path("me/", me_view, name="me"),
]
