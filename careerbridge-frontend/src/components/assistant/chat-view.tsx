"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { ArrowUpIcon, SpeakerIcon, SpeakerOffIcon, StopIcon } from "@/components/icons"
import { AssistantOrb } from "@/components/assistant/orb"
import LatticeLoader from "@/components/LatticeLoader"
import VoicePill from "@/components/VoicePill"
import { Markdown } from "@/components/assistant/markdown"
import { CutShortNote, ErrorCard } from "@/components/assistant/error-note"
import { useAuth } from "@/contexts/auth-context"
import { type AssistantMood, type ChatMsg, ERROR_COPY, useAssistantChat } from "@/lib/assistant"
import { useSpeechInput, useSpeechOutput } from "@/lib/voice"
import { getVoicePrefs, onVoicePrefsChange, useVoicePrefs } from "@/lib/voice-prefs"
import { VOICE_TRIGGER, VoiceSettings } from "@/components/assistant/voice-settings"
import { GlobalIcon } from "@solar-icons/react/linear"
import { cn } from "cn"

/* ───────────────────────── the brain: chat + voice + the orb's mood ───────────────────────── */

/* ───────────────────────── /help: what Bridge can do, per role (answered locally, no AI call) ───────────────────────── */

const HELP_INTRO = "Here's what I can help you with — just ask in your own words:"
const HELP_OUTRO =
  "**Prefer talking?** Tap the mic for one question, or type `/live` (or tap **Live** at the top) for a hands-free conversation — talk, I answer out loud, then I listen again.\n\n**Your past chats are saved** — type `/history` or tap the clock at the top to reopen one.\n\nType `/help` any time to see this again."

const HELP: Record<string, string[]> = {
  student: [
    "**Find internships that fit** — *“Which internships match my skills?”*",
    "**Understand your match** — why a score is what it is, and which skills are missing",
    "**Plan what to learn** — the skills that open the most doors for you",
    "**Polish your profile & resume** — what's missing and how to say it better",
    "**Prepare for interviews** — practice questions, answers and tips",
    "**Write a cover letter** — tailored to a specific internship",
  ],
  company: [
    "**Write internship posts** — clear descriptions and the right required skills",
    "**Shortlist fairly** — what to look for, and what to ignore",
    "**Interview questions** — for any role and level",
    "**Make offers & messages** — friendly, professional wording",
  ],
  university: [
    "**Placement planning** — prep programmes and timelines",
    "**Skill trends** — what companies are asking for right now",
    "**Student readiness** — how to get more students placement-ready",
    "**Company outreach** — bringing more recruiters to campus",
  ],
  visitor: [
    "**What CareerBridge is** — and how it works for students, companies and universities",
    "**Open internships** — what's available right now",
    "**Skill matching** — how your match score is worked out",
    "**Getting started** — creating an account and landing your first internship",
  ],
}

export function helpText(role?: string) {
  const items = HELP[role ?? "visitor"] ?? HELP.visitor
  return `${HELP_INTRO}\n\n${items.map((i) => `- ${i}`).join("\n")}\n\n${HELP_OUTRO}`
}

/** Slash commands the composer understands. */
export const COMMANDS = [
  { name: "/help", hint: "See what Bridge can do" },
  { name: "/history", hint: "Open your past chats" },
  { name: "/live", hint: "Talk to Bridge hands-free" },
]

/** Live mode's opening lines — one is picked at random each time (never the same one twice in a row). */
const LIVE_GREETINGS: ((name: string, hello: string) => string)[] = [
  (n, h) => `${h}${n}! I'm listening — what can I help you with today?`,
  (n) => `Hey${n}! What's on your mind?`,
  (n, h) => `${h}${n}! Want to look at internships, your profile, or practise for an interview?`,
  (n) => `Hi${n}, Bridge here. Ask me anything about your career.`,
  (n) => `Hello${n}! Where would you like to start?`,
  (n) => `Hey${n}, good to hear from you. What are we working on?`,
  (n, h) => `${h}${n}! I'm all ears — just start talking.`,
  (n) => `Hi${n}! Looking for an internship, or getting ready for one?`,
  (n) => `Hey there${n}! Tell me what you need and I'll help you sort it out.`,
  (n) => `Hello${n}! Shall we find something that fits your skills?`,
  (n, h) => `${h}${n}! What can I do for you?`,
  (n) => `Hi${n}! Ready when you are — what would you like to know?`,
  (n) => `Hey${n}! Ask me about openings, your applications, or what to learn next.`,
  (n) => `Hello${n}, I'm here. What's the plan for today?`,
  (n) => `Hi${n}! Got a question about your career? Fire away.`,
]
let lastGreeting = -1

