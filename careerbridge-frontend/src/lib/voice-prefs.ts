"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"

import { API_URL } from "@/lib/api"

/**
 * Bridge's voice settings — the language you speak (the mic listens in it, Bridge answers in it) and the natural
 * voice it answers with (chosen per language). Remembered in this browser.
 *
 * The languages and voices are exactly the ones Speechify lists for our model (GET /assistant/voices/) — nothing is
 * hard-coded here. Language names come from the browser (Intl.DisplayNames), in English and in the language itself.
 */

export type Voice = { id: string; name: string; gender: "female" | "male"; preview: string; tags: string[] }
export type Language = {
  code: string
  /** in English, with the region: "Hindi (India)" */
  label: string
  /** in the language itself: "हिन्दी" */
  native: string
  /** what the AI is told to reply in: "Hindi" */
  name: string
}
type Catalog = { languages: { code: string; voices: Voice[] }[] }

/* ── the catalogue, from the server (kept in this browser, so it's there instantly next time) ── */
const CATALOG_KEY = "bridge.voices.v1"
const EMPTY: Catalog = { languages: [] }
let catalog: Catalog | null = null
let loading = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

function readCatalog(): Catalog {
  if (catalog) return catalog
  try {
    catalog = JSON.parse(localStorage.getItem(CATALOG_KEY) || "null") ?? EMPTY
  } catch {
    catalog = EMPTY
  }
  return catalog!
}

/** Fetch the up-to-date catalogue (once per visit). */
export function loadCatalog() {
  if (loading || typeof window === "undefined") return
  loading = true
  fetch(`${API_URL}/assistant/voices/`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data: Catalog | null) => {
      if (!data?.languages?.length) {
        setTimeout(() => (loading = false), 60_000) // retried a minute later
        return
      }
      catalog = { languages: data.languages }
      resolved = null
      try {
        localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog))
      } catch {
        /* storage full or private mode: keep it for this visit */
      }
      notify()
    })
    .catch(() => setTimeout(() => (loading = false), 60_000))
}

const getCatalog = () => (typeof window === "undefined" ? EMPTY : readCatalog())

export function voicesFor(lang: string): Voice[] {
  return getCatalog().languages.find((l) => l.code === lang)?.voices ?? []
}

/* ── names, from the browser ── */
const nameCache = new Map<string, Language>()
function display(locale: string, code: string) {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code
  } catch {
    return code
  }
}
const capital = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1)

export function languageInfo(code: string): Language {
  const base = code.split("-")[0]
  // a language offered in more than one region (English, Spanish, Portuguese…) is named with its region
  const shared = getCatalog().languages.filter((l) => l.code.split("-")[0] === base).length > 1
  const key = `${code}|${shared}`
  let info = nameCache.get(key)
  if (!info) {
    info = { code, label: display("en", code), native: capital(display(code, shared ? code : base)), name: display("en", base) }
    nameCache.set(key, info)
  }
  return info
}

/** The languages Bridge can speak, sorted by their English name. */
export function languages(): Language[] {
  return getCatalog()
    .languages.map((l) => languageInfo(l.code))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** The language code the browser's speech recogniser expects (they mostly match Speechify's). */
export function recognitionLang(code: string) {
  return code === "yue-CN" ? "yue-Hant-HK" : code
}

/* ── your choices ── */
export type VoicePrefs = { lang: string; ai: boolean; /** the chosen voice id, per language */ voices: Record<string, string> }
const DEFAULTS: VoicePrefs = { lang: "en-IN", ai: true, voices: {} }
const KEY = "bridge.voice.v2"

let current: VoicePrefs | null = null
function read(): VoicePrefs {
  if (current) return current
  try {
    current = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }
  } catch {
    current = DEFAULTS
  }
  return current!
}

/** A language that isn't offered (any more): the same language in another region, else US English. */
function available(lang: string): string {
  const codes = getCatalog().languages.map((l) => l.code)
  if (!codes.length || codes.includes(lang)) return lang
  const base = lang.split("-")[0]
  return codes.find((c) => c.split("-")[0] === base) ?? (codes.includes("en-US") ? "en-US" : codes[0])
}

let resolved: { from: VoicePrefs; cat: Catalog; prefs: VoicePrefs } | null = null
export function getVoicePrefs(): VoicePrefs {
  if (typeof window === "undefined") return DEFAULTS
  const p = read()
  const cat = readCatalog()
  if (resolved?.from !== p || resolved.cat !== cat) {
    const lang = available(p.lang)
    resolved = { from: p, cat, prefs: lang === p.lang ? p : { ...p, lang } }
  }
  return resolved.prefs
}

export function setVoicePrefs(patch: Partial<VoicePrefs>) {
  current = { ...read(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* private mode: keep it for this visit */
  }
  notify()
}

/** The voice to speak `lang` with: the one you picked, or Speechify's top pick for it. */
export function voiceFor(prefs: VoicePrefs, lang = prefs.lang): Voice | null {
  const list = voicesFor(lang)
  const chosen = prefs.voices[lang]
  return list.find((v) => v.id === chosen || v.name === chosen) ?? list[0] ?? null
}

/** Call `fn` whenever the language, the voice or the catalogue changes (outside React too). */
export function onVoicePrefsChange(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useVoicePrefs() {
  const prefs = useSyncExternalStore(onVoicePrefsChange, getVoicePrefs, () => DEFAULTS)
  const cat = useSyncExternalStore(onVoicePrefsChange, getCatalog, () => EMPTY)
  useEffect(loadCatalog, [])
  const set = useCallback((patch: Partial<VoicePrefs>) => setVoicePrefs(patch), [])
  return {
    ...prefs,
    language: languageInfo(prefs.lang),
    voice: voiceFor(prefs),
    /** every language Speechify offers (empty until the catalogue has loaded) */
    languages: cat.languages.length ? languages() : [],
    set,
  }
}
