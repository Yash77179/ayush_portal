"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

import { useAuth } from "@/contexts/auth-context"
import { takeQueuedBridge } from "@/lib/assistant"

import { HistoryIcon, NewChatIcon } from "@/components/icons"
import { AssistantOrb, MOOD_LABEL } from "@/components/assistant/orb"
import { HistoryPanel } from "@/components/assistant/history-panel"
import { LivePill, LiveStage } from "@/components/assistant/live-mode"
import { SoundwaveIcon } from "@solar-icons/react/linear"
import { BRIDGE_ROOM, BridgeComposer, BridgeThread, BridgeWelcome, EdgeBlur, useBridge } from "@/components/assistant/chat-view"
import { cn } from "cn"

/** Bridge lives only inside the signed-in app (the pages with the sidebar), never on the public website. */
const APP_ROOTS = ["/dashboard", "/internships"]

/**
 * The floating Bridge: a live orb in the corner that opens into a chat panel.
 * The panel grows out of the orb and folds back into it (same path in and out), and keeps the
 * conversation while closed. Open it from anywhere with `openAssistant(prompt?)`.
 */
export function AssistantPopup() {
  const pathname = usePathname()
  const { user } = useAuth()
  const inApp = APP_ROOTS.some((p) => pathname === p || pathname.startsWith(p + "/"))
  if (!inApp || !user || user.profile_completed === false) return null
  return <Popup />
}

