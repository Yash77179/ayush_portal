"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { PlayIcon, StopIcon } from "@solar-icons/react/bold"
import { AltArrowLeftIcon, AltArrowRightIcon, CheckCircleIcon, CloseCircleIcon, GlobalIcon, MagnifierIcon, MicrophoneIcon } from "@solar-icons/react/linear"

import { type Voice, voicesFor, useVoicePrefs } from "@/lib/voice-prefs"
import { cn } from "cn"

type View = "home" | "language" | "voice"
type Gender = "all" | "female" | "male"

/** Put `data-voice-trigger` on the button that opens the panel, so clicking it again isn't an "outside" click. */
export const VOICE_TRIGGER = { "data-voice-trigger": "" }

/**
 * Bridge's voice settings, one step at a time: a short summary, then the language list, then the voices for that
 * language. Picking a language goes straight on to its voices; picking a voice closes the panel — no Done button.
 * Only what Speechify actually offers is listed. Remembered in this browser.
 */
export function VoiceSettings({ onClose, className }: { onClose: () => void; className?: string }) {
  const prefs = useVoicePrefs()
  const [view, setView] = useState<View>("home")
  const [back, setBack] = useState(false) // which way the views slide
  const [fromLanguage, setFromLanguage] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  const go = (next: View, goingBack = false) => {
    setBack(goingBack)
    setView(next)
  }

  // a click anywhere else closes it
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (!t || root.current?.contains(t) || t.closest("[data-voice-trigger]")) return
      closeRef.current()
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [])

  return (
    <div
      ref={root}
      role="dialog"
      aria-label="Voice and language"
      className={cn(
        "glass-card flex w-[min(21.5rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[var(--r)] text-left shadow-[0_24px_60px_-24px_oklch(0.2_0.05_280/0.35)] [--r:24px]",
        className
      )}
    >
      <div
        key={view}
        className={cn("flex min-h-0 flex-col animate-in duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] fade-in-0", back ? "slide-in-from-left-3" : "slide-in-from-right-3")}
      >
        {view === "home" && (
          <Home
            prefs={prefs}
            onClose={onClose}
            onLanguage={() => go("language")}
            onVoice={() => {
              setFromLanguage(false)
              go("voice")
            }}
          />
        )}
        {view === "language" && (
          <LanguageList
            prefs={prefs}
            onBack={() => go("home", true)}
            onPick={(code) => {
              prefs.set({ lang: code })
              // natural voice off, or nothing to choose from: that's all there is to it
              if (!prefs.ai || voicesFor(code).length < 2) return onClose()
              setFromLanguage(true)
              go("voice")
            }}
          />
        )}
        {view === "voice" && (
          <VoiceList prefs={prefs} fromLanguage={fromLanguage} onBack={() => go(fromLanguage ? "language" : "home", true)} onDone={onClose} />
        )}
      </div>
    </div>
  )
}

type Prefs = ReturnType<typeof useVoicePrefs>

const ICON_BTN =
  "dbl grid size-8 shrink-0 place-items-center rounded-full border border-(--hairline) bg-card text-foreground/70 outline-none transition-[background-color,color,transform] duration-150 [--r:16px] hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-90"

