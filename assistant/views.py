"""
Bridge chat API.

POST /api/assistant/chat/            stream a reply (Server-Sent Events). Signed-in users' chats are saved;
                                     visitors send their recent history with each message instead.
GET  /api/assistant/conversations/   the signed-in user's saved chats
GET/DELETE /api/assistant/conversations/<id>/
"""

import json
import logging
import re

from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from .context import CONTINUED_NOTE, INSTRUCTIONS, SITE_KNOWLEDGE, VOICE_NOTE, language_note, user_context
from .models import ChatMessage, Conversation
from .providers import ProviderError, get_providers

log = logging.getLogger(__name__)

MAX_MESSAGE_CHARS = 4000
HISTORY_TURNS = 30  # most recent messages sent back to the model

TITLE_PROMPT = (
    "Write a title for this chat in 3 to 6 words that sums up what it is about, like a chat-history entry "
    "(e.g. \"Frontend internships matching React\", \"Interview prep for data analyst\"). "
    "Plain words only: no quotes, no full stop, no emoji."
)


def short_title(text):
    """A tidy stand-in title until Bridge can summarise the chat: the first sentence, trimmed at a word."""
    first = re.split(r"(?<=[?.!])\s|\n", text.strip(), maxsplit=1)[0].strip()
    if len(first) <= 56:
        return first
    cut = first[:56].rsplit(" ", 1)[0].rstrip(",;:-–— ")
    return f"{cut}…"


def summary_title(providers, question, answer):
    """A short history title that sums up the chat, from its first exchange. None if no provider can make one."""
    convo = f"User: {question[:1500]}\n\nBridge: {answer[:2500]}"
    for provider in providers:
        try:
            text = provider.complete(TITLE_PROMPT, convo, max_tokens=40).strip()
        except ProviderError:
            continue
        except Exception:  # noqa: BLE001 - a title is a nicety; never break the chat for it
            continue
        title = text.strip("\"'“”.").splitlines()[0][:80] if text else ""
        if title:
            return title
    return None


class ChatAnonThrottle(AnonRateThrottle):
    rate = "20/hour"


class ChatUserThrottle(UserRateThrottle):
    rate = "120/hour"


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


ERRORS = {
    "busy": "Bridge is getting a lot of questions right now. Give it a minute and try again.",
    "timeout": "Bridge took too long to answer. Try again — it's usually quicker the second time.",
    "offline": "Bridge couldn't reach its AI service. Check your connection and try again.",
    "setup": "Bridge isn't set up on this server yet, so it can't answer right now.",
    "generic": "Something went wrong while Bridge was answering. Please try again.",
}


def _error(kind, partial=False):
    """An error event the chat turns into a friendly card. `partial`: some of the answer had already arrived."""
    return _sse({"type": "error", "kind": kind, "message": ERRORS.get(kind, ERRORS["generic"]), "partial": partial})


def _clean_history(raw) -> list[dict]:
    """A visitor's own history from the browser: only user/assistant text, alternating, starting with the user."""
    out = []
    for m in raw if isinstance(raw, list) else []:
        if not isinstance(m, dict) or m.get("role") not in ("user", "assistant"):
            continue
        text = str(m.get("content", ""))[:MAX_MESSAGE_CHARS].strip()
        if not text:
            continue
        if out and out[-1]["role"] == m["role"]:
            out[-1]["content"] += "\n\n" + text
        else:
            out.append({"role": m["role"], "content": text})
    while out and out[0]["role"] != "user":
        out.pop(0)
    return out[-HISTORY_TURNS:]


