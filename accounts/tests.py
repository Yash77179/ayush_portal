import re
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import EmailOTP

User = get_user_model()

FORM = {
    "username": "arjun",
    "email": "Arjun@Example.com",
    "first_name": "Arjun",
    "last_name": "Sharma",
    "role": "student",
    "password": "Str0ng-pass-99",
    "password2": "Str0ng-pass-99",
}


def code_from_mail():
    return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)


@override_settings(BREVO_API_KEY="", DEBUG=False)
class OTPFlowTests(APITestCase):
    def setUp(self):
        cache.clear()  # throttle counters

    # ── registration ──
    def test_register_needs_the_emailed_code(self):
        r = self.client.post("/api/accounts/register/send-otp/", FORM, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(User.objects.count(), 0)  # nothing saved before the code

        r = self.client.post("/api/accounts/register/", {**FORM, "otp": "000000" if code_from_mail() != "000000" else "111111"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("otp", r.data)

        r = self.client.post("/api/accounts/register/", {**FORM, "otp": code_from_mail()}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(User.objects.get().email, "arjun@example.com")

        # the code works once
        r = self.client.post("/api/accounts/register/", {**FORM, "username": "arjun2", "otp": code_from_mail()}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_register_rejects_bad_form_before_sending(self):
        User.objects.create_user("x", "arjun@example.com", "whatever-123")
        r = self.client.post("/api/accounts/register/send-otp/", FORM, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("email", r.data)
        r = self.client.post("/api/accounts/register/send-otp/", {**FORM, "email": "new@example.com", "password": "12345678", "password2": "12345678"}, format="json")
        self.assertIn("password", r.data)
        self.assertEqual(len(mail.outbox), 0)

    def test_resend_cooldown_and_attempt_limit(self):
        self.client.post("/api/accounts/register/send-otp/", FORM, format="json")
        r = self.client.post("/api/accounts/register/send-otp/", FORM, format="json")
        self.assertEqual(r.status_code, 429)

        good = code_from_mail()
        bad = "000000" if good != "000000" else "111111"
        for _ in range(5):
            self.client.post("/api/accounts/register/", {**FORM, "otp": bad}, format="json")
        r = self.client.post("/api/accounts/register/", {**FORM, "otp": good}, format="json")
        self.assertEqual(r.status_code, 400)  # burnt after 5 wrong tries

    def test_expired_code(self):
        self.client.post("/api/accounts/register/send-otp/", FORM, format="json")
        EmailOTP.objects.update(created_at=EmailOTP.objects.get().created_at - timedelta(minutes=11))
        r = self.client.post("/api/accounts/register/", {**FORM, "otp": code_from_mail()}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("expired", str(r.data["otp"]))

    # ── password reset ──
    def test_password_reset(self):
        User.objects.create_user("arjun", "arjun@example.com", "old-pass-123")
        r = self.client.post("/api/accounts/password-reset/send-otp/", {"email": "ARJUN@example.com"}, format="json")
        self.assertEqual(r.status_code, 200)
        r = self.client.post("/api/accounts/password-reset/verify-otp/", {"email": "arjun@example.com", "otp": "abc"}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/accounts/password-reset/verify-otp/", {"email": "arjun@example.com", "otp": code_from_mail()}, format="json")
        self.assertEqual(r.status_code, 200)  # checked, not used up
        body = {"email": "arjun@example.com", "otp": code_from_mail(), "password": "N3w-pass-456", "password2": "N3w-pass-456"}
        r = self.client.post("/api/accounts/password-reset/confirm/", body, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["username"], "arjun")
        self.assertTrue(User.objects.get().check_password("N3w-pass-456"))
        r = self.client.post("/api/accounts/password-reset/confirm/", body, format="json")
        self.assertEqual(r.status_code, 400)  # used once

    def test_password_reset_does_not_reveal_unknown_emails(self):
        r = self.client.post("/api/accounts/password-reset/send-otp/", {"email": "nobody@example.com"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)


CLIENT = "test-client.apps.googleusercontent.com"


def fake_google(email="new.person@gmail.com", aud=CLIENT, verified="true"):
    def _get_json(url, headers=None):
        if "tokeninfo" in url:
            return {"aud": aud, "azp": aud, "email": email, "email_verified": verified}
        return {"given_name": "New", "family_name": "Person"}
    return _get_json


@override_settings(GOOGLE_CLIENT_ID=CLIENT)
class GoogleAuthTests(APITestCase):
    def setUp(self):
        cache.clear()

    def post(self, fake, **body):
        from unittest import mock
        with mock.patch("accounts.google._get_json", fake):
            return self.client.post("/api/accounts/google/", {"access_token": "t", **body}, format="json")

    def test_first_google_sign_in_creates_the_account(self):
        r = self.post(fake_google(), role="company")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(r.data["created"])
        self.assertIn("access", r.data)
        u = User.objects.get()
        self.assertEqual((u.username, u.role, u.first_name), ("new.person", "company", "New"))
        self.assertFalse(u.has_usable_password())

    def test_existing_email_signs_into_that_account(self):
        User.objects.create_user("new.person", "New.Person@gmail.com", "pw-123456x", role="university")
        r = self.post(fake_google(), role="student")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data["created"])
        self.assertEqual(r.data["user"]["role"], "university")
        self.assertEqual(User.objects.count(), 1)

    def test_token_for_another_app_is_rejected(self):
        r = self.post(fake_google(aud="someone-else"))
        self.assertEqual(r.status_code, 400)
        self.assertEqual(User.objects.count(), 0)

    def test_unverified_email_is_rejected(self):
        r = self.post(fake_google(verified="false"))
        self.assertEqual(r.status_code, 400)

    def test_admin_role_cannot_be_chosen(self):
        self.post(fake_google(), role="admin")
        self.assertEqual(User.objects.get().role, "student")


class CompleteProfileTests(APITestCase):
    def setUp(self):
        cache.clear()

    @override_settings(GOOGLE_CLIENT_ID=CLIENT)
    def test_google_sign_up_must_finish_profile_once(self):
        from unittest import mock
        with mock.patch("accounts.google._get_json", fake_google()):
            r = self.client.post("/api/accounts/google/", {"access_token": "t"}, format="json")
        self.assertFalse(r.data["user"]["profile_completed"])
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + r.data["access"])

        r = self.client.post("/api/accounts/complete-profile/", {"role": "student"}, format="json")
        self.assertEqual(r.status_code, 400)
        for f in ("gender", "first_name", "last_name", "username"):
            self.assertIn(f, r.data)

        User.objects.create_user("taken", "t@example.com", "pw-123456x")
        body = {"role": "university", "gender": "female", "first_name": "Riya", "last_name": "K", "username": "TAKEN"}
        r = self.client.post("/api/accounts/complete-profile/", body, format="json")
        self.assertIn("username", r.data)

        r = self.client.post("/api/accounts/complete-profile/", {**body, "username": "riya_k"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(r.data["profile_completed"])
        self.assertEqual((r.data["role"], r.data["email"]), ("university", "new.person@gmail.com"))

        r = self.client.post("/api/accounts/complete-profile/", {**body, "role": "company"}, format="json")
        self.assertEqual(r.status_code, 400)  # only once — the role can't be switched later

    def test_admin_role_not_allowed(self):
        u = User.objects.create_user("g", "g@example.com", None, profile_completed=False)
        self.client.force_authenticate(u)
        r = self.client.post("/api/accounts/complete-profile/", {"role": "admin", "gender": "male", "first_name": "a", "last_name": "b", "username": "g"}, format="json")
        self.assertIn("role", r.data)