const HINDI_GREETINGS: ((name: string) => string)[] = [
  (n) => `नमस्ते${n}! बताइए, आज मैं आपकी क्या मदद कर सकता हूँ?`,
  (n) => `हाय${n}! आपके मन में क्या है?`,
  (n) => `नमस्ते${n}! इंटर्नशिप ढूँढनी है, प्रोफ़ाइल सुधारनी है, या इंटरव्यू की तैयारी करनी है?`,
  (n) => `हेलो${n}! मैं सुन रहा हूँ — बेझिझक पूछिए।`,
  (n) => `नमस्ते${n}! कहाँ से शुरू करें?`,
  (n) => `हाय${n}! अपने करियर के बारे में कुछ भी पूछिए।`,
]

function liveGreeting(name: string, lang = "en-IN") {
  if (lang.startsWith("hi")) {
    const list = HINDI_GREETINGS
    let i = Math.floor(Math.random() * list.length)
    if (i === lastGreeting) i = (i + 1) % list.length
    lastGreeting = i
    return list[i](name ? ` ${name}` : "")
  }
  const hour = new Date().getHours()
  const hello = hour < 5 ? "Hi" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  let i = Math.floor(Math.random() * LIVE_GREETINGS.length)
  if (i === lastGreeting) i = (i + 1 + Math.floor(Math.random() * (LIVE_GREETINGS.length - 1))) % LIVE_GREETINGS.length
  lastGreeting = i
  return LIVE_GREETINGS[i](name ? `, ${name}` : "", hello)
}

/** A finished sentence at the start of `text` (so speech can begin before the whole answer is in), or null. */
function takeSentence(text: string) {
  const m = text.match(/^([\s\S]*?[.!?…:])(\s+)/)
  if (m && m[1].trim().length > 1) return { sentence: m[1], rest: text.slice(m[0].length) }
  // a long run without punctuation (a list, say): read it at a line break
  const nl = text.indexOf("\n")
  if (nl > 40) return { sentence: text.slice(0, nl), rest: text.slice(nl + 1) }
  return null
}