class ChatView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ChatAnonThrottle, ChatUserThrottle]

    def post(self, request):
        text = str(request.data.get("message", "")).strip()
        if not text:
            return Response({"detail": "Type a message first."}, status=status.HTTP_400_BAD_REQUEST)
        if len(text) > MAX_MESSAGE_CHARS:
            return Response({"detail": f"Messages can be up to {MAX_MESSAGE_CHARS} characters."}, status=status.HTTP_400_BAD_REQUEST)
        voice = bool(request.data.get("voice"))
        continued = bool(request.data.get("continued"))
        redo = bool(request.data.get("redo"))
        lang = str(request.data.get("lang", "")).strip()[:40]
        user = request.user if request.user.is_authenticated else None

        conversation = None
        if user:
            cid = request.data.get("conversation_id")
            if cid:
                conversation = get_object_or_404(Conversation, pk=cid, user=user)
            else:
                conversation = Conversation.objects.create(user=user, title=short_title(text))
            saved = list(conversation.messages.all())
            # you cut Bridge off and kept talking: this message replaces the question it was answering
            if continued and saved and saved[-1].role == ChatMessage.Role.USER:
                saved.pop().delete()
            # asked again (e.g. in another language): the earlier answer to it is replaced, not kept
            if redo and len(saved) >= 2 and saved[-1].role == ChatMessage.Role.ASSISTANT and saved[-2].content == text:
                saved.pop().delete()
            # "Try again" after a failed answer resends the same question: don't store it twice
            retrying = bool(saved) and saved[-1].role == ChatMessage.Role.USER and saved[-1].content == text
            if retrying:
                saved = saved[:-1]
            history = _clean_history([{"role": m.role, "content": m.content} for m in saved])
            if not retrying:
                ChatMessage.objects.create(conversation=conversation, role=ChatMessage.Role.USER, content=text)
            conversation.save(update_fields=["updated_at"])
        else:
            history = _clean_history(request.data.get("history"))

        messages = history + [{"role": "user", "content": text}]
        if messages[0]["role"] != "user":
            messages = messages[1:]
        notes = ([VOICE_NOTE] if voice else []) + ([CONTINUED_NOTE] if continued else [])
        if lang and lang.lower() not in ("english", "en"):
            notes.append(language_note(lang))
        system = "\n\n".join([INSTRUCTIONS, SITE_KNOWLEDGE, user_context(user)] + notes)

        def stream():
            if conversation:
                yield _sse({"type": "meta", "conversation_id": conversation.id, "title": conversation.title})
            providers = get_providers()
            if not providers:
                yield _error("setup")
                return
            reply = []
            last_kind = "busy"
            for i, provider in enumerate(providers):
                try:
                    # spoken turns skip the model's thinking step so the answer starts sooner
                    for piece in provider.stream(system, messages, fast=voice):
                        reply.append(piece)
                        yield _sse({"type": "delta", "text": piece})
                    break
                except ProviderError as e:
                    last_kind = e.kind
                    log.warning("Bridge provider %s failed (%s): %s", provider.name, e.kind, str(e)[:200])
                except Exception as e:  # noqa: BLE001 - never leave the chat hanging
                    last_kind = "generic"
                    log.exception("Bridge provider %s crashed: %s", provider.name, e)
                # nothing written yet: quietly hand over to the next provider
                if not reply and i < len(providers) - 1:
                    continue
                yield _error(last_kind, partial=bool(reply))
                return

            if conversation and reply:
                ChatMessage.objects.create(conversation=conversation, role=ChatMessage.Role.ASSISTANT, content="".join(reply))
                conversation.save(update_fields=["updated_at"])
                if not conversation.auto_titled:
                    first = list(conversation.messages.order_by("created_at", "id")[:2])
                    question = first[0].content if first else text
                    answer = first[1].content if len(first) > 1 else "".join(reply)
                    title = summary_title(providers, question, answer)
                    if title:
                        conversation.title = title
                        conversation.auto_titled = True
                        conversation.save(update_fields=["title", "auto_titled"])
                        yield _sse({"type": "title", "conversation_id": conversation.id, "title": title})
            yield _sse({"type": "done"})

        response = StreamingHttpResponse(stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def conversation_list(request):
    rows = Conversation.objects.filter(user=request.user).values("id", "title", "updated_at")[:50]
    return Response(list(rows))


@api_view(["GET", "DELETE"])
@permission_classes([permissions.IsAuthenticated])
def conversation_detail(request, pk):
    conversation = get_object_or_404(Conversation, pk=pk, user=request.user)
    if request.method == "DELETE":
        conversation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    return Response(
        {
            "id": conversation.id,
            "title": conversation.title,
            "messages": list(conversation.messages.values("id", "role", "content", "created_at")),
        }
    )