function Header({ title, sub, onBack, end }: { title: string; sub?: string; onBack?: () => void; end?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
      {onBack && (
        <button type="button" onClick={onBack} aria-label="Back" className={ICON_BTN}>
          <AltArrowLeftIcon className="size-4" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15.5px] leading-tight font-semibold tracking-[-0.015em]">{title}</p>
        {sub && <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{sub}</p>}
      </div>
      {end}
    </div>
  )
}

/* ── 1. the summary ── */
function Home({ prefs, onClose, onLanguage, onVoice }: { prefs: Prefs; onClose: () => void; onLanguage: () => void; onVoice: () => void }) {
  const { language, voice, ai, set } = prefs
  return (
    <>
      <Header
        title="Voice & language"
        end={
          <button type="button" onClick={onClose} aria-label="Close" className={ICON_BTN}>
            <CloseCircleIcon className="size-[18px]" />
          </button>
        }
      />
      <div className="px-3 pb-3">
        <div className="dbl overflow-hidden rounded-[18px] border border-(--hairline) bg-foreground/[0.02] [--r:18px]">
          <Row icon={<GlobalIcon className="size-[18px]" />} label="Language" value={language.native} onClick={onLanguage} />
          <div className="mx-4 h-px bg-(--hairline)" />
          <Row
            icon={<MicrophoneIcon className="size-[18px]" />}
            label="Voice"
            value={ai ? (voice?.name ?? "—") : "Device voice"}
            onClick={onVoice}
            disabled={!ai || !voice}
          />
        </div>

        <div className="mt-2 flex items-center justify-between gap-4 rounded-[18px] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[14px] font-medium">Natural voice</p>
            <p className="text-[12px] leading-snug text-muted-foreground">{ai ? "A human-sounding AI voice" : "Using this device's built-in voice"}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={ai}
            aria-label="Natural voice"
            onClick={() => set({ ai: !ai })}
            className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200", ai ? "bg-[oklch(0.5_0.18_285)]" : "bg-foreground/20")}
          >
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]", ai ? "left-[18px]" : "left-0.5")} />
          </button>
        </div>
      </div>
    </>
  )
}

function Row({ icon, label, value, onClick, disabled }: { icon: React.ReactNode; label: string; value: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:bg-foreground/[0.05] disabled:pointer-events-none disabled:opacity-50"
    >
      <span className="text-foreground/60">{icon}</span>
      <span className="flex-1 text-[14px] font-medium">{label}</span>
      <span className="max-w-[9rem] truncate text-[14px] text-muted-foreground">{value}</span>
      <AltArrowRightIcon className="size-4 shrink-0 text-muted-foreground/70" />
    </button>
  )
}

/* ── 2. the languages ── */
function LanguageList({ prefs, onBack, onPick }: { prefs: Prefs; onBack: () => void; onPick: (code: string) => void }) {
  const { lang, languages } = prefs
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const shown = q ? languages.filter((l) => `${l.label} ${l.native} ${l.code}`.toLowerCase().includes(q)) : languages
  const list = useRef<HTMLDivElement>(null)

  // open on the language you're using
  useLayoutEffect(() => {
    list.current?.querySelector("[aria-selected='true']")?.scrollIntoView({ block: "center" })
  }, [])

  return (
    <>
      <Header title="Language" sub="Bridge listens and replies in it" onBack={onBack} />
      <div className="px-3 pb-2">
        <label className="field-surface flex h-10 items-center gap-2 rounded-full px-3.5">
          <MagnifierIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={languages.length ? `Search ${languages.length} languages` : "Loading languages…"}
            aria-label="Search languages"
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
      </div>
      <div ref={list} role="listbox" aria-label="Languages" className="h-[min(20rem,calc(100svh-16rem))] overflow-y-auto px-2 pb-2 [scrollbar-width:thin]">
        {shown.map((l) => {
          const selected = l.code === lang
          return (
            <button
              key={l.code}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onPick(l.code)}
              className={cn(
                "flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left outline-none transition-colors focus-visible:bg-foreground/[0.05]",
                selected ? "bg-[oklch(0.56_0.15_280/0.09)]" : "hover:bg-foreground/[0.04]"
              )}
            >
              <span className={cn("flex-1 truncate text-[14.5px]", selected ? "font-semibold" : "font-medium")}>{l.native}</span>
              <span className="truncate text-[12.5px] text-muted-foreground">{l.label}</span>
              <span className="grid w-4 shrink-0 place-items-center">{selected && <CheckCircleIcon className="size-4 text-[oklch(0.5_0.18_285)]" />}</span>
            </button>
          )
        })}
        {languages.length > 0 && shown.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">No language matches “{query}”.</p>}
      </div>
    </>
  )
}

