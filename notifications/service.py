"""notify() — the one way the rest of the app tells someone something happened (in-app, and by email if asked).

Email never blocks or breaks the action that caused it: failures are logged and swallowed.
"""

import base64
import json
import logging
import urllib.error
import urllib.request

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils.html import escape

from .models import Notification

log = logging.getLogger(__name__)


def notify(users, kind, title, body="", link="", *, email=False, email_subject=None, email_body=None, attachments=None):
    """Create a notification for each user (a User or an iterable of them). Returns the created notifications."""
    if users is None:
        return []
    if not isinstance(users, (list, tuple, set)) and not hasattr(users, "__iter__"):
        users = [users]
    created = []
    for user in {u.pk: u for u in users if u is not None}.values():
        created.append(Notification.objects.create(user=user, kind=kind, title=title[:200], body=body[:500], link=link[:300]))
        if email and user.email:
            send_email(user.email, email_subject or title, email_body or (body or title), attachments=attachments)
    return created


def _html(text):
    paragraphs = "".join(f"<p style='margin:0 0 14px'>{escape(p).replace(chr(10), '<br>')}</p>" for p in text.split("\n\n"))
    return (
        "<div style='font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;"
        "max-width:560px;margin:0 auto;padding:24px'>"
        f"{paragraphs}<p style='margin-top:28px;color:#888;font-size:12px'>Sent by CareerBridge</p></div>"
    )


def send_email(to, subject, text, *, attachments=None):
    """Send a plain email (Brevo API when configured, else Django's mail backend). `attachments`: [(name, bytes, mime)]."""
    attachments = attachments or []
    if settings.DEBUG:
        print(f"[email] to={to} subject={subject!r}", flush=True)
    try:
        if getattr(settings, "BREVO_API_KEY", ""):
            _send_brevo(to, subject, text, attachments)
        else:
            msg = EmailMultiAlternatives(subject, text, settings.DEFAULT_FROM_EMAIL, [to])
            msg.attach_alternative(_html(text), "text/html")
            for name, content, mime in attachments:
                msg.attach(name, content, mime)
            msg.send()
        return True
    except Exception:
        log.exception("Could not send email to %s", to)
        return False


def _send_brevo(to, subject, text, attachments):
    from email.utils import parseaddr

    name, address = parseaddr(settings.DEFAULT_FROM_EMAIL)
    body = {
        "sender": {"name": name or "CareerBridge", "email": address},
        "to": [{"email": to}],
        "subject": subject,
        "htmlContent": _html(text),
        "textContent": text,
    }
    if attachments:
        body["attachment"] = [{"name": n, "content": base64.b64encode(c).decode()} for n, c, _ in attachments]
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
        raise RuntimeError(f"Brevo API {e.code}: {e.read().decode(errors='replace')}") from None
