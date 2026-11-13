"""Google sign-in: check an access token from Google's popup and read who it belongs to."""

import json
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings


class GoogleAuthError(Exception):
    """A problem to show the user as-is."""


def _get_json(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            return json.loads(res.read().decode())
    except urllib.error.HTTPError:
        raise GoogleAuthError("Google sign-in expired or was cancelled. Please try again.") from None
    except (urllib.error.URLError, TimeoutError, ValueError):
        raise GoogleAuthError("Couldn't reach Google. Please try again.") from None


def google_identity(access_token):
    """
    Returns {"email", "first_name", "last_name"} for a Google access token — but only if the token was issued
    to *this* app (its audience is our client ID; otherwise any site's token could sign people in here)
    and Google has verified the email.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleAuthError("Google sign-in isn't set up on the server yet.")
    if not access_token:
        raise GoogleAuthError("Google sign-in was cancelled.")

    info = _get_json("https://oauth2.googleapis.com/tokeninfo?" + urllib.parse.urlencode({"access_token": access_token}))
    if settings.GOOGLE_CLIENT_ID not in (info.get("aud"), info.get("azp")):
        raise GoogleAuthError("This Google sign-in wasn't made for CareerBridge.")
    if str(info.get("email_verified")).lower() != "true" or not info.get("email"):
        raise GoogleAuthError("Your Google account's email isn't verified.")

    profile = _get_json("https://www.googleapis.com/oauth2/v3/userinfo", {"Authorization": f"Bearer {access_token}"})
    return {
        "email": info["email"].strip().lower(),
        "first_name": (profile.get("given_name") or "")[:150],
        "last_name": (profile.get("family_name") or "")[:150],
    }