/* ── 3. the voices ── */
function VoiceList({ prefs, fromLanguage, onBack, onDone }: { prefs: Prefs; fromLanguage: boolean; onBack: () => void; onDone: () => void }) {
  const { lang, language, voice, voices, set } = prefs
  const all = voicesFor(lang)
  const [gender, setGender] = useState<Gender>("all")
  const shown = gender === "all" ? all : all.filter((v) => v.gender === gender)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const player = useRef<HTMLAudioElement | null>(null)

  const stop = () => {
    player.current?.pause()
    player.current = null
    setPreviewing(null)
  }
  useEffect(() => () => player.current?.pause(), [])

  // Speechify's own sample of the voice — instant, and it uses none of your characters
  const preview = (v: Voice) => {
    if (previewing === v.id) return stop()
    stop()
    if (!v.preview) return
    setPreviewing(v.id)
    const a = new Audio(v.preview)
    player.current = a
    a.onended = a.onerror = () => setPreviewing((p) => (p === v.id ? null : p))
    a.play().catch(() => setPreviewing(null))
  }

  const pick = (v: Voice) => {
    stop()
    set({ voices: { ...voices, [lang]: v.id } })
    setPicked(v.id)
    setTimeout(onDone, 220) // long enough to see the tick
  }

  const count = (g: Gender) => (g === "all" ? all.length : all.filter((v) => v.gender === g).length)

  return (
    <>
      <Header
        title="Voice"
        sub={`${all.length} voices for ${language.native}`}
        onBack={onBack}
        end={
          fromLanguage && (
            <button type="button" onClick={onDone} className="rounded-full px-2.5 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground">
              Skip
            </button>
          )
        }
      />
      {/* female / male */}
      <div className="px-3 pb-2">
        <div role="group" aria-label="Show voices" className="dbl grid grid-cols-3 gap-1 rounded-full border border-(--hairline) bg-foreground/[0.03] p-1 [--r:999px]">
          {(["all", "female", "male"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              aria-pressed={gender === g}
              disabled={!count(g)}
              className={cn(
                "rounded-full py-1.5 text-[12.5px] font-medium capitalize transition-[background-color,color,box-shadow] duration-200 disabled:opacity-40",
                gender === g ? "bg-card text-foreground shadow-[0_1px_2px_oklch(0.2_0.03_280/0.08),inset_0_0_0_1px_var(--hairline)]" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {g} <span className="text-muted-foreground tabular-nums">{count(g)}</span>
            </button>
          ))}
        </div>
      </div>
      <ul className="h-[min(20rem,calc(100svh-16rem))] overflow-y-auto px-2 pb-2 [scrollbar-width:thin]">
        {shown.map((v) => {
          const chosen = (picked ?? voice?.id) === v.id
          return (
            <li key={v.id} className={cn("group flex items-center gap-3 rounded-[14px] px-2 py-1.5 transition-colors", chosen ? "bg-[oklch(0.56_0.15_280/0.09)]" : "hover:bg-foreground/[0.04]")}>
              <button type="button" onClick={() => pick(v)} aria-pressed={chosen} className="flex min-w-0 flex-1 items-center gap-3 rounded-[10px] py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span
                  aria-hidden
                  className={cn(
                    "dbl grid size-9 shrink-0 place-items-center rounded-full border border-(--hairline) text-[13px] font-semibold [--r:18px]",
                    v.gender === "female" ? "bg-(--violet-bg) text-(--violet-fg)" : "bg-(--blue-bg) text-(--blue-fg)"
                  )}
                >
                  {v.name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[14px]", chosen ? "font-semibold" : "font-medium")}>{v.name}</span>
                  <span className="block truncate text-[12px] text-muted-foreground capitalize">{[v.gender, ...v.tags].join(" · ")}</span>
                </span>
                {chosen && <CheckCircleIcon className="size-4 shrink-0 text-[oklch(0.5_0.18_285)]" />}
              </button>
              <button
                type="button"
                onClick={() => preview(v)}
                disabled={!v.preview}
                aria-label={previewing === v.id ? `Stop ${v.name}` : `Hear ${v.name}`}
                className={cn(ICON_BTN, "size-8 disabled:opacity-40", previewing === v.id && "bg-foreground text-background hover:bg-foreground hover:text-background")}
              >
                {previewing === v.id ? <StopIcon className="size-3" /> : <PlayIcon className="size-3" />}
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
