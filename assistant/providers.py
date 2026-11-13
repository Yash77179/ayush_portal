"""
The AI services Bridge can talk to, behind one small interface.

Bridge tries them in order — NVIDIA, then OpenRouter, then each Gemini model — and moves to the next one when a service is busy,
slow or gone, so a single outage doesn't stop the chat. Each provider:
  .name                                     for logs
  .stream(system, messages) -> iter[str]    the answer, piece by piece (messages: [{"role": "user"|"assistant", ...}])
  .complete(system, prompt, max_tokens)     a short one-off answer (used for chat titles)
and raises ProviderError(kind) with kind in: busy, timeout, offline, setup, generic.
"""

import logging

from django.conf import settings

log = logging.getLogger(__name__)

TIMEOUT_S = 25  # per attempt; no hidden retries — falling back to the next provider is quicker


class ProviderError(Exception):
    def __init__(self, kind, detail=""):
        super().__init__(f"{kind}: {detail}")
        self.kind = kind


class OpenAICompatibleProvider:
    """Any service with an OpenAI-style chat API (NVIDIA, OpenRouter, …): a base URL, a key and a model name."""

    def __init__(self, label, base_url, api_key, model, extra_body=None, title_extra_body=None, headers=None):
        from openai import OpenAI

        self.name = f"{label}:{model}"
        self.model = model
        self.extra_body = extra_body or {}
        self.title_extra_body = title_extra_body if title_extra_body is not None else self.extra_body
        self.client = OpenAI(base_url=base_url, api_key=api_key, timeout=TIMEOUT_S, max_retries=0, default_headers=headers)

    def _call(self, fn):
        import openai

        try:
            return fn()
        except openai.APITimeoutError as e:
            raise ProviderError("timeout", str(e)) from None
        except openai.APIConnectionError as e:
            raise ProviderError("offline", str(e)) from None
        except (openai.AuthenticationError, openai.PermissionDeniedError) as e:
            raise ProviderError("setup", str(e)) from None
        except openai.RateLimitError as e:
            raise ProviderError("busy", str(e)) from None
        except openai.APIStatusError as e:
            raise ProviderError("busy" if e.status_code >= 500 or e.status_code in (402, 404) else "generic", str(e)) from None

    def stream(self, system, messages, fast=False):
        chat = [{"role": "system", "content": system}] + [{"role": m["role"], "content": m["content"]} for m in messages]
        response = self._call(
            lambda: self.client.chat.completions.create(
                model=self.model,
                messages=chat,
                temperature=0.6,
                top_p=0.95,
                max_tokens=4096,
                stream=True,
                extra_body=self.title_extra_body if fast else self.extra_body,
            )
        )
        it = iter(response)
        while True:
            chunk = self._call(lambda: next(it, None))
            if chunk is None:
                return
            # some models reason first (`reasoning_content` / `reasoning`); only the answer itself is shown
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    def complete(self, system, prompt, max_tokens=60):
        res = self._call(
            lambda: self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=max_tokens,
                extra_body=self.title_extra_body,
            )
        )
        return (res.choices[0].message.content or "") if res.choices else ""


def nvidia(api_key, model, thinking):
    """NVIDIA's hosted models (build.nvidia.com). With thinking on, the model reasons before answering (never shown)."""
    return OpenAICompatibleProvider(
        "nvidia",
        "https://integrate.api.nvidia.com/v1",
        api_key,
        model,
        extra_body={"chat_template_kwargs": {"enable_thinking": thinking}},
        title_extra_body={"chat_template_kwargs": {"enable_thinking": False}},
    )


def openrouter(api_key, model):
    """OpenRouter (openrouter.ai): one key, many models — the `:free` ones cost nothing."""
    return OpenAICompatibleProvider(
        "openrouter",
        "https://openrouter.ai/api/v1",
        api_key,
        model,
        # OpenRouter asks apps to identify themselves (shown on its dashboard)
        headers={"HTTP-Referer": "https://careerbridge.app", "X-Title": "CareerBridge"},
    )


class GeminiProvider:
    """One Google Gemini model."""

    _client = None

    def __init__(self, api_key, model):
        from google import genai
        from google.genai import types

        self.name = f"gemini:{model}"
        self.model = model
        self.types = types
        if GeminiProvider._client is None:
            GeminiProvider._client = genai.Client(
                api_key=api_key,
                http_options=types.HttpOptions(timeout=TIMEOUT_S * 1000, retry_options=types.HttpRetryOptions(attempts=1)),
            )
        self.client = GeminiProvider._client

    def _call(self, fn):
        from google.genai import errors

        try:
            return fn()
        except errors.APIError as e:
            kind = "setup" if e.code in (401, 403) else "busy" if e.code in (404, 429, 500, 503) else "generic"
            raise ProviderError(kind, str(e)[:200]) from None
        except ProviderError:
            raise
        except Exception as e:  # noqa: BLE001 - network trouble of any sort
            raise ProviderError("timeout" if "timeout" in type(e).__name__.lower() else "offline", str(e)[:200]) from None

    def stream(self, system, messages, fast=False):
        contents = [{"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]} for m in messages]
        config = self.types.GenerateContentConfig(system_instruction=system, temperature=0.3, max_output_tokens=2048)
        it = iter(self._call(lambda: self.client.models.generate_content_stream(model=self.model, contents=contents, config=config)))
        while True:
            chunk = self._call(lambda: next(it, None))
            if chunk is None:
                return
            if chunk.text:
                yield chunk.text

    def complete(self, system, prompt, max_tokens=60):
        config = self.types.GenerateContentConfig(system_instruction=system, temperature=0.2, max_output_tokens=max_tokens)
        res = self._call(lambda: self.client.models.generate_content(model=self.model, contents=prompt, config=config))
        return res.text or ""


_cache = {}


def get_providers():
    """Every configured provider, in the order Bridge tries them. Empty when no AI key is set. Built once and reused."""
    key = (
        getattr(settings, "NVIDIA_API_KEY", ""),
        getattr(settings, "NVIDIA_MODEL", ""),
        getattr(settings, "NVIDIA_THINKING", True),
        getattr(settings, "OPENROUTER_API_KEY", ""),
        getattr(settings, "OPENROUTER_MODEL", ""),
        getattr(settings, "GEMINI_API_KEY", ""),
        tuple(getattr(settings, "GEMINI_MODELS", None) or ()),
    )
    if key not in _cache:
        _cache.clear()
        _cache[key] = _build()
    return _cache[key]


def _build():
    out = []
    if getattr(settings, "NVIDIA_API_KEY", ""):
        out.append(nvidia(settings.NVIDIA_API_KEY, settings.NVIDIA_MODEL, settings.NVIDIA_THINKING))
    if getattr(settings, "OPENROUTER_API_KEY", ""):
        out.append(openrouter(settings.OPENROUTER_API_KEY, settings.OPENROUTER_MODEL))
    if getattr(settings, "GEMINI_API_KEY", ""):
        for model in getattr(settings, "GEMINI_MODELS", None) or ["gemini-3.5-flash"]:
            out.append(GeminiProvider(settings.GEMINI_API_KEY, model))
    return out
