"""One-time email codes: create, send (through Brevo, or the console in development) and check."""

import json
import logging
import math
import secrets
import urllib.error
import urllib.request
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.utils import timezone

from .models import EmailOTP

log = logging.getLogger(__name__)

OTP_TTL = timedelta(minutes=10)      # how long a code works
RESEND_COOLDOWN = timedelta(seconds=60)  # how soon a new code may be requested
MAX_ATTEMPTS = 5                     # wrong guesses before a code is burnt

SUBJECTS = {
    EmailOTP.Purpose.REGISTRATION: "Your CareerBridge verification code",
    EmailOTP.Purpose.PASSWORD_RESET: "Your CareerBridge password reset code",
}
INTROS = {
    EmailOTP.Purpose.REGISTRATION: "Use this code to finish creating your CareerBridge account.",
    EmailOTP.Purpose.PASSWORD_RESET: "Use this code to reset your CareerBridge password. If you didn't ask for this, you can ignore this email.",
}


class OTPError(Exception):
    """A problem to show the user as-is."""


class OTPSendError(OTPError):
    """The email could not be sent."""


def _latest(email, purpose):
    return EmailOTP.objects.filter(email__iexact=email, purpose=purpose, used=False).first()


def seconds_until_resend(email, purpose):
    otp = _latest(email, purpose)
    if not otp:
        return 0
    wait = (otp.created_at + RESEND_COOLDOWN - timezone.now()).total_seconds()
    return math.ceil(wait) if wait > 0 else 0


def issue_otp(email, purpose):
    """Burn any earlier unused code for this email and purpose, make a new one and email it."""
    wait = seconds_until_resend(email, purpose)
    if wait:
        raise OTPError(f"Please wait {wait} seconds before asking for another code.")

    code = f"{secrets.randbelow(1_000_000):06d}"
    EmailOTP.objects.filter(email__iexact=email, purpose=purpose, used=False).update(used=True)
    otp = EmailOTP.objects.create(email=email.lower(), purpose=purpose, code_hash=make_password(code))
    try:
        _send(email, purpose, code)
    except OTPSendError:
        otp.delete()  # so the cooldown doesn't block an immediate retry
        raise


def consume_otp(email, purpose, code, *, keep=False):
    """
    Check a code. On success it is marked used, so it works once — unless keep=True, which only checks it
    (the password reset checks the code on one screen, then uses it with the new password on the next).
    Wrong guesses count either way. Raises OTPError on any problem.
    """
    otp = _latest(email, purpose)
    if not otp or otp.created_at < timezone.now() - OTP_TTL:
        raise OTPError("This code has expired. Ask for a new one.")
    if otp.attempts >= MAX_ATTEMPTS:
        raise OTPError("Too many wrong attempts. Ask for a new code.")
    if not check_password((code or "").strip(), otp.code_hash):
        otp.attempts += 1
        otp.save(update_fields=["attempts"])
        left = MAX_ATTEMPTS - otp.attempts
        raise OTPError(f"That code isn't right. {left} attempt{'s' if left != 1 else ''} left." if left else "Too many wrong attempts. Ask for a new code.")
    if keep:
        return
    otp.used = True
    otp.save(update_fields=["used"])


# ── sending ──────────────────────────────────────────────────────────────

def _html(purpose, code):
    return f"""\
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1d1b2e">
  <p style="font-size:20px;font-weight:bold;margin:0 0 24px">CareerBridge</p>
  <p style="font-size:15px;line-height:1.5;margin:0 0 24px">{INTROS[purpose]}</p>
  <p style="font-size:34px;font-weight:bold;letter-spacing:10px;margin:0 0 24px;padding:18px 0;text-align:center;background:#f2f0fa;border-radius:12px">{code}</p>
  <p style="font-size:13px;color:#6b6880;margin:0">This code expires in {int(OTP_TTL.total_seconds() // 60)} minutes. Never share it with anyone.</p>
</div>"""


def _text(purpose, code):
    return f"{INTROS[purpose]}\n\nYour code: {code}\n\nIt expires in {int(OTP_TTL.total_seconds() // 60)} minutes. Never share it with anyone."


def _send(email, purpose, code):
    # Always visible in the server log while developing, so a demo works even without email.
    if settings.DEBUG:
        print(f"[OTP] {purpose} code for {email}: {code}", flush=True)

    subject, html, text = SUBJECTS[purpose], _html(purpose, code), _text(purpose, code)
    try:
        if settings.BREVO_API_KEY:
            _send_brevo_api(email, subject, html, text)
        else:
            send_mail(subject, text, settings.DEFAULT_FROM_EMAIL, [email], html_message=html)
    except Exception:
        log.exception("Could not send OTP email to %s", email)
        raise OTPSendError("We couldn't send the email right now. Please try again in a minute.")


def _send_brevo_api(email, subject, html, text):
    """Brevo's HTTPS API: works on hosts that block outgoing SMTP ports (e.g. Render's free tier)."""
    from email.utils import parseaddr

    name, address = parseaddr(settings.DEFAULT_FROM_EMAIL)
    body = {
        "sender": {"name": name or "CareerBridge", "email": address},
        "to": [{"email": email}],
        "subject": subject,
        "htmlContent": html,
        "textContent": text,
    }
    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(body).encode(),
        headers={"api-key": settings.BREVO_API_KEY, "content-type": "application/json", "accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            res.read()
    except urllib.error.HTTPError as e:
        # Brevo explains itself in the body (bad key, unverified sender, blocked IP, missing permission…)
        raise RuntimeError(f"Brevo API {e.code}: {e.read().decode(errors='replace')}") from None
