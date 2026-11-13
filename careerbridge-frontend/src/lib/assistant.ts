"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"

import { API_URL, apiFetch, getAccessToken } from "@/lib/api"
import { languageInfo } from "@/lib/voice-prefs"

/** Bridge, the CareerBridge AI assistant: API calls + the chat state hook shared by the popup and the full page. */

export type ChatRole = "user" | "assistant"
export type ChatMsg = {
  id: string
  role: ChatRole
  content: string
  /** the whole answer failed — `content` holds the message to show */
  error?: boolean
  /** what went wrong (also set when an answer was cut off part-way: then `partial` is true) */
  errorKind?: ErrorKind
  partial?: boolean
  /** the person pressed stop while the answer was being written */
  stopped?: boolean
  local?: boolean
  /** how long Bridge thought before the first words, in ms */
  thoughtMs?: number
}

export type ErrorKind = "busy" | "timeout" | "offline" | "setup" | "limit" | "generic" | "stopped"

/** How each kind of problem is explained in the chat. */
export const ERROR_COPY: Record<ErrorKind, { title: string; text: string; retry: boolean }> = {
  busy: { title: "Bridge is a little busy", text: "Lots of people are asking questions right now. Give it a moment and try again.", retry: true },
  timeout: { title: "That took too long", text: "Bridge didn't answer in time. Try again — it's usually quicker the second time.", retry: true },
  offline: { title: "Can't reach Bridge", text: "Check your internet connection, then try again.", retry: true },
  setup: { title: "Bridge isn't ready yet", text: "The AI service isn't set up on this server yet, so Bridge can't answer right now.", retry: false },
  limit: { title: "Take a short break", text: "You've sent a lot of messages in a short time. Wait a few minutes, then try again.", retry: true },
  generic: { title: "Something went wrong", text: "Bridge couldn't finish that answer. Please try again.", retry: true },
  stopped: { title: "Stopped", text: "You stopped this answer.", retry: true },
}

/** Give up waiting if no words have arrived by then (the server tries up to three models first). */
const FIRST_WORD_DEADLINE_MS = 70_000
export type ConversationSummary = { id: number; title: string; updated_at: string }
/** What the orb shows. */
export type AssistantMood = "idle" | "listening" | "thinking" | "speaking"

export const ASSISTANT_NAME = "Bridge"

export function listConversations() {
  return apiFetch<ConversationSummary[]>("/assistant/conversations/")
}
export function getConversation(id: number) {
  return apiFetch<{ id: number; title: string; messages: { id: number; role: ChatRole; content: string }[] }>(`/assistant/conversations/${id}/`)
}
export function deleteConversation(id: number) {
  return apiFetch(`/assistant/conversations/${id}/`, { method: "DELETE" })
}

type StreamEvent =
  | { type: "meta"; conversation_id: number; title: string }
  | { type: "delta"; text: string }
  | { type: "title"; conversation_id: number; title: string }
  | { type: "done" }
  | { type: "error"; kind?: string; message: string; partial?: boolean }

