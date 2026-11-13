import json
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APITestCase

from .models import Conversation
from .providers import ProviderError

User = get_user_model()


class FakeProvider:
    """Stands in for NVIDIA / Gemini: streams the given chunks, or fails with the given kind."""

    def __init__(self, name, chunks=("ok",), fail=None, title="Weekly plan for internships"):
        self.name, self.chunks, self.fail, self.title = name, chunks, fail, title
        self.calls = []

    def stream(self, system, messages, fast=False):
        self.calls.append({"system": system, "messages": messages})
        if self.fail:
            raise ProviderError(self.fail)
        yield from self.chunks

    def complete(self, system, prompt, max_tokens=60):
        if self.fail:
            raise ProviderError(self.fail)
        return self.title


def using(*providers):
    return mock.patch("assistant.views.get_providers", return_value=list(providers))


def events(response):
    body = b"".join(response.streaming_content).decode()
    return [json.loads(line[6:]) for line in body.split("\n") if line.startswith("data: ")]


class ChatTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_visitor_chat_streams_and_saves_nothing(self):
        p = FakeProvider("nvidia", ["Hi ", "there"])
        with using(p):
            r = self.client.post(
                "/api/assistant/chat/",
                {"message": "What is CareerBridge?", "history": [{"role": "assistant", "content": "hello"}, {"role": "user", "content": "hey"}, {"role": "assistant", "content": "yo"}]},
                format="json",
            )
            ev = events(r)
        self.assertEqual("".join(e["text"] for e in ev if e["type"] == "delta"), "Hi there")
        self.assertEqual(ev[-1]["type"], "done")
        self.assertEqual(Conversation.objects.count(), 0)
        sent = p.calls[0]["messages"]
        self.assertEqual([m["role"] for m in sent], ["user", "assistant", "user"])  # leading assistant turn dropped
        self.assertEqual(sent[-1]["content"], "What is CareerBridge?")
        self.assertIn("SITE KNOWLEDGE", p.calls[0]["system"])
        self.assertIn("not signed in", p.calls[0]["system"])

    def test_signed_in_chat_is_saved_continued_and_titled(self):
        u = User.objects.create_user("s1", "s1@example.com", "pw-123456x")
        self.client.force_authenticate(u)
        with using(FakeProvider("nvidia", ["Answer one"])):
            ev = events(self.client.post("/api/assistant/chat/", {"message": "First question"}, format="json"))
        cid = ev[0]["conversation_id"]
        self.assertIn({"type": "title", "conversation_id": cid, "title": "Weekly plan for internships"}, ev)
        p = FakeProvider("nvidia", ["Answer two"])
        with using(p):
            events(self.client.post("/api/assistant/chat/", {"message": "Second", "conversation_id": cid, "voice": True}, format="json"))
        self.assertEqual([m["role"] for m in p.calls[0]["messages"]], ["user", "assistant", "user"])
        self.assertIn("read aloud", p.calls[0]["system"])  # voice replies stay short
        r = self.client.get(f"/api/assistant/conversations/{cid}/")
        self.assertEqual([m["content"] for m in r.data["messages"]], ["First question", "Answer one", "Second", "Answer two"])
        self.assertEqual(r.data["title"], "Weekly plan for internships")

    def test_busy_provider_hands_over_to_the_next(self):
        nvidia, gemini = FakeProvider("nvidia", fail="busy"), FakeProvider("gemini", ["from gemini"])
        with using(nvidia, gemini):
            ev = events(self.client.post("/api/assistant/chat/", {"message": "hi"}, format="json"))
        self.assertEqual(len(nvidia.calls), 1)
        self.assertEqual("".join(e["text"] for e in ev if e["type"] == "delta"), "from gemini")
        self.assertEqual(ev[-1]["type"], "done")

    def test_all_providers_down_gives_a_friendly_error(self):
        with using(FakeProvider("nvidia", fail="busy"), FakeProvider("gemini", fail="busy")):
            ev = events(self.client.post("/api/assistant/chat/", {"message": "hi"}, format="json"))
        self.assertEqual(ev[-1]["type"], "error")
        self.assertEqual(ev[-1]["kind"], "busy")

    def test_no_provider_explains_setup(self):
        with using():
            ev = events(self.client.post("/api/assistant/chat/", {"message": "hi"}, format="json"))
        self.assertEqual(ev[-1]["kind"], "setup")

    def test_try_again_does_not_store_the_question_twice(self):
        u = User.objects.create_user("s2", "s2@example.com", "pw-123456x")
        self.client.force_authenticate(u)
        with using(FakeProvider("nvidia", fail="busy")):
            ev = events(self.client.post("/api/assistant/chat/", {"message": "Help me"}, format="json"))
        cid = ev[0]["conversation_id"]
        p = FakeProvider("nvidia", ["Sure"])
        with using(p):
            events(self.client.post("/api/assistant/chat/", {"message": "Help me", "conversation_id": cid}, format="json"))
        self.assertEqual([m["role"] for m in p.calls[0]["messages"]], ["user"])
        r = self.client.get(f"/api/assistant/conversations/{cid}/")
        self.assertEqual([m["content"] for m in r.data["messages"]], ["Help me", "Sure"])

    def test_language_and_continued_notes(self):
        p = FakeProvider("nvidia", ["ठीक है"])
        with using(p):
            events(self.client.post("/api/assistant/chat/", {"message": "मुझे इंटर्नशिप चाहिए", "lang": "Hindi", "continued": True, "voice": True}, format="json"))
        self.assertIn("Reply in Hindi", p.calls[0]["system"])
        self.assertIn("interrupted your answer", p.calls[0]["system"])

    def test_cannot_read_someone_elses_chat(self):
        a = User.objects.create_user("a", "a@example.com", "pw-123456x")
        b = User.objects.create_user("b", "b@example.com", "pw-123456x")
        c = Conversation.objects.create(user=a, title="private")
        self.client.force_authenticate(b)
        self.assertEqual(self.client.get(f"/api/assistant/conversations/{c.id}/").status_code, 404)

    def test_empty_message_rejected(self):
        self.assertEqual(self.client.post("/api/assistant/chat/", {"message": "  "}, format="json").status_code, 400)
