"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"

import { API_URL } from "@/lib/api"
import { getVoicePrefs, loadCatalog, onVoicePrefsChange, recognitionLang, voiceFor } from "@/lib/voice-prefs"

/**
 * Voice for Bridge, all in the browser:
 * - speech → text with the Web Speech API (Chrome, Edge, Safari),
 * - text → speech for spoken replies.
 */

/* ── speech recognition ── */
type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const subscribeNothing = () => () => {}

/** Live mode: how long a silence means "I've finished" (longer after only a few words — you may still be thinking). */
const PATIENCE_MS = 1200
const PATIENCE_SHORT_MS = 2000

const ERRORS: Record<string, string> = {
  "not-allowed": "Allow microphone access for this site to talk to Bridge.",
  "service-not-allowed": "Allow microphone access for this site to talk to Bridge.",
  "audio-capture": "No microphone was found. Check that one is connected and not used by another app.",
  network: "Voice needs an internet connection — your browser sends speech to its speech service to turn it into text.",
  "no-speech": "I didn't catch anything. Try again, a little closer to the mic.",
}

/**
 * Talk to Bridge: `start()` listens until `stop()` (send what was heard) or `cancel()` (throw it away).
 * Shows the words as you speak (`interim`), then calls `onFinal` with the text.
 * Only the speech recogniser opens the microphone — a second capture of the same mic can leave it hearing nothing.
 */
export function useSpeechInput({
  onFinal,
  onError,
  onEnd,
  onSpeech,
}: {
  onFinal: (text: string) => void
  /** words heard so far in this session, every time more arrive (Live mode uses it to notice you talking over Bridge) */
  onSpeech?: (text: string) => void
  onError?: (msg: string, code: string) => void
  /** listening ended, for any reason */
  onEnd?: () => void
}) {
  const supported = useSyncExternalStore(subscribeNothing, () => !!recognitionCtor(), () => false)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState("")
  const [sessions, setSessions] = useState(0) // counts finished listening sessions (lets the UI reset its mic control)
  const rec = useRef<Recognition | null>(null)
  const session = useRef({ final: "", live: "", cancelled: false, lang: "en-IN", patient: false, lastHeard: 0, switching: false })
  const watcher = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopWatcher = () => {
    if (watcher.current) clearInterval(watcher.current)
    watcher.current = null
  }
  const handlers = useRef({ onFinal, onError, onEnd, onSpeech })
  useEffect(() => {
    handlers.current = { onFinal, onError, onEnd, onSpeech }
  })

  const restart = useRef<() => boolean>(() => false)
  const begin = useCallback(() => {
    const Ctor = recognitionCtor()
    if (!Ctor) {
      handlers.current.onError?.("Voice input isn't supported in this browser. Try Chrome or Edge.", "unsupported")
      return false
    }
    const r = new Ctor()
    const s = session.current
    r.lang = s.lang
    // always keep the mic open through pauses: tap-to-talk waits for stop(); Live mode decides for itself when
    // you've finished (below) — the browser's own end-of-speech cuts in after a very short pause
    r.continuous = true
    r.interimResults = true
    r.onresult = (e) => {
      let live = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) s.final += res[0].transcript + " "
        else live += res[0].transcript
      }
      s.live = live
      s.lastHeard = performance.now()
      const heard = (s.final + live).replace(/\s+/g, " ").trim()
      setInterim(heard)
      handlers.current.onSpeech?.(heard)
    }
    r.onerror = (e) => {
      if (e.error === "language-not-supported" && s.lang !== "en-US") {
        s.lang = "en-US" // retry once in US English
        return
      }
      if (e.error !== "aborted") handlers.current.onError?.(ERRORS[e.error] ?? "Couldn't hear that — please try again.", e.error)
    }
    r.onend = () => {
      stopWatcher()
      rec.current = null
      // you switched language (or the browser fell back to English): carry on listening, now in the new language
      if (!s.cancelled && (s.switching || (!s.final && !s.live && r.lang !== s.lang))) {
        s.switching = false
        if (restart.current()) return
      }
      setListening(false)
      setInterim("")
      setSessions((n) => n + 1)
      handlers.current.onEnd?.()
      const text = (s.final + s.live).replace(/\s+/g, " ").trim()
      if (!s.cancelled && text) handlers.current.onFinal(text)
    }
    rec.current = r
    // Live mode: you've finished when there's been real silence after you spoke — longer if you've only said a
    // few words (you're probably still thinking). Any new word, even a half-heard one, resets the clock.
    stopWatcher()
    if (s.patient) {
      s.lastHeard = performance.now()
      watcher.current = setInterval(() => {
        const text = (s.final + s.live).trim()
        if (!text) return
        const words = text.split(/\s+/).length
        const wait = words <= 3 ? PATIENCE_SHORT_MS : PATIENCE_MS
        if (performance.now() - s.lastHeard > wait) {
          stopWatcher()
          r.stop()
        }
      }, 150)
    }
    try {
      r.start()
      return true
    } catch {
      stopWatcher()
      rec.current = null
      return false
    }
  }, [])

  useEffect(() => {
    restart.current = begin
  }, [begin])

  // You picked another language while the mic is open: drop what was heard in the old one and listen in the new
  // one straight away — same session, no tap needed.
  useEffect(
    () =>
      onVoicePrefsChange(() => {
        const s = session.current
        const lang = recognitionLang(getVoicePrefs().lang)
        if (!rec.current || s.cancelled || lang === s.lang) return
        s.lang = lang
        s.final = ""
        s.live = ""
        s.switching = true
        setInterim("")
        rec.current.abort()
      }),
    []
  )

  /**
   * Start listening. `endOnPause`: finish by itself once you've stopped talking (Live mode) — patiently, so a
   * pause to think doesn't cut you off — instead of waiting for stop().
   */
  const start = useCallback((opts: { endOnPause?: boolean } = {}) => {
    if (rec.current) return
    // listen in the language chosen in Bridge's voice settings
    session.current = { final: "", live: "", cancelled: false, lang: recognitionLang(getVoicePrefs().lang), patient: !!opts.endOnPause, lastHeard: 0, switching: false }
    setInterim("")
    if (begin()) setListening(true)
  }, [begin])

  /** Stop listening and send what was heard. */
  const stop = useCallback(() => rec.current?.stop(), [])

  /** Stop listening and throw it away (slide to cancel, Escape). */
  const cancel = useCallback(() => {
    session.current.cancelled = true
    stopWatcher()
    rec.current?.abort()
  }, [])

  useEffect(
    () => () => {
      session.current.cancelled = true
      rec.current?.abort()
    },
    []
  )

  return { supported, listening, interim, sessions, start, stop, cancel }
}

