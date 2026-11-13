"""
The languages and voices Bridge can speak, straight from Speechify's catalogue.

GET /api/assistant/voices/  ->  {"model": "simba-3.5", "languages": [{"code": "hi-IN", "voices": [...]}, ...]}

Only voices that support our model (settings.SPEECHIFY_MODEL) are listed, grouped by the locale they speak,
Speechify's staff picks first. The catalogue is fetched page by page and cached, so it costs one call a day.
"""

import json
import logging
import re
import urllib.parse
import urllib.request
from collections import defaultdict

from django.conf import settings
from django.core.cache import cache
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

log = logging.getLogger(__name__)

VOICES_URL = "https://api.sws.speechify.com/v1/voices"
CACHE_KEY = "speechify:catalog:v2"
CACHE_S = 60 * 60 * 24
LOCALE_RE = re.compile(r"^[a-z]{2,3}-[A-Z]{2}$")


def _fetch_all(key):
    voices, cursor = [], None
    for _ in range(30):  # ~1,100 voices at 200 a page: a handful of pages
        query = {"limit": "200", **({"cursor": cursor} if cursor else {})}
        req = urllib.request.Request(f"{VOICES_URL}?{urllib.parse.urlencode(query)}", headers={"Authorization": f"Bearer {key}"})
        with urllib.request.urlopen(req, timeout=15) as res:
            page = json.load(res)
        if isinstance(page, list):  # an older, unpaged answer
            return page
        voices += page.get("voices", [])
        cursor = page.get("next_cursor")
        if not page.get("has_more") or not cursor:
            break
    return voices


def catalog():
    """{locale: [voice, ...]} for our model — cached; empty if Speechify can't be reached (nothing is invented)."""
    found = cache.get(CACHE_KEY)
    if found is not None:
        return found
    key = getattr(settings, "SPEECHIFY_API_KEY", "")
    if not key:
        return {}
    model = getattr(settings, "SPEECHIFY_MODEL", "simba-3.5")
    try:
        raw = _fetch_all(key)
    except Exception as e:  # noqa: BLE001 - try again soon rather than caching a failure for a day
        log.warning("Speechify voice list unavailable: %s", e)
        return {}
    by_locale = defaultdict(list)
    for v in raw:
        for m in v.get("models", []):
            if m.get("name") != model:
                continue
            for lang in m.get("languages", []):
                locale = lang.get("locale", "")
                if not LOCALE_RE.match(locale):
                    continue
                by_locale[locale].append({
                    "id": v["id"],
                    "name": v.get("display_name") or v["id"],
                    "gender": v.get("gender") if v.get("gender") in ("male", "female") else "female",
                    "preview": lang.get("preview_audio") or v.get("preview_audio") or "",
                    "rank": v.get("staff_pick_rank") if isinstance(v.get("staff_pick_rank"), int) else 10_000,
                    "tags": [t.split(":", 1)[1].replace("-", " ") for t in v.get("tags", []) if t.split(":", 1)[0] in ("age", "timbre", "style", "accent")][:3],
                })
    for voices in by_locale.values():
        voices.sort(key=lambda v: (v["rank"], v["name"]))
        for v in voices:
            del v["rank"]
    found = dict(by_locale)
    cache.set(CACHE_KEY, found, CACHE_S)
    return found


def supports(locale, voice_id):
    """Is this a voice Speechify lists for this locale on our model?"""
    return any(v["id"] == voice_id for v in catalog().get(locale, []))


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def voices(request):
    found = catalog()
    languages = [{"code": code, "voices": found[code]} for code in sorted(found)]
    res = Response({"model": getattr(settings, "SPEECHIFY_MODEL", "simba-3.5"), "languages": languages})
    if languages:
        res["Cache-Control"] = "public, max-age=3600"
    return res