export function useBridge() {
  const { user } = useAuth()
  const chat = useAssistantChat({ signedIn: !!user })
  const [speakReplies, setSpeakReplies] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const speakRef = useRef(speakReplies)
  useEffect(() => {
    speakRef.current = speakReplies
  }, [speakReplies])

  /* ── Live mode: a hands-free conversation — listen, answer aloud, listen again ──
     The mic is off while Bridge speaks (so it never hears itself) and opens when it has finished.
     Tapping the orb cuts Bridge off; if it hadn't finished answering, what you say next joins your earlier words. */
  const [live, setLive] = useState(false)
  const [livePaused, setLivePaused] = useState(false)
  const [liveMuted, setLiveMuted] = useState(false)
  const [liveHeard, setLiveHeard] = useState("") // what you said last
  const [liveSaid, setLiveSaid] = useState("") // what Bridge is saying
  const liveRef = useRef({
    on: false,
    paused: false,
    muted: false,
    turn: "idle" as "idle" | "listening" | "answering",
    quiet: 0,
    streaming: false, // Bridge's answer is still arriving
    lastQuestion: "", // what you asked last (to merge with, if you cut in)
    merge: "", // set when you cut in before Bridge finished: your earlier words
    said: "", // everything Bridge has said this turn
    switching: false, // you changed language mid-answer: Bridge is about to answer again in it
  })
  const listenAgainRef = useRef<() => void>(() => {})

  const out = useSpeechOutput({
    // Bridge finished speaking: in Live mode, the floor is yours again
    onDrain: () => {
      const l = liveRef.current
      if (!l.on || l.paused || l.muted || l.turn !== "answering" || l.streaming || l.switching) return
      l.turn = "listening"
      setTimeout(() => listenAgainRef.current(), 200)
    },
  })

  // the composer listens for "listening ended" so it can close its mic pill smoothly
  const endListeners = useRef(new Set<() => void>())
  const onListeningEnd = useCallback((f: () => void) => {
    endListeners.current.add(f)
    return () => {
      endListeners.current.delete(f)
    }
  }, [])

  const pauseLive = useCallback(() => {
    liveRef.current.paused = true
    liveRef.current.turn = "idle"
    setLivePaused(true)
  }, [])

  const answerLive = (text: string, continued: boolean, redo = false) => {
    const l = liveRef.current
    l.turn = "answering"
    l.quiet = 0
    l.streaming = true
    l.lastQuestion = text
    l.said = ""
    setLiveHeard(text)
    setLiveSaid("")
    let buffer = ""
    let spoke = false
    const say = (t: string) => {
      if (!t.trim() || !out.supported) return
      spoke = true
      out.enqueue(t)
    }
    chat.send(text, {
      voice: true,
      lang: getVoicePrefs().lang,
      continued,
      mergeLast: continued,
      redo,
      onDelta: (piece) => {
        l.said += piece
        setLiveSaid((s) => s + piece)
        buffer += piece
        for (let next = takeSentence(buffer); next; next = takeSentence(buffer)) {
          say(next.sentence)
          buffer = next.rest
        }
      },
      onDone: () => {
        l.streaming = false
        say(buffer)
        buffer = ""
        // nothing to read aloud (or no speech in this browser): your turn straight away
        if (!spoke && l.on && !l.paused && l.turn === "answering") {
          l.turn = "listening"
          setTimeout(() => listenAgainRef.current(), 250)
        }
      },
      onFail: (kind) => {
        l.streaming = false
        // stopped because you tapped to cut in (carry on listening) or switched language (answering again)
        if (l.turn !== "answering" || l.switching) return
        // anything else: say what went wrong (silence would look like Bridge ignored you), then pause politely
        if (kind !== "stopped" && !spoke && out.supported) say(ERROR_COPY[kind].text)
        pauseLive()
      },
    })
  }

  const input = useSpeechInput({
    onFinal: (text) => {
      const l = liveRef.current
      if (l.on) {
        if (l.turn !== "listening") return
        const yours = text
        const merged = l.merge ? `${l.merge} ${yours}` : ""
        l.merge = ""
        return merged ? answerLive(merged, true) : answerLive(yours, false)
      }
      // tap-to-talk: a spoken question gets a short, spoken answer
      chat.send(text, {
        voice: true,
        lang: getVoicePrefs().lang,
        onDone: (reply) => {
          if (speakRef.current) out.speak(reply)
        },
      })
    },
    onError: (msg, code) => {
      if (!liveRef.current.on) return toast.error(msg)
      if (code === "no-speech" || code === "aborted") return // silence is handled when listening ends
      toast.error(msg)
      pauseLive()
    },
    onEnd: () => {
      endListeners.current.forEach((f) => f())
      const l = liveRef.current
      if (!l.on || l.paused || l.muted) return
      // your turn, and you said nothing: keep listening a couple of times, then pause politely
      if (l.turn === "listening") {
        setTimeout(() => {
          if (!liveRef.current.on || liveRef.current.turn !== "listening" || input.listening) return
          liveRef.current.quiet++
          if (liveRef.current.quiet >= 3) pauseLive()
          else listenAgainRef.current()
        }, 300)
      }
    },
  })

  // You picked another language while Bridge was answering: it finishes the sentence it's on, then answers the
  // same question again in the new language (and its voice) — or, during the hello, says hello again in it.
  const switchLanguageRef = useRef<(lang: string) => void>(() => {})
  useEffect(() => {
    switchLanguageRef.current = (lang) => {
      const l = liveRef.current
      if (!l.on || l.paused || l.turn !== "answering" || !out.supported) return
      out.dropPending()
      if (!l.lastQuestion) {
        const greeting = liveGreeting(user?.first_name || user?.username || "", lang)
        l.said = greeting
        setLiveSaid(greeting)
        out.enqueue(greeting)
        return
      }
      l.switching = true
      chat.stop()
      chat.whenIdle(() => {
        l.switching = false
        if (l.on && !l.paused && l.turn === "answering") answerLive(l.lastQuestion, false, true)
      })
    }
  })
  useEffect(() => {
    let lang = getVoicePrefs().lang
    return onVoicePrefsChange(() => {
      const next = getVoicePrefs().lang
      if (next === lang) return
      lang = next
      switchLanguageRef.current(next)
    })
  }, [])

  useEffect(() => {
    listenAgainRef.current = () => {
      const l = liveRef.current
      if (!l.on || l.paused || l.muted || input.listening) return
      if (l.turn === "idle") l.turn = "listening"
      input.start({ endOnPause: true })
    }
  })

  const startLive = useCallback(() => {
    out.cancel()
    chat.stop()
    liveRef.current = { on: true, paused: false, muted: false, turn: "idle", quiet: 0, streaming: false, lastQuestion: "", merge: "", said: "", switching: false }
    setLive(true)
    setLivePaused(false)
    setLiveMuted(false)
    setLiveHeard("")
    // Bridge says hello first, then the floor is yours
    const greeting = liveGreeting(user?.first_name || user?.username || "", getVoicePrefs().lang)
    setLiveSaid(greeting)
    liveRef.current.said = greeting
    if (out.supported) {
      // the mic opens when the greeting has been said (see onDrain)
      liveRef.current.turn = "answering"
      setTimeout(() => out.enqueue(greeting), 200)
    } else {
      setTimeout(() => listenAgainRef.current(), 400)
    }
  }, [chat, out, user])

  const endLive = useCallback(() => {
    liveRef.current = { on: false, paused: false, muted: false, turn: "idle", quiet: 0, streaming: false, lastQuestion: "", merge: "", said: "", switching: false }
    setLive(false)
    input.cancel()
    out.cancel()
    chat.stop()
  }, [chat, input, out])

  const toggleLiveMute = useCallback(() => {
    const l = liveRef.current
    l.muted = !l.muted
    setLiveMuted(l.muted)
    if (l.muted) {
      input.cancel()
    } else {
      if (!out.speaking && chat.status === "idle") l.turn = "listening"
      listenAgainRef.current()
    }
  }, [chat.status, input, out])

  /** Tap the orb: cut Bridge off and talk, or resume after a pause. */
  const liveTap = useCallback(() => {
    const l = liveRef.current
    if (!l.on) return
    if (l.streaming) {
      l.merge = l.lastQuestion
      chat.stop()
    }
    out.cancel()
    l.paused = false
    l.quiet = 0
    l.turn = "listening"
    setLivePaused(false)
    if (l.muted) {
      l.muted = false
      setLiveMuted(false)
    }
    setTimeout(() => listenAgainRef.current(), 150)
  }, [chat, out])

  // what the orb shows: Bridge thinking or speaking comes first — the mic may be open meanwhile, ready for you
  const mood: AssistantMood =
    chat.status === "thinking" ? "thinking" : out.speaking || chat.status === "streaming" ? "speaking" : input.listening ? "listening" : "idle"

  const ask = useCallback(
    (text: string) => {
      out.cancel()
      const t = text.trim()
      if (t.toLowerCase() === "/help") {
        chat.addLocal("/help", helpText(user?.role))
        return
      }
      if (t.toLowerCase() === "/history") {
        setHistoryOpen(true)
        return
      }
      if (t.toLowerCase() === "/live") {
        startLive()
        return
      }
      chat.send(t)
    },
    [chat, out, user?.role, startLive]
  )

  const stopAll = useCallback(() => {
    chat.stop()
    out.cancel()
  }, [chat, out])

  const reset = useCallback(() => {
    out.cancel()
    chat.reset()
  }, [chat, out])

  const firstName = user?.first_name || user?.username || ""

  return {
    user,
    chat,
    mood,
    ask,
    stopAll,
    reset,
    input,
    out,
    speakReplies,
    setSpeakReplies,
    firstName,
    onListeningEnd,
    historyOpen,
    setHistoryOpen,
    live: { on: live, paused: livePaused, muted: liveMuted, heard: liveHeard, said: liveSaid, start: startLive, end: endLive, toggleMute: toggleLiveMute, tap: liveTap },
  }
}
export type Bridge = ReturnType<typeof useBridge>