async function openStream(body: unknown, signal: AbortSignal, retry = true): Promise<Response> {
  const token = await getAccessToken({ forceRefresh: !retry })
  const res = await fetch(`${API_URL}/assistant/chat/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal,
  })
  // an expired access token: refresh once and try again
  if (res.status === 401 && retry && token) return openStream(body, signal, false)
  return res
}

async function* readEvents(res: Response): AsyncGenerator<StreamEvent> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let i: number
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i)
      buf = buf.slice(i + 2)
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            yield JSON.parse(line.slice(6)) as StreamEvent
          } catch {
            /* ignore a malformed line */
          }
        }
      }
    }
  }
}

/** Without the last question-and-answer (used when you cut Bridge off and your new words replace it). */
function dropLastExchange(all: ChatMsg[]) {
  const i = all.map((m) => m.role).lastIndexOf("user")
  return i >= 0 ? all.slice(0, i) : all
}

/** "hi-IN" → "Hindi", for the AI's instructions. */
function languageName(code?: string) {
  return code ? languageInfo(code).name : ""
}

let seq = 0
const newId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`

/**
 * Chat state: messages, sending, streaming, stop, and (when signed in) the saved conversation id.
 * `status` drives the orb: "thinking" until the first words arrive, then "streaming".
 */
export function useAssistantChat({ signedIn }: { signedIn: boolean }) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [status, setStatus] = useState<"idle" | "thinking" | "streaming">("idle")
  const [conversationId, setConversationId] = useState<number | null>(null)
  const abort = useRef<AbortController | null>(null)
  const idleWaiters = useRef<(() => void)[]>([])
  const latest = useRef<ChatMsg[]>([])
  useLayoutEffect(() => {
    latest.current = messages
  }, [messages])

  const send = useCallback(
    async (
      text: string,
      opts: {
        voice?: boolean
        /** the language you're speaking (a code like "hi-IN") — Bridge answers in it */
        lang?: string
        /** you cut in before Bridge finished: this message joins your earlier words with what you added */
        continued?: boolean
        /** replace the last exchange (the one you cut off) instead of adding after it */
        mergeLast?: boolean
        /** ask the last question again (e.g. in another language): its earlier answer is replaced, not kept */
        redo?: boolean
        /** each new piece of the answer as it streams in (Live mode reads it aloud sentence by sentence) */
        onDelta?: (piece: string) => void
        onDone?: (reply: string) => void
        /** the answer failed or was stopped */
        onFail?: (kind: ErrorKind) => void
        onConversation?: (c: { id: number; title: string }) => void
      } = {}
    ) => {
      const content = text.trim()
      if (!content || abort.current) return
      const replace = opts.mergeLast || opts.redo
      const base = replace ? dropLastExchange(latest.current) : latest.current
      const history = base
        .filter((m) => !m.error && !m.local && !(m.role === "user" && m.content.startsWith("/")))
        .map(({ role, content }) => ({ role, content }))
      const userMsg: ChatMsg = { id: newId(), role: "user", content }
      const botId = newId()
      setMessages((m) => [...(replace ? dropLastExchange(m) : m), userMsg, { id: botId, role: "assistant", content: "" }])
      setStatus("thinking")
      const startedAt = performance.now()
      const ctrl = new AbortController()
      abort.current = ctrl
      let reply = ""
      let timedOut = false
      // if no words have arrived after a while, stop waiting and say so — never think forever
      const deadline = setTimeout(() => {
        if (!reply) {
          timedOut = true
          ctrl.abort()
        }
      }, FIRST_WORD_DEADLINE_MS)
      const patch = (fn: (m: ChatMsg) => ChatMsg) => setMessages((all) => all.map((m) => (m.id === botId ? fn(m) : m)))
      const fail = (kind: ErrorKind, message = ERROR_COPY[kind].text) => {
        patch((m) => (m.content ? { ...m, errorKind: kind, partial: true } : { ...m, content: message, error: true, errorKind: kind }))
        opts.onFail?.(kind)
      }
      try {
        const res = await openStream(
          {
            message: content,
            voice: !!opts.voice,
            lang: languageName(opts.lang),
            continued: !!opts.continued,
            redo: !!opts.redo,
            ...(signedIn ? { conversation_id: conversationId } : { history: history.slice(-20) }),
          },
          ctrl.signal
        )
        if (!res.ok || !res.body) {
          if (res.status === 429) fail("limit")
          else {
            let detail: string | undefined
            try {
              detail = (await res.json()).detail
            } catch {
              /* no details */
            }
            fail("generic", detail)
          }
          return
        }
        for await (const ev of readEvents(res)) {
          if (ev.type === "meta") {
            setConversationId(ev.conversation_id)
            opts.onConversation?.({ id: ev.conversation_id, title: ev.title })
          } else if (ev.type === "delta") {
            const first = !reply
            reply += ev.text
            setStatus("streaming")
            const thought = first ? Math.round(performance.now() - startedAt) : undefined
            patch((m) => ({ ...m, content: reply, ...(first ? { thoughtMs: thought } : {}) }))
            opts.onDelta?.(ev.text)
          } else if (ev.type === "error") {
            fail((ev.kind as ErrorKind) in ERROR_COPY ? (ev.kind as ErrorKind) : "generic", reply ? undefined : ev.message)
          }
        }
        if (reply) opts.onDone?.(reply)
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          if (timedOut) fail("timeout")
          else {
            patch((m) => (m.content ? { ...m, stopped: true } : { ...m, content: "", error: true, errorKind: "stopped" }))
            opts.onFail?.("stopped")
          }
        } else {
          fail("offline")
        }
      } finally {
        clearTimeout(deadline)
        abort.current = null
        setStatus("idle")
        const waiting = idleWaiters.current.splice(0)
        setTimeout(() => waiting.forEach((f) => f()), 0)
      }
    },
    [conversationId, signedIn]
  )

  /** Ask the question behind a failed answer again (the failed pair is replaced, not duplicated). */
  const retry = useCallback(
    (failedId: string) => {
      const all = latest.current
      const i = all.findIndex((m) => m.id === failedId)
      if (i < 1 || abort.current) return
      const question = all[i - 1]
      if (question.role !== "user") return
      const kept = all.slice(0, i - 1)
      latest.current = kept
      setMessages(kept)
      send(question.content)
    },
    [send]
  )

  const stop = useCallback(() => abort.current?.abort(), [])
  /** Run `fn` once no answer is on its way (straight away if none is). */
  const whenIdle = useCallback((fn: () => void) => {
    if (abort.current) idleWaiters.current.push(fn)
    else fn()
  }, [])

  const reset = useCallback(() => {
    abort.current?.abort()
    setMessages([])
    setConversationId(null)
  }, [])

  const load = useCallback(async (id: number) => {
    abort.current?.abort()
    const c = await getConversation(id)
    setConversationId(c.id)
    setMessages(c.messages.map((m) => ({ id: `s${m.id}`, role: m.role, content: m.content })))
  }, [])

  /** A local exchange (e.g. the /help command) — shown in the chat, never sent to the server or saved. */
  const addLocal = useCallback((question: string, answer: string) => {
    setMessages((m) => [...m, { id: newId(), role: "user", content: question }, { id: newId(), role: "assistant", content: answer, local: true }])
  }, [])

  return { messages, status, conversationId, send, retry, stop, whenIdle, reset, load, addLocal }
}