/* ── speech synthesis ── */

/** The browser's own voice for a language — natural/online voices first. Used when the AI voice isn't available. */
function pickVoice(lang: string) {
  const voices = window.speechSynthesis.getVoices()
  const base = lang.split("-")[0]
  const fits = voices.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(lang.toLowerCase()))
  const near = fits.length ? fits : voices.filter((v) => v.lang.toLowerCase().startsWith(base))
  const score = (v: SpeechSynthesisVoice) => (/natural|neural|online/i.test(v.name) ? 3 : 0) + (/google/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1)
  return [...near].sort((a, b) => score(b) - score(a))[0] ?? null
}

/** Strip Markdown so a reply reads naturally aloud. */
function plain(md: string) {
  return md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`#>]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim()
}

export type Reading = { text: string; word: number }

/** Captions run this far ahead of the voice, so a word lights as you hear it, not after. */
const LEAD_MS = 160

/** How many words of `text` come before character `charIndex`. */
function wordAt(text: string, charIndex: number) {
  const before = text.slice(0, charIndex).trim()
  return before ? before.split(/\s+/).length : 0
}

/** Where each word of `text` starts, in characters. */
function wordStarts(text: string) {
  const starts: number[] = []
  for (const m of text.matchAll(/\S+/g)) starts.push(m.index ?? 0)
  return starts
}

/**
 * A sentence in the natural voice, streamed from our server (Speechify, or Edge as its backup). Resolves with an
 * audio element as soon as it can start playing — or null, and then the device's own voice reads the sentence.
 */
function loadVoice(text: string, signal: AbortSignal): Promise<HTMLAudioElement | null> {
  const prefs = getVoicePrefs()
  const v = voiceFor(prefs)
  if (!prefs.ai || !v) return Promise.resolve(null)
  const url = `${API_URL}/assistant/tts/?` + new URLSearchParams({ text, lang: prefs.lang, voice: v.id, gender: v.gender })
  return new Promise((resolve) => {
    const a = new Audio()
    a.preload = "auto"
    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(ok ? a : null)
    }
    // a natural voice that hasn't started by now isn't worth waiting for
    const timer = setTimeout(() => done(false), 7000)
    a.addEventListener("canplay", () => done(true), { once: true })
    a.addEventListener("error", () => done(false), { once: true })
    signal.addEventListener("abort", () => {
      a.removeAttribute("src")
      done(false)
    })
    a.src = url
    a.load()
  })
}

type Item = { text: string; ctl: AbortController; audio: Promise<HTMLAudioElement | null> | null }

/**
 * The speech queue, as a plain object (created once per hook): sentences are fetched in the AI voice as soon as
 * they're queued and spoken in order; captions follow the audio's own clock. Falls back to the browser's voice.
 */
function createSpeechEngine(out: {
  setSpeaking: (on: boolean) => void
  setReading: (fn: (r: Reading | null) => Reading | null) => void
}) {
  let onDrain: (() => void) | undefined
  const queue: Item[] = []
  let playing = false
  let generation = 0 // bumps on cancel, so anything from cancelled speech is ignored
  let current: Item | null = null // the sentence being said
  const voiceKey = () => {
    const p = getVoicePrefs()
    return `${p.ai}|${p.lang}|${voiceFor(p)?.id ?? ""}`
  }
  let loadedWith = ""
  let audio: HTMLAudioElement | null = null
  let frame = 0
  let ticker: ReturnType<typeof setInterval> | null = null
  let pace = 15.5 // the browser voice's characters a second, refined as it speaks

  const stopTimers = () => {
    cancelAnimationFrame(frame)
    if (ticker) clearInterval(ticker)
    ticker = null
  }

  const lightTo = (text: string, starts: number[], ch: number) => {
    let w = 0
    while (w + 1 < starts.length && starts[w + 1] <= ch) w++
    out.setReading((r) => (r && r.text === text && r.word !== w ? { text, word: w } : r))
  }

  /** The browser's built-in voice, in the chosen language. */
  function browserSay(text: string, gen: number, starts: number[], finish: () => void) {
    if (!("speechSynthesis" in window)) return finish()
    const { lang } = getVoicePrefs()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    const v = pickVoice(lang)
    if (v) u.voice = v
    u.rate = 1.03
    let heardBoundary = false
    let startedAt = 0
    u.onstart = () => {
      if (gen !== generation) return
      startedAt = performance.now()
      out.setReading(() => ({ text, word: 0 }))
      // voices that don't report word boundaries: estimate from the measured speed, a touch ahead
      ticker = setInterval(() => {
        if (heardBoundary || gen !== generation) return
        lightTo(text, starts, ((performance.now() - startedAt + LEAD_MS) / 1000) * pace)
      }, 50)
    }
    u.onboundary = (e: SpeechSynthesisEvent) => {
      if (gen !== generation || (e.name && e.name !== "word")) return
      heardBoundary = true
      out.setReading(() => ({ text, word: wordAt(text, e.charIndex) }))
    }
    const done = () => {
      const secs = (performance.now() - startedAt) / 1000
      if (startedAt && secs > 0.6 && text.length > 12) pace = pace * 0.5 + (text.length / secs) * 0.5
      finish()
    }
    u.onend = done
    u.onerror = done
    window.speechSynthesis.speak(u)
  }

  async function playNext() {
    const gen = generation
    const item = queue.shift()
    current = item ?? null
    if (!item) {
      playing = false
      out.setSpeaking(false)
      onDrain?.()
      return
    }
    playing = true
    const { text } = item
    const total = text.split(/\s+/).length
    const starts = wordStarts(text)
    const finish = () => {
      if (gen !== generation) return
      stopTimers()
      out.setReading((r) => (r && r.text === text ? { text, word: total } : r))
      playNext()
    }

    const a = item.audio ? await item.audio : null
    if (gen !== generation) return
    if (!a) return browserSay(text, gen, starts, finish)

    // the natural voice: captions follow the audio's own clock, so they stay in step with what you hear
    audio = a
    const follow = () => {
      if (gen !== generation) return
      // while it's still streaming the length isn't known yet: go by a typical speaking pace until it is
      const ch = a.duration && isFinite(a.duration) ? ((a.currentTime + LEAD_MS / 1000) / a.duration) * text.length : (a.currentTime + LEAD_MS / 1000) * 14
      lightTo(text, starts, ch)
      frame = requestAnimationFrame(follow)
    }
    a.onplay = () => {
      out.setReading(() => ({ text, word: 0 }))
      frame = requestAnimationFrame(follow)
    }
    a.onended = finish
    a.onerror = () => browserSay(text, gen, starts, finish)
    a.play().catch(() => browserSay(text, gen, starts, finish))
  }

  return {
    /** what to do when everything queued has been said */
    setOnDrain(fn: (() => void) | undefined) {
      onDrain = fn
    },
    enqueue(raw: string) {
      const text = plain(raw)
      if (!text) return
      // start loading the audio now, so it's ready by the time the sentence before it has been said
      const ctl = new AbortController()
      loadedWith = voiceKey()
      queue.push({ text, ctl, audio: loadVoice(text, ctl.signal) })
      out.setSpeaking(true)
      if (!playing) playNext()
    },
    /**
     * The language or voice was changed while speaking: the sentence being said finishes, and everything after it
     * is loaded again in the new voice.
     */
    voiceChanged() {
      const key = voiceKey()
      if (key === loadedWith) return
      loadedWith = key
      for (const item of queue) {
        item.ctl.abort()
        item.ctl = new AbortController()
        item.audio = loadVoice(item.text, item.ctl.signal)
      }
    },
    /** Forget what's still to come, but let the sentence being said finish. */
    dropPending() {
      for (const item of queue) item.ctl.abort()
      queue.length = 0
    },
    cancel() {
      generation++
      for (const item of queue) item.ctl.abort()
      current?.ctl.abort()
      current = null
      queue.length = 0
      playing = false
      stopTimers()
      if (audio) {
        audio.pause()
        audio = null
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
      out.setSpeaking(false)
      out.setReading(() => null)
    },
  }
}

/**
 * Spoken replies, in a natural AI voice (with the browser's own voice as the fallback).
 * `enqueue(text)` adds a sentence: its audio is fetched straight away (so the next sentence is ready while this
 * one plays) and sentences are spoken in order. `reading` follows the voice word by word, for read-along captions.
 * `onDrain` runs when everything queued has been said.
 */
export function useSpeechOutput({ onDrain }: { onDrain?: () => void } = {}) {
  const supported = useSyncExternalStore(subscribeNothing, () => typeof window !== "undefined" && ("speechSynthesis" in window || "Audio" in window), () => false)
  const [speaking, setSpeaking] = useState(false)
  const [reading, setReading] = useState<Reading | null>(null)
  const [engine] = useState(() => createSpeechEngine({ setSpeaking, setReading }))
  useEffect(() => {
    engine.setOnDrain(onDrain)
  })
  // have the voice list ready before Bridge first speaks
  useEffect(loadCatalog, [])
  // a new voice or language picked mid-answer: the rest of the answer is said in it
  useEffect(() => onVoicePrefsChange(() => engine.voiceChanged()), [engine])

  const enqueue = useCallback((text: string) => engine.enqueue(text), [engine])
  const dropPending = useCallback(() => engine.dropPending(), [engine])
  const cancel = useCallback(() => engine.cancel(), [engine])
  const speak = useCallback(
    (text: string) => {
      engine.cancel()
      engine.enqueue(text)
    },
    [engine]
  )
  useEffect(() => () => engine.cancel(), [engine])
  return { supported, speaking, reading, speak, enqueue, dropPending, cancel }
}
