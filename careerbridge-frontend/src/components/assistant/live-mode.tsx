"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { MaximizeSquareIcon, MicrophoneIcon, MinimizeSquareIcon, PhoneRoundedIcon } from "@solar-icons/react/linear"

import { AssistantOrb } from "@/components/assistant/orb"
import { VOICE_TRIGGER, VoiceSettings } from "@/components/assistant/voice-settings"
import { useVoicePrefs } from "@/lib/voice-prefs"
import { GlobalIcon } from "@solar-icons/react/linear"
import type { Bridge } from "@/components/assistant/chat-view"
import type { AssistantMood } from "@/lib/assistant"
import { cn } from "cn"

/* ───────────────────────── shared bits ───────────────────────── */

/** Markdown → plain words for the live captions. */
function plain(md: string) {
  return md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`#>]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
}

type LiveState = AssistantMood | "paused" | "muted"

const STATUS: Record<LiveState, { title: string; hint: string }> = {
  listening: { title: "Listening…", hint: "Go ahead — I'll answer when you pause." },
  thinking: { title: "Thinking…", hint: "One moment." },
  speaking: { title: "Speaking…", hint: "Tap the orb to interrupt." },
  idle: { title: "Your turn", hint: "Say something, or tap the orb." },
  paused: { title: "Paused", hint: "Tap the orb when you want to talk." },
  muted: { title: "Mic is off", hint: "Unmute to keep talking." },
}

function useLiveState(bridge: Bridge): LiveState {
  const { live, mood } = bridge
  return live.muted ? "muted" : live.paused ? "paused" : mood
}

/** mm:ss since the call started. */
function useCallTimer() {
  const [start] = useState(() => Date.now())
  const [now, setNow] = useState(start)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const s = Math.max(0, Math.floor((now - start) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

// the bloom's pace follows who has the floor: calm while listening, quick while speaking, swirling while thinking
const BLOOM: Record<LiveState, { swirl: string; pulse: string; opacity: number }> = {
  listening: { swirl: "10s", pulse: "3s", opacity: 0.42 },
  thinking: { swirl: "3.2s", pulse: "2s", opacity: 0.5 },
  speaking: { swirl: "6s", pulse: "1.4s", opacity: 0.55 },
  idle: { swirl: "16s", pulse: "4.5s", opacity: 0.28 },
  paused: { swirl: "22s", pulse: "5s", opacity: 0.14 },
  muted: { swirl: "22s", pulse: "5s", opacity: 0.14 },
}

const KEYFRAMES =
  "@media (prefers-reduced-motion: reduce){.bridge-anim{animation:none!important}}" +
  "@keyframes bridge-swirl{to{transform:rotate(360deg)}}" +
  "@keyframes bridge-bloom{0%,100%{transform:scale(.92);opacity:.7}50%{transform:scale(1.06);opacity:1}}"

/**
 * The Siri-like bloom behind the orb: a blurred ring of the orb's violets, pinks and blues that turns and breathes.
 * `size` is relative to the orb it sits behind.
 */
function Bloom({ state, className, blur = "blur-2xl" }: { state: LiveState; className?: string; blur?: string }) {
  const b = BLOOM[state]
  return (
    <span aria-hidden className={cn("pointer-events-none absolute", className)} style={{ opacity: b.opacity, transition: "opacity 600ms ease" }}>
      <span
        className="bridge-anim absolute inset-0 rounded-full"
        style={{ animation: `bridge-bloom ${b.pulse} ease-in-out infinite` }}
      >
        <span
          className={cn("bridge-anim absolute inset-0 rounded-full", blur)}
          style={{
            background: "conic-gradient(from 0deg, #c4b5fd, #f9a8d4, #a5b4fc, #a5f3fc, #c4b5fd, #f5d0fe, #c4b5fd)",
            animation: `bridge-swirl ${b.swirl} linear infinite`,
          }}
        />
      </span>
    </span>
  )
}

const ROUND_BTN =
  "dbl grid shrink-0 place-items-center border border-(--hairline) outline-none transition-[background-color,color,transform] duration-150 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.92]"

function MuteGlyph({ muted, className }: { muted: boolean; className?: string }) {
  return (
    <span className="relative grid place-items-center">
      <MicrophoneIcon className={className} />
      {muted && (
        <svg aria-hidden viewBox="0 0 24 24" className="absolute size-[125%]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 4l16 16" />
        </svg>
      )}
    </span>
  )
}

/* ───────────────────────── read-along captions ───────────────────────── */

/** One word of a read-along line: said (clear), being said (clear, gently lit), or still to come (soft and blurred). */
function Word({ w, state, setRef }: { w: string; state: "said" | "now" | "next"; setRef?: (el: HTMLSpanElement | null) => void }) {
  return (
    <span
      ref={setRef}
      className={cn(
        "inline-block transition-[color,opacity,filter] duration-300 ease-out",
        state === "said" && "text-foreground/80",
        state === "now" && "text-foreground",
        state === "next" && "text-foreground/20 blur-[2.5px]"
      )}
    >
      {w}&nbsp;
    </span>
  )
}

/**
 * Keeps the last sentence on screen while the next is on its way, and remembers the one before so it can
 * dissolve out as the new one rises in.
 */
function useSentences(text: string | undefined) {
  const [cur, setCur] = useState(text ?? "")
  const [prev, setPrev] = useState<{ text: string; id: number } | null>(null)
  if (text && text !== cur) {
    // a new sentence: the current one becomes the leaving one (React's "adjust state while rendering" pattern)
    setPrev(cur ? { text: cur, id: (prev?.id ?? 0) + 1 } : null)
    setCur(text)
  }
  return { cur, prev, clearPrev: () => setPrev(null) }
}

const CAPTION_KEYFRAMES =
  "@keyframes bridge-cap-in{from{opacity:0;filter:blur(8px);transform:translateY(14px)}to{opacity:1;filter:none;transform:none}}" +
  "@keyframes bridge-cap-out{from{opacity:1;filter:none;transform:none}to{opacity:0;filter:blur(8px);transform:translateY(-16px)}}" +
  "@media (prefers-reduced-motion: reduce){.bridge-cap{animation-duration:1ms!important}}"

/**
 * Captions that follow the voice: the sentence being read aloud, each word sharpening out of a soft blur as
 * Bridge says it. When a sentence is done it drifts up and dissolves while the next one rises in.
 */
function ReadAlong({ bridge, className }: { bridge: Bridge; className?: string }) {
  const { out, live } = bridge
  const r = out.reading
  const { cur, prev, clearPrev } = useSentences(r?.text)
  if (!out.supported) {
    const said = plain(live.said)
    return said ? <p className={className}>{said.length > 240 ? `…${said.slice(-240)}` : said}</p> : null
  }
  if (!cur) return null
  const word = r && r.text === cur ? r.word : Number.MAX_SAFE_INTEGER // between sentences: keep it fully read
  return (
    <div className="relative grid">
      <style>{CAPTION_KEYFRAMES}</style>
      {prev && (
        <p
          key={`p${prev.id}`}
          aria-hidden
          onAnimationEnd={clearPrev}
          className={cn("bridge-cap pointer-events-none [grid-area:1/1] self-end", className)}
          style={{ animation: "bridge-cap-out 520ms cubic-bezier(0.4,0,0.2,1) both" }}
        >
          {prev.text}
        </p>
      )}
      <p
        key={`c${cur}`}
        className={cn("bridge-cap [grid-area:1/1] self-end", className)}
        style={{ animation: "bridge-cap-in 560ms cubic-bezier(0.22,1,0.36,1) both", animationDelay: prev ? "120ms" : "0ms" }}
      >
        {cur.split(/\s+/).map((w, i) => (
          <Word key={i} w={w} state={i < word ? "said" : i === word ? "now" : "next"} />
        ))}
      </p>
    </div>
  )
}

/**
 * The same read-along in one line (for the capsule): it glides sideways so the spoken word stays in view —
 * nothing is clipped, the line just moves with the voice. A new sentence blurs in.
 */
function ReadAlongLine({ words, word, className }: { words: string[]; word: number; className?: string }) {
  const box = useRef<HTMLSpanElement>(null)
  const track = useRef<HTMLSpanElement>(null)
  const refs = useRef<(HTMLSpanElement | null)[]>([])
  const key = words.join(" ")
  useLayoutEffect(() => {
    const b = box.current
    const t = track.current
    if (!b || !t) return
    const target = refs.current[Math.min(word, words.length - 1)]
    const end = t.scrollWidth
    // keep the current word about a third of the way in; never scroll past the end of the line
    const x = target ? Math.max(0, Math.min(target.offsetLeft - b.clientWidth * 0.32, end - b.clientWidth)) : Math.max(0, end - b.clientWidth)
    t.style.transform = `translateX(${-x}px)`
  }, [word, words])
  return (
    <span ref={box} className={cn("block overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_3%,#000_88%,transparent)]", className)}>
      <style>{CAPTION_KEYFRAMES}</style>
      <span key={key} className="bridge-cap block" style={{ animation: "bridge-cap-in 480ms cubic-bezier(0.22,1,0.36,1) both" }}>
        <span ref={track} className="inline-block whitespace-nowrap transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform">
          {words.map((w, i) => (
            <Word key={i} w={w} state={i < word ? "said" : i === word ? "now" : "next"} setRef={(el) => (refs.current[i] = el)} />
          ))}
        </span>
      </span>
    </span>
  )
}

/* ───────────────────────── full screen ───────────────────────── */

/**
 * Live mode, full screen: a hands-free conversation with Bridge, like a voice call.
 * You talk; when you pause, Bridge answers out loud (starting at its first sentence), then listens again.
 * The orb shows who has the floor — tap it to interrupt Bridge, or to resume after a pause.
 */
export function LiveStage({ bridge, onMinimize, onEnd }: { bridge: Bridge; onMinimize: () => void; onEnd: () => void }) {
  const { live, mood, input, chat } = bridge
  const state = useLiveState(bridge)
  const status = STATUS[state]
  const time = useCallTimer()
  const heard = input.listening ? input.interim : live.heard
  const failed = !!chat.messages.at(-1)?.error
  const [settings, setSettings] = useState(false)
  const prefs = useVoicePrefs()
  const { language } = prefs

  // Escape tucks the call away instead of ending it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (document.querySelector('[role="dialog"][aria-label="Voice and language"]')) setSettings(false)
      else onMinimize()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onMinimize])

  return (
    <div
      role="dialog"
      aria-label="Live conversation with Bridge"
      className="glass-card bridge-room fixed! inset-0 z-[80] flex animate-in flex-col items-center overflow-hidden rounded-none! border-0 text-center duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] fade-in-0 zoom-in-[0.97] [--r:0px] before:hidden"
    >
      <style>{KEYFRAMES}</style>
      {/* ambient light that follows the conversation, far behind everything */}
      <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 size-[min(64rem,150vw)] -translate-x-1/2 -translate-y-[58%] opacity-[0.12] dark:opacity-[0.2]">
        <Bloom state={state} className="inset-0" blur="blur-[90px]" />
      </div>

      {/* top bar: who you're with, how long, and minimise */}
      <header className="relative z-10 flex w-full items-center justify-between px-5 pt-5 sm:px-8 sm:pt-7">
        <div className="text-left">
          <p className="text-[17px] leading-tight font-semibold tracking-[-0.02em]">Live with Bridge</p>
          <p className="mt-1 flex items-center gap-2 text-[13px] text-muted-foreground tabular-nums">
            <span className="size-2 animate-pulse rounded-full bg-[#e5484d]" />
            {time}
          </p>
        </div>
        <div className="relative flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSettings((v) => !v)}
          aria-expanded={settings}
          aria-label="Voice and language"
          title="Voice & language"
          {...VOICE_TRIGGER}
          className={cn(ROUND_BTN, "inline-flex! h-11 items-center gap-2 rounded-full bg-card px-4 text-[13.5px] font-medium text-foreground/85 [--r:22px] hover:bg-secondary hover:text-foreground sm:pr-4.5")}
        >
          <GlobalIcon className="size-[18px] shrink-0 text-foreground/60" />
          <span className="hidden sm:inline">{language.native}</span>
          <span aria-hidden className="hidden h-3.5 w-px bg-(--hairline) sm:block" />
          <span className="hidden text-muted-foreground sm:inline">{prefs.ai && prefs.voice ? prefs.voice.name : "Device voice"}</span>
        </button>
        {settings && (
          <div className="absolute top-[calc(100%+0.6rem)] right-0 z-20 animate-in duration-200 fade-in-0 zoom-in-95 slide-in-from-top-1">
            <VoiceSettings onClose={() => setSettings(false)} />
          </div>
        )}
        <button type="button" onClick={onMinimize} aria-label="Minimise — keep talking while you browse" title="Minimise (Esc)" className={cn(ROUND_BTN, "size-11 rounded-full bg-card text-foreground/75 [--r:22px] hover:bg-secondary hover:text-foreground")}>
          <MinimizeSquareIcon className="size-5" />
        </button>
        </div>
      </header>

      {/* the orb, blooming */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
        <button
          type="button"
          onClick={live.tap}
          aria-label={state === "speaking" ? "Interrupt Bridge" : "Talk to Bridge"}
          className="group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bloom state={state} className="inset-[-12%]" />
          <AssistantOrb
            mood={state === "paused" || state === "muted" ? "idle" : mood}
            className={cn(
              "relative w-[min(22rem,64vw)] transition-[transform,opacity,filter] duration-700 ease-[var(--ease-out)] group-active:scale-95",
              state === "listening" && "scale-[1.03]",
              state === "speaking" && "scale-[1.06]",
              (state === "paused" || state === "muted") && "scale-95 opacity-60 saturate-50"
            )}
          />
        </button>

        <p key={state} className="mt-8 animate-in text-[clamp(1.6rem,3.4vw,2.2rem)] leading-tight font-medium tracking-[-0.03em] duration-300 fade-in-0 slide-in-from-bottom-1" aria-live="polite">
          {status.title}
        </p>
        <p className="mt-2 text-[15px] text-muted-foreground">{status.hint}</p>

        {/* captions */}
        <div className="mt-8 flex min-h-[7.5rem] w-full max-w-xl flex-col justify-end gap-3">
          {heard && <p className="text-[15px] leading-snug text-muted-foreground italic">“{heard}”</p>}
          {!failed && <ReadAlong bridge={bridge} className="text-[clamp(1.2rem,2vw,1.5rem)] leading-[1.55] font-normal tracking-[-0.012em]" />}
        </div>
      </div>

      {/* controls */}
      <div className="relative z-10 flex items-center gap-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={live.toggleMute}
          aria-pressed={live.muted}
          aria-label={live.muted ? "Unmute microphone" : "Mute microphone"}
          className={cn(ROUND_BTN, "size-16 rounded-full [--r:32px]", live.muted ? "bg-foreground text-background [--keyline-card:oklch(1_0_0/0.25)]" : "bg-card text-foreground/80 hover:bg-secondary")}
        >
          <MuteGlyph muted={live.muted} className="size-6" />
        </button>
        <button
          type="button"
          onClick={onEnd}
          aria-label="End the call"
          className="dbl inline-flex h-16 items-center gap-2.5 rounded-full border border-[#c9363b] bg-[#e5484d] pr-8 pl-7 text-[16px] font-semibold tracking-[-0.01em] text-white shadow-[0_12px_28px_-16px_rgba(229,72,77,0.9)] outline-none transition-[background-color,transform] duration-150 [--keyline-card:oklch(1_0_0/0.32)] [--r:32px] hover:bg-[#dc3e43] focus-visible:ring-2 focus-visible:ring-red-400/60 active:scale-[0.95]"
        >
          <PhoneRoundedIcon className="size-[22px] rotate-[135deg]" />
          End call
        </button>
      </div>
    </div>
  )
}

/* ───────────────────────── minimised ───────────────────────── */

/**
 * The call, tucked into a floating capsule (like a Dynamic Island) so you can keep using the portal while you talk.
 * The orb keeps blooming; the latest words scroll past; tap the capsule to bring the full screen back.
 */
export function LivePill({ bridge, onExpand, onEnd }: { bridge: Bridge; onExpand: () => void; onEnd: () => void }) {
  const { live, mood, input } = bridge
  const state = useLiveState(bridge)
  const time = useCallTimer()
  const heard = input.listening ? input.interim : ""
  const reading = bridge.out.reading

  return (
    <div
      role="region"
      aria-label="Live conversation with Bridge (minimised)"
      className="glass-card fixed! bottom-5 left-1/2 z-[80] flex w-[min(30rem,calc(100vw-1.5rem))] -translate-x-1/2 animate-in items-center gap-2 rounded-full! py-2 pr-2 pl-2 duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)] [--r:999px] fade-in-0 slide-in-from-bottom-6 zoom-in-90 sm:bottom-6"
      style={{ boxShadow: "0 1px 2px oklch(0.2 0.03 280 / 0.08), 0 24px 50px -18px oklch(0.3 0.14 285 / 0.55)" }}
    >
      <style>{KEYFRAMES}</style>
      <button type="button" onClick={onExpand} aria-label="Open the live screen" className="flex min-w-0 flex-1 items-center gap-3 rounded-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="relative grid size-12 shrink-0 place-items-center">
          <Bloom state={state} className="inset-[-14%] opacity-80" blur="blur-[8px]" />
          <AssistantOrb mood={state === "paused" || state === "muted" ? "idle" : mood} className="relative w-12" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[12px] text-muted-foreground tabular-nums">
            <span className="size-1.5 animate-pulse rounded-full bg-[#e5484d]" />
            Live · {time}
          </span>
          {reading && (state === "speaking" || state === "idle") ? (
            // Bridge talking: the line glides along with the voice, word by word
            <ReadAlongLine words={reading.text.split(/\s+/)} word={reading.word} className="text-[14.5px]" />
          ) : state === "listening" && heard ? (
            // you talking: your words, newest in view
            <ReadAlongLine words={heard.split(/\s+/)} word={heard.split(/\s+/).length} className="text-[14.5px]" />
          ) : (
            <span key={state} className="block animate-in truncate text-[14.5px] font-medium duration-300 fade-in-0">
              {STATUS[state].title}
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={live.toggleMute}
        aria-pressed={live.muted}
        aria-label={live.muted ? "Unmute microphone" : "Mute microphone"}
        className={cn(ROUND_BTN, "size-10 rounded-full [--r:999px]", live.muted ? "bg-foreground text-background" : "bg-card text-foreground/75 hover:bg-secondary")}
      >
        <MuteGlyph muted={live.muted} className="size-[18px]" />
      </button>
      <button type="button" onClick={onExpand} aria-label="Expand" className={cn(ROUND_BTN, "size-10 rounded-full bg-card text-foreground/75 [--r:999px] hover:bg-secondary")}>
        <MaximizeSquareIcon className="size-[18px]" />
      </button>
      <button
        type="button"
        onClick={onEnd}
        aria-label="End the conversation"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e5484d] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] outline-none transition-[background-color,transform] duration-150 hover:bg-[#dc3e43] focus-visible:ring-2 focus-visible:ring-red-400/60 active:scale-[0.92]"
      >
        <PhoneRoundedIcon className="size-[18px] rotate-[135deg]" />
      </button>
    </div>
  )
}