/** Open the floating assistant from anywhere (e.g. the landing page), optionally with a question already asked —
 *  or straight into a voice call (`{ live: true }`). */
export function openAssistant(prompt?: string, opts: { live?: boolean } = {}) {
  window.dispatchEvent(new CustomEvent("cb:assistant", { detail: { prompt, live: !!opts.live } }))
}

/* Bridge only lives inside the signed-in app. Outside it (the website), ask for it here: the request waits in this tab
   and Bridge opens with it as soon as you're in the dashboard (after signing in, if you weren't). */
const QUEUED = "bridge.queued"
export type BridgeRequest = { prompt?: string; live?: boolean }
export function queueBridge(req: BridgeRequest) {
  try {
    sessionStorage.setItem(QUEUED, JSON.stringify({ ...req, at: Date.now() }))
  } catch {
    /* private mode: Bridge just won't open by itself */
  }
}
export function takeQueuedBridge(): BridgeRequest | null {
  try {
    const raw = sessionStorage.getItem(QUEUED)
    sessionStorage.removeItem(QUEUED)
    const req = raw ? JSON.parse(raw) : null
    return req && Date.now() - req.at < 15 * 60_000 ? { prompt: req.prompt, live: req.live } : null // stale asks are dropped
  } catch {
    return null
  }
}