/** The room Bridge lives in: the site's double-border card, with a haze that follows light / dark mode. */
export const BRIDGE_ROOM = "glass-card bridge-room"


/* ───────────────────────── empty state: the orb and a greeting ───────────────────────── */

export function BridgeWelcome({ bridge }: { bridge: Bridge }) {
  const { firstName, mood } = bridge
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      {/* a soft halo so the orb sits *in* the room rather than on it */}
      <div className="relative">
        <div aria-hidden className="absolute inset-[-18%] rounded-full bg-[radial-gradient(closest-side,oklch(0.75_0.12_295/0.35),transparent)] blur-xl dark:bg-[radial-gradient(closest-side,oklch(0.55_0.2_295/0.45),transparent)]" />
        <AssistantOrb mood={mood} className="relative w-[10rem]" />
      </div>
      <h2 className="mt-3 animate-in text-[28px] leading-[1.05] font-medium tracking-[-0.035em] duration-500 fill-mode-both fade-in-0 slide-in-from-bottom-2">
        {firstName ? `Hey ${firstName},` : "Hi, I'm Bridge."}
        <br />
        <span className="font-display tracking-[-0.01em] text-[oklch(0.5_0.17_285)] italic dark:text-[oklch(0.8_0.11_292)]">how can I help today?</span>
      </h2>
      <p className="mt-3 max-w-[17rem] animate-in text-[14px] leading-relaxed text-muted-foreground delay-150 duration-500 fill-mode-both fade-in-0">
        Ask about internships, your skills, your profile or interviews — by typing or by voice.
      </p>
    </div>
  )
}

/* ───────────────────────── the conversation ───────────────────────── */

/** While Bridge thinks: React Bits' LatticeLoader with a live timer. */
function Thinking() {
  return (
    <div className="py-1">
      <LatticeLoader status="working" label="Thinking" pattern="orbit" grid={3} shape="round" color="var(--c-violet)" cellSize={2.5} gap={1} fontSize={11.5} step={90} idleOpacity={0.15} showTimer className="text-muted-foreground" />
    </div>
  )
}

