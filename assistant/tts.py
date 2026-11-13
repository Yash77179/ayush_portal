"""
Bridge's voice: natural text-to-speech for spoken answers.

GET /api/assistant/tts/?text=...&lang=hi-IN&voice=aadi&gender=male  ->  audio/mpeg (streamed)

Tried in order, quickly, so a slow or exhausted service never holds the conversation up:
  1. Speechify (model simba-3.5) with the chosen voice — streamed, so audio starts playing while it's still being made
  2. Microsoft Edge's neural voices (the `edge-tts` package; free, no key) — same language, same gender
The browser uses its own built-in voice if neither can answer.
"""

import asyncio
import hashlib
import json
import logging
import queue
import threading
import urllib.error
import urllib.request

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse, StreamingHttpResponse
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from .voices import supports

log = logging.getLogger(__name__)

MAX_CHARS = 600
SPEECHIFY_URL = "https://api.sws.speechify.com/v1/audio/stream"
FIRST_AUDIO_TIMEOUT_S = 4  # give up on a service that hasn't started sending audio by then

# Edge's own voice list (fetched once, cached): the backup voice for any language both services speak
EDGE_LIST_KEY = "edge:voices:v1"


def _edge_voice(lang, gender):
    """An Edge neural voice for this locale, matching the gender if it can — or None."""
    found = cache.get(EDGE_LIST_KEY)
    if found is None:
        try:
            import edge_tts

            found = [(v["ShortName"], v["Locale"], v.get("Gender", "").lower()) for v in asyncio.run(asyncio.wait_for(edge_tts.list_voices(), timeout=8))]
            cache.set(EDGE_LIST_KEY, found, 60 * 60 * 24)
        except Exception as e:  # noqa: BLE001
            log.warning("Edge voice list unavailable: %s", e)
            return None
    same = [name for name, locale, _ in found if locale == lang]
    return next((name for name, locale, g in found if locale == lang and g == gender), same[0] if same else None)


def _speechify_stream(text, voice, lang):
    """An open Speechify audio stream and its first chunk — or None if it can't start promptly."""
    key = getattr(settings, "SPEECHIFY_API_KEY", "")
    # only a voice Speechify itself lists for this language on our model
    if not key or not voice or not supports(lang, voice):
        return None
    body = {"input": text, "voice_id": voice, "model": getattr(settings, "SPEECHIFY_MODEL", "simba-3.5"), "language": lang}
    req = urllib.request.Request(
        SPEECHIFY_URL,
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json", "Accept": "audio/mpeg"},
    )
    try:
        res = urllib.request.urlopen(req, timeout=FIRST_AUDIO_TIMEOUT_S)
        first = res.read1(4096)  # whatever has arrived — don't wait for a full block
        if not first:
            res.close()
            return None
        return res, first
    except urllib.error.HTTPError as e:
        # 402/429 = free characters used up, 401/403 = bad key, 5xx = their trouble: the backup voice takes over
        log.warning("Speechify %s: %s", e.code, e.read()[:200])
    except Exception as e:  # noqa: BLE001 - slow or offline: the backup voice takes over
        log.warning("Speechify unavailable: %s", e)
    return None


def _edge_stream(text, lang, gender):
    """An Edge neural voice for the sentence, streamed: (first chunk, iterator of the rest) — or None."""
    voice = _edge_voice(lang, gender)
    if not voice:
        return None
    chunks: queue.Queue = queue.Queue()

    def run():
        async def go():
            import edge_tts

            async for chunk in edge_tts.Communicate(text, voice).stream():
                if chunk["type"] == "audio":
                    chunks.put(chunk["data"])

        try:
            asyncio.run(asyncio.wait_for(go(), timeout=12))
        except Exception as e:  # noqa: BLE001
            log.warning("Edge voice %s failed: %s", voice, e)
        finally:
            chunks.put(None)

    threading.Thread(target=run, daemon=True).start()
    try:
        first = chunks.get(timeout=FIRST_AUDIO_TIMEOUT_S + 2)
    except queue.Empty:
        return None
    if not first:
        return None

    def rest():
        while (chunk := chunks.get(timeout=10)) is not None:
            yield chunk

    return first, rest()


class TTSAnonThrottle(AnonRateThrottle):
    rate = "400/hour"


class TTSUserThrottle(UserRateThrottle):
    rate = "1200/hour"


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@throttle_classes([TTSAnonThrottle, TTSUserThrottle])
def tts(request):
    text = str(request.GET.get("text", "")).strip()[:MAX_CHARS]
    lang = str(request.GET.get("lang", "en-US"))[:12]
    voice = str(request.GET.get("voice", ""))[:60]
    gender = "male" if request.GET.get("gender") == "male" else "female"
    if not text:
        return Response({"detail": "Nothing to say."}, status=status.HTTP_400_BAD_REQUEST)

    key = "tts:" + hashlib.sha1(f"{lang}|{voice}|{gender}|{text}".encode()).hexdigest()
    cached = cache.get(key)
    if cached:
        return _audio(cached)

    opened = _speechify_stream(text, voice, lang)
    if opened:
        res, first = opened

        def stream():
            parts = [first]
            yield first
            try:
                while chunk := res.read1(8192):
                    parts.append(chunk)
                    yield chunk
            finally:
                res.close()
            cache.set(key, b"".join(parts), 60 * 60 * 6)  # greetings and repeats come back instantly

        response = StreamingHttpResponse(stream(), content_type="audio/mpeg")
        response["Cache-Control"] = "private, max-age=3600"
        response["X-Voice"] = "speechify"
        return response

    edge = _edge_stream(text, lang, gender)
    if edge:
        first, more = edge

        def stream_edge():
            parts = [first]
            yield first
            for chunk in more:
                parts.append(chunk)
                yield chunk
            cache.set(key, b"".join(parts), 60 * 60 * 6)

        response = StreamingHttpResponse(stream_edge(), content_type="audio/mpeg")
        response["Cache-Control"] = "private, max-age=3600"
        response["X-Voice"] = "edge"
        return response
    return Response({"detail": "No natural voice is available right now."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


def _audio(data, source="cache"):
    res = HttpResponse(data, content_type="audio/mpeg")
    res["Cache-Control"] = "private, max-age=3600"
    res["X-Voice"] = source
    return res