function Popup() {
  const bridge = useBridge()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false) // build the panel on first open, then keep it
  const launcher = useRef<HTMLButtonElement>(null)
  const { chat, mood, ask, reset, historyOpen, setHistoryOpen, live } = bridge
  const close = () => {
    if (live.on) live.end()
    setOpen(false)
    launcher.current?.focus()
  }
  // Live mode takes over the screen (or a floating capsule) and the chat panel steps aside;
  // when the call ends, the chat comes back with the conversation in it
  const [minimized, setMinimized] = useState(false)
  const startLive = () => {
    setMinimized(false)
    live.start()
  }
  const endLive = () => {
    live.end()
    setMinimized(false)
    setMounted(true)
    setOpen(true)
  }
  const startLiveRef = useRef(startLive)
  useEffect(() => {
    startLiveRef.current = startLive
  })
  const panelOpen = open && !live.on
  // Escape closes the panel — but during a live call it belongs to the live screen (which minimises)
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = live.on ? () => {} : close
  })
  const askRef = useRef(ask)
  useEffect(() => {
    askRef.current = ask
  })

  // openAssistant("…") from anywhere on the page
  useEffect(() => {
    const onOpen = (e: Event) => {
      setMounted(true)
      setOpen(true)
      const { prompt, live } = (e as CustomEvent<{ prompt?: string; live?: boolean }>).detail ?? {}
      if (live) setTimeout(() => startLiveRef.current(), 120)
      else if (prompt) setTimeout(() => askRef.current(prompt), 120)
    }
    window.addEventListener("cb:assistant", onOpen)
    // asked for from the website (see queueBridge): open with it now that you're in
    // (read when the timer fires, not before, so an effect that runs twice can't swallow it)
    const t = setTimeout(() => {
      const queued = takeQueuedBridge()
      if (queued) onOpen(new CustomEvent("cb:assistant", { detail: queued }))
    }, 400)
    return () => {
      window.removeEventListener("cb:assistant", onOpen)
      clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      // Escape inside the mic area only stops the recording — it must not close Bridge
      if (e.key === "Escape" && !(e.target instanceof Element && e.target.closest("[data-bridge-mic]"))) closeRef.current()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const empty = chat.messages.length === 0

  return (
    <>
      {mounted && (
        <section
          role="dialog"
          aria-label="Bridge, your AI career assistant"
          aria-hidden={!panelOpen}
          inert={!panelOpen}
          data-open={panelOpen ? "" : undefined}
          className={cn(
            BRIDGE_ROOM,
            // fixed! — the double-border card classes set position: relative, which must not win here
            "fixed! z-[60] flex flex-col overflow-hidden rounded-[var(--r)] [--r:28px]",
            "shadow-[0_1px_2px_oklch(0.2_0.03_280/0.06),0_40px_80px_-30px_oklch(0.25_0.1_285/0.45)]",
            "inset-x-3 top-3 bottom-3 sm:inset-x-auto sm:top-auto sm:right-6 sm:bottom-6 sm:h-[min(680px,calc(100svh-3rem))] sm:w-[408px]",
            // grows out of the launcher in the corner, folds back into it
            "origin-bottom-right transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            "pointer-events-none translate-y-3 scale-[0.88] opacity-0 blur-[6px]",
            "data-[open]:pointer-events-auto data-[open]:translate-y-0 data-[open]:scale-100 data-[open]:opacity-100 data-[open]:blur-none",
            "motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:blur-none motion-reduce:transition-opacity"
          )}
        >
          {/* the header floats over the chat; a soft progressive blur dissolves text that slides under it */}
          <header className="absolute inset-x-0 top-0 z-10 flex items-center gap-1.5 px-5 pt-4 pb-3">
            <EdgeBlur side="top" className="inset-0 -z-10" />
            <div className="min-w-0 flex-1">
              <p className="text-[17px] leading-tight font-semibold tracking-[-0.02em]">{live.on ? "Live with Bridge" : historyOpen ? "Your chats" : "Bridge"}</p>
              <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground" aria-live="polite">
                {live.on ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 animate-pulse rounded-full bg-[#e5484d]" /> Hands-free conversation
                  </span>
                ) : historyOpen ? (
                  "Pick one to carry on"
                ) : (
                  MOOD_LABEL[mood]
                )}
              </p>
            </div>
            {!live.on && !historyOpen && (
              <button
                type="button"
                onClick={startLive}
                aria-label="Start Live mode — talk to Bridge hands-free"
                title="Live — talk hands-free  (/live)"
                className={SQUIRCLE}
              >
                <SoundwaveIcon className="size-[18px]" />
              </button>
            )}
            {!live.on && !historyOpen && !empty && (
              <button type="button" onClick={reset} aria-label="New chat" title="New chat" className={SQUIRCLE}>
                <NewChatIcon className="size-[18px]" />
              </button>
            )}
            {!live.on && (
            <button
              type="button"
              onClick={() => setHistoryOpen(!historyOpen)}
              aria-label={historyOpen ? "Back to chat" : "Chat history"}
              aria-pressed={historyOpen}
              title={historyOpen ? "Back to chat" : "History  (/history)"}
              className={cn(SQUIRCLE, historyOpen && "bg-[oklch(0.56_0.15_280/0.12)] text-[oklch(0.45_0.17_283)] dark:text-[oklch(0.85_0.1_292)]")}
            >
              <HistoryIcon className="size-[18px]" />
            </button>
            )}
            <button
              type="button"
              onClick={close}
              aria-label="Close Bridge"
              title="Close"
              className={SQUIRCLE}
            >
              <svg viewBox="0 0 24 24" className="size-[17px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
              </svg>
            </button>
          </header>

          {historyOpen ? (
            <div className="min-h-0 flex-1 animate-in pt-[72px] duration-300 fade-in-0 slide-in-from-top-2">
              <HistoryPanel bridge={bridge} onClose={() => setHistoryOpen(false)} />
            </div>
          ) : empty ? (
            <div className="flex-1 overflow-y-auto px-5 pt-16 pb-3">
              <BridgeWelcome bridge={bridge} />
            </div>
          ) : (
            <BridgeThread bridge={bridge} topInset={72} className="min-h-0 flex-1 px-5 pb-6" />
          )}

          {!historyOpen && (
            <div className="relative px-3 pb-3">
              {/* a soft fade where the chat meets the input */}
              <EdgeBlur side="bottom" className="inset-x-0 -top-10 h-10" />
              <BridgeComposer bridge={bridge} compact autoFocus={panelOpen} />
            </div>
          )}
        </section>
      )}

      {live.on && !minimized && <LiveStage bridge={bridge} onMinimize={() => setMinimized(true)} onEnd={endLive} />}
      {live.on && minimized && <LivePill bridge={bridge} onExpand={() => setMinimized(false)} onEnd={endLive} />}

      {/* the launcher: the live orb in a double-bordered ring; it folds away while the panel is open */}
      <button
        ref={launcher}
        type="button"
        onClick={() => {
          setMounted(true)
          setOpen(true)
        }}
        aria-label="Ask Bridge, your AI career assistant"
        aria-expanded={open}
        className={cn(
          "dbl group fixed! right-5 bottom-5 z-[59] flex items-center rounded-full border border-(--hairline) bg-card p-1 [--r:999px] sm:right-6 sm:bottom-6",
          "shadow-[0_1px_2px_oklch(0.2_0.03_280/0.06),0_18px_36px_-16px_oklch(0.3_0.12_285/0.5)]",
          "transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95",
          (open || live.on) && "pointer-events-none scale-75 opacity-0"
        )}
      >
        <AssistantOrb mood={open ? "idle" : mood} className="w-14" />
        <span className="max-w-0 overflow-hidden text-[14.5px] font-semibold whitespace-nowrap transition-[max-width,padding] duration-300 group-hover:max-w-[7rem] group-hover:pr-4 group-focus-visible:max-w-[7rem] group-focus-visible:pr-4">
          Ask Bridge
        </span>
      </button>
    </>
  )
}

/** Header buttons: a soft squircle (rounded square), double-bordered like the rest of the site. */
const SQUIRCLE =
  "dbl flex size-10 shrink-0 items-center justify-center rounded-[13px] border border-(--hairline) bg-card/70 text-foreground/70 outline-none backdrop-blur-sm transition-[background-color,color,transform] duration-150 [--r:13px] hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.92]"