/** Bridge's mark at rest: a tiny glass sphere in the orb's violets (pure CSS — no animation, no WebGL). */
function StillOrb({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "block size-[22px] rounded-full",
        "bg-[radial-gradient(circle_at_34%_28%,#fff_0%,#f3edff_14%,transparent_32%),radial-gradient(circle_at_50%_62%,#c084fc_0%,#8b5cf6_34%,#6366f1_62%,#3730a3_100%)]",
        "shadow-[inset_0_-2px_4px_rgba(49,24,120,0.45),inset_0_1px_1px_rgba(255,255,255,0.7),0_0_0_1px_rgba(99,70,200,0.18),0_3px_8px_-3px_rgba(110,60,230,0.55)]",
        className
      )}
    />
  )
}

/** A soft progressive blur at the top or bottom edge of the chat (see .bridge-blur in globals.css). */
export function EdgeBlur({ side, className }: { side: "top" | "bottom"; className?: string }) {
  return (
    <div aria-hidden className={cn("bridge-blur", side === "top" ? "bridge-blur-top" : "bridge-blur-bottom", className)}>
      <i />
      <i />
      <i />
      <i />
    </div>
  )
}

function Message({ m, live, onRetry }: { m: ChatMsg; live?: AssistantMood; onRetry?: () => void }) {
  if (m.role === "user") {
    return (
      <div data-mid={m.id} className="flex animate-in justify-end duration-200 fade-in-0 slide-in-from-bottom-1">
        <p className="glass-card tint tone-violet max-w-[85%] rounded-[var(--r)] px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-(--t-fg) [--r:22px]">
          {m.content}
        </p>
      </div>
    )
  }
  return (
    <div className="animate-in duration-200 fade-in-0">
      {/* the signature: a live orb while Bridge thinks, which settles into a still one; the name in the site's serif */}
      <div className="mb-2 flex h-7 items-center gap-2.5">
        <span aria-hidden className="relative grid size-[22px] shrink-0 place-items-center">
          <StillOrb className={cn("absolute inset-0 transition-[opacity,transform] duration-300 ease-[var(--ease-out)]", live ? "scale-75 opacity-0" : "scale-100 opacity-100")} />
          {live && <AssistantOrb mood={live} className="absolute w-9 animate-in duration-200 fade-in-0 zoom-in-75" />}
        </span>
        <span className="font-display bg-[linear-gradient(100deg,oklch(0.45_0.2_285),oklch(0.55_0.21_315))] bg-clip-text pr-0.5 text-[18px] leading-none tracking-[-0.01em] text-transparent italic dark:bg-[linear-gradient(100deg,oklch(0.85_0.1_290),oklch(0.82_0.12_330))]">
          Bridge
        </span>
        {m.thoughtMs !== undefined && m.thoughtMs >= 100 && !live && !m.error && (
          <span className="animate-in text-[12px] text-muted-foreground/80 tabular-nums duration-300 fade-in-0">
            · thought for {(m.thoughtMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>
      {m.error ? (
        // the whole answer failed: a calm card that explains, with Try again
        <ErrorCard kind={m.errorKind ?? "generic"} message={m.content || undefined} onRetry={onRetry} />
      ) : (
        <div className="text-[15px] leading-relaxed text-foreground/85">
          {m.content ? <Markdown text={m.content} /> : <Thinking />}
          {/* part of the answer arrived, then it was cut off or stopped */}
          {m.content && (m.partial || m.stopped) && <CutShortNote kind={m.stopped ? "stopped" : (m.errorKind ?? "generic")} onRetry={onRetry} />}
        </div>
      )}
    </div>
  )
}

/**
 * The message list. When you send something, your message glides to the top and the answer writes itself
 * in underneath — the view never chases the text down while Bridge is still typing.
 * `topInset` is how far the frosted header overlaps the top of the list.
 */
// breathing room between the header's blur and the question it settles under
const GAP = 22

export function BridgeThread({ bridge, className, topInset = 0 }: { bridge: Bridge; className?: string; topInset?: number }) {
  const { messages } = bridge.chat
  const box = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const spacer = useRef<HTMLDivElement>(null)
  const anchored = useRef<string | null>(null)
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.id ?? null
  // the live orb shows only while Bridge is thinking; once the answer starts it settles into the still orb
  const live = messages.length > 0 && messages[messages.length - 1].role === "assistant" && bridge.mood === "thinking"

  useLayoutEffect(() => {
    const el = box.current
    const content = list.current
    const pad = spacer.current
    if (!el || !content || !pad) return
    const u = lastUser ? content.querySelector<HTMLElement>(`[data-mid="${lastUser}"]`) : null
    if (!u) {
      pad.style.height = "0px"
      return
    }
    const top = (n: HTMLElement) => n.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop
    // room below the latest question so it can sit at the top while the answer grows under it
    const below = top(content) + content.offsetHeight - top(u)
    pad.style.height = `${Math.max(0, el.clientHeight - topInset - GAP - below)}px`
    if (anchored.current !== lastUser) {
      anchored.current = lastUser
      el.scrollTo({ top: top(u) - topInset - GAP, behavior: "smooth" })
    }
  }, [messages, lastUser, topInset])

  return (
    <div ref={box} className={cn("overflow-y-auto overscroll-contain [scrollbar-width:thin]", className)} style={{ paddingTop: topInset }}>
      <div ref={list} className="space-y-7" role="log" aria-live="polite">
        {messages.map((m, i) => (
          <Message key={m.id} m={m} live={live && i === messages.length - 1 ? bridge.mood : undefined} onRetry={m.role === "assistant" && !m.local && i === messages.length - 1 ? () => bridge.chat.retry(m.id) : undefined} />
        ))}
      </div>
      <div ref={spacer} aria-hidden />
    </div>
  )
}

/* ───────────────────────── composer ───────────────────────── */

// mic and send: the same 40px circle, so the row reads as a pair
// how far VoicePill (size 40, reach 8, timer + waveform) opens to the left of its button
const PILL_REACH = 8 + (Math.round(Math.round(40 * 0.36) * 2.5) + 4) + Math.round(40 * 1.9)
// room left of the open pill for the red × bubble
const CANCEL_SLOT = 56
// how long the closing animation runs before the room folds back
const CLOSE_MS = 480
const ROUND = "relative flex size-10 shrink-0 items-center justify-center rounded-full outline-none transition-[background-color,color,transform,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-ring active:scale-90"

export function BridgeComposer({ bridge, compact, autoFocus }: { bridge: Bridge; compact?: boolean; autoFocus?: boolean }) {
  const { chat, input, ask, stopAll, out, speakReplies, setSpeakReplies } = bridge
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { language } = useVoicePrefs()
  const { resolvedTheme } = useTheme()
  // VoicePill draws its waveform on a canvas, so it needs real colours rather than CSS variables
  const pill =
    resolvedTheme === "dark"
      ? { accent: "#e4dcff", icon: "#b4adc8", bg: "#2b2640", cancelBg: "#4a1f2b", cancelFg: "#fda4af", cancelRing: "rgba(251,113,133,0.35)" }
      : { accent: "#5b3fd6", icon: "#6b6880", bg: "#efebfb", cancelBg: "#ffe4e6", cancelFg: "#e11d48", cancelRing: "rgba(225,29,72,0.28)" }
  const [text, setText] = useState("")
  const area = useRef<HTMLTextAreaElement>(null)
  const busy = chat.status !== "idle" || out.speaking

  // the mic area's look runs on its own timeline (open -> closing -> idle) so closing can play out smoothly
  const [micOpen, setMicOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const pillOpen = useRef(false)
  const micArea = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const beginClose = useCallback(() => {
    setMicOpen(false)
    setClosing(true)
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setClosing(false), CLOSE_MS)
  }, [])
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    },
    []
  )
  // close the pill with its own animation (it closes on Escape): used by the × and when listening ends by itself
  const closePill = useCallback(() => {
    const btn = micArea.current?.querySelector<HTMLButtonElement>('button[aria-label="Talk to Bridge"]')
    if (btn && pillOpen.current) btn.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    else beginClose()
  }, [beginClose])
  const { onListeningEnd } = bridge
  useEffect(
    () =>
      onListeningEnd(() => {
        if (pillOpen.current) closePill()
      }),
    [onListeningEnd, closePill]
  )

  // grow with the text, up to a few lines
  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${Math.min(el.scrollHeight, compact ? 120 : 168)}px`
  }, [text, compact])

  // typing "/" opens a tiny command menu (just /help for now); Enter runs the command it shows
  const typed = text.trim().toLowerCase()
  const commands = !input.listening && typed.startsWith("/") ? COMMANDS.filter((c) => c.name.startsWith(typed)) : []

  const submit = () => {
    if (!text.trim() || chat.status !== "idle") return
    ask(commands.length ? commands[0].name : text)
    setText("")
  }

  return (
    <div>
      {commands.length > 0 ? (
        <div role="listbox" aria-label="Commands" className="dbl bridge-glass mb-2 animate-in rounded-[var(--r)] border border-(--hairline) p-1 duration-150 [--r:16px] fade-in-0 slide-in-from-bottom-1">
          {commands.map((c) => (
            <button
              key={c.name}
              type="button"
              role="option"
              aria-selected
              onClick={() => {
                ask(c.name)
                setText("")
              }}
              className="flex w-full items-center gap-3 rounded-[12px] bg-foreground/[0.04] px-3 py-2 text-left transition-colors hover:bg-foreground/[0.07]"
            >
              <span className="font-mono text-[13px] font-semibold text-[oklch(0.5_0.17_285)] dark:text-[oklch(0.8_0.11_292)]">{c.name}</span>
              <span className="text-[13px] text-muted-foreground">{c.hint}</span>
              <span className="ml-auto text-[11px] text-muted-foreground/70">Enter ↵</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mb-2 px-3 text-[12px] text-muted-foreground">
          Type{" "}
          <button
            type="button"
            onClick={() => ask("/help")}
            className="rounded-md bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-foreground/80 transition-colors hover:bg-foreground/10"
          >
            /help
          </button>{" "}
          to see what I can do
        </p>
      )}
      {/* the site's field: outer hairline + an inset bezel (the double border) */}
      <div
        className={cn(
          "dbl bridge-glass flex items-end gap-1.5 rounded-[var(--r)] border p-1.5 pl-4 [--r:24px] transition-[border-color,box-shadow] duration-200",
          "shadow-[0_1px_2px_oklch(0.2_0.03_280/0.05),0_16px_34px_-22px_oklch(0.25_0.08_285/0.35)]",
          input.listening
            ? "border-[oklch(0.56_0.15_280/0.7)] shadow-[0_0_0_4px_oklch(0.56_0.15_280/0.14)]"
            : "border-(--hairline) focus-within:border-[oklch(0.56_0.15_280/0.6)] focus-within:shadow-[0_0_0_4px_oklch(0.56_0.15_280/0.12)]"
        )}
      >
        <div className="relative min-w-0 flex-1">
        <textarea
          ref={area}
          rows={1}
          value={input.listening ? input.interim : text}
          readOnly={input.listening}
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          aria-label={micOpen ? "Listening" : "Message Bridge"}
          className="relative z-[1] block min-h-10 w-full resize-none bg-transparent py-2.5 text-[15px] leading-snug text-foreground outline-none"
        />
        {/* placeholder that crossfades between "Ask Bridge anything…" and "Listening…" instead of swapping */}
        {!(input.listening ? input.interim : text) && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 grid items-center text-[15px] text-muted-foreground/70">
            <span
              className="[grid-area:1/1] whitespace-nowrap transition-[opacity,filter,transform] duration-300 ease-[var(--ease-out)]"
              style={{ opacity: micOpen ? 0 : 1, filter: micOpen ? "blur(3px)" : "none", transform: micOpen ? "translateY(-3px)" : "none" }}
            >
              Ask Bridge anything…
            </span>
            <span
              className="[grid-area:1/1] whitespace-nowrap transition-[opacity,filter,transform] duration-300 ease-[var(--ease-out)]"
              style={{ opacity: micOpen ? 1 : 0, filter: micOpen ? "none" : "blur(3px)", transform: micOpen ? "none" : "translateY(3px)" }}
            >
              Listening…
            </span>
          </span>
        )}
        </div>
        {input.supported && (
          <>
            {/* The pill, plus a red × that buds out of its left end while recording — the same gooey
                "cell division" as the sign-up page's back button: a circle swells out of the pill, a neck
                stretches between them under an SVG goo filter, thins and snaps; then the crisp real button
                fades in where the circle landed and the goo fades away.
                Closing runs it backwards: the × melts into its bubble, the bubble glides right and is absorbed
                into the mic as the pill folds shut — and only then does the room fold back. */}
            <div
              ref={micArea}
              data-bridge-mic=""
              className="relative shrink-0 transition-[padding] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
              style={{ paddingLeft: micOpen || closing ? PILL_REACH + CANCEL_SLOT : 0 }}
            >
              <style>{"@keyframes bridge-goo-open{0%,72%{opacity:1}100%{opacity:0}}@keyframes bridge-goo-close{0%,80%{opacity:1}100%{opacity:0}}"}</style>
              <svg aria-hidden width="0" height="0" className="absolute">
                <defs>
                  <filter id="bridge-goo" colorInterpolationFilters="sRGB">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
                    <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" />
                  </filter>
                </defs>
              </svg>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 left-0 motion-reduce:hidden"
                style={{
                  filter: "url(#bridge-goo)",
                  opacity: 0,
                  animation: micOpen ? "bridge-goo-open 1050ms linear both" : closing ? `bridge-goo-close ${CLOSE_MS}ms linear both` : "none",
                }}
              >
                {/* stand-ins the bubble merges with: the pill's left end (opening) and the mic button (closing) */}
                <span className="absolute top-0 size-10 rounded-full" style={{ right: PILL_REACH, background: pill.bg, opacity: closing ? 0 : 1 }} />
                <span className="absolute top-0 right-0 size-10 rounded-full" style={{ background: pill.bg, opacity: closing ? 1 : 0 }} />
                <span
                  className="absolute size-[34px] rounded-full"
                  style={{
                    top: 3,
                    right: PILL_REACH + 3,
                    background: pill.cancelBg,
                    transform: micOpen
                      ? `translateX(-${CANCEL_SLOT - 6}px) scale(1)`
                      : closing
                        ? `translateX(${PILL_REACH}px) scale(0.5)`
                        : "translateX(0) scale(0.55)",
                    transition: micOpen
                      ? "transform 640ms cubic-bezier(0.34, 1.3, 0.64, 1) 140ms"
                      : closing
                        ? `transform ${CLOSE_MS - 60}ms cubic-bezier(0.55, 0, 0.25, 1) 60ms`
                        : "none",
                  }}
                />
              </div>
              <button
                type="button"
                onClick={closePill}
                aria-label="Cancel recording"
                tabIndex={micOpen ? 0 : -1}
                aria-hidden={!micOpen}
                className="absolute z-[2] flex size-[34px] items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 active:scale-90"
                style={{
                  top: 3,
                  right: PILL_REACH + 3 + CANCEL_SLOT - 6,
                  background: pill.cancelBg,
                  color: pill.cancelFg,
                  boxShadow: `inset 0 0 0 1px ${pill.cancelRing}, 0 6px 14px -6px ${pill.cancelRing}`,
                  opacity: micOpen ? 1 : 0,
                  transform: micOpen ? "scale(1)" : "scale(0.85)",
                  pointerEvents: micOpen ? "auto" : "none",
                  transition: micOpen
                    ? "opacity 200ms ease 620ms, transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1) 620ms"
                    : "opacity 140ms ease, transform 180ms ease",
                }}
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M7 7l10 10M17 7L7 17" />
                </svg>
              </button>
              {/* React Bits' VoicePill: tap to talk (tap again to send), or hold and release; slide left to cancel.
                  It only animates the waveform — the speech recogniser is the one thing that opens the microphone.
                  Every close goes through the pill's own animated close, never a hard reset. */}
              <VoicePill
                accentColor={pill.accent}
                iconColor={pill.icon}
                background={pill.bg}
                size={40}
                shape="pill"
                reach={8}
                showTime
                waveform
                slideToCancel
                cancelDistance={64}
                attack={40}
                release={240}
                sensitivity={1}
                floor={0.1}
                openDuration={200}
                pressScale={0.95}
                mode="auto"
                holdAfter={300}
                reactive="simulated"
                ariaLabel="Talk to Bridge"
                className="relative z-[1]"
                disabled={chat.status !== "idle" && !micOpen}
                onStart={() => {
                  pillOpen.current = true
                  setClosing(false)
                  setMicOpen(true)
                  out.cancel()
                  input.start()
                }}
                onStop={({ reason }) => {
                  pillOpen.current = false
                  beginClose()
                  if (["cancel", "escape", "unmount", "disabled", "mic-denied"].includes(reason)) input.cancel()
                  else input.stop()
                }}
              />
            </div>
          </>
        )}
        {busy ? (
          <button type="button" onClick={stopAll} aria-label="Stop" className={cn(ROUND, "bg-primary text-primary-foreground")}>
            <StopIcon className="size-[17px]" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim() || input.listening}
            aria-label="Send"
            // ink circle with a fine inner ring — the double border, in miniature
            className={cn(
              ROUND,
              "bg-primary text-primary-foreground shadow-[inset_0_0_0_2px_var(--primary),inset_0_0_0_3px_color-mix(in_oklab,var(--primary-foreground)_22%,transparent)] disabled:opacity-30"
            )}
          >
            <ArrowUpIcon className="size-[18px]" />
          </button>
        )}
      </div>
      <div className={cn("mt-2 flex items-center justify-between gap-3 px-2 text-[11.5px] text-muted-foreground/80", compact && "mt-1.5")}>
        <span className="truncate">{compact ? "Bridge can make mistakes." : "Bridge can make mistakes — double-check important details."}</span>
        <span className="relative ml-auto">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
            {...VOICE_TRIGGER}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            title="Voice & language"
          >
            <GlobalIcon className="size-3.5" />
            {language.native}
          </button>
          {settingsOpen && (
            <span className="absolute right-0 bottom-[calc(100%+0.5rem)] z-30 block animate-in duration-200 fade-in-0 zoom-in-95 slide-in-from-bottom-1">
              <VoiceSettings onClose={() => setSettingsOpen(false)} />
            </span>
          )}
        </span>
        {out.supported && input.supported && (
          <button
            type="button"
            onClick={() => {
              if (speakReplies) out.cancel()
              setSpeakReplies(!speakReplies)
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            aria-pressed={speakReplies}
            title="Read spoken answers aloud"
          >
            {speakReplies ? <SpeakerIcon className="size-3.5" /> : <SpeakerOffIcon className="size-3.5" />}
            Voice {speakReplies ? "on" : "off"}
          </button>
        )}
      </div>
    </div>
  )
}
