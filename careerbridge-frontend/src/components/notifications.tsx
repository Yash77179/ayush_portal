"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "cn"

import { useAuth } from "@/contexts/auth-context"
import { getNotifications, markNotificationsRead, timeAgo, type AppNotification } from "@/lib/ats"
import {
  ApplicationsIcon,
  BellIcon,
  BuildingsIcon,
  CalendarIcon,
  CheckCircleIcon,
  GraduateIcon,
  MegaphoneIcon,
  PeopleIcon,
  SettingsIcon,
  TrophyIcon,
  VerifiedIcon,
} from "@/components/icons"
import { MailIcon } from "@/components/icons"

/* ── A tiny shared store so the header bell and the sidebar row agree on the unread count ── */
type Snapshot = { unread: number; items: AppNotification[]; loaded: boolean }
let snapshot: Snapshot = { unread: 0, items: [], loaded: false }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
let inflight: Promise<void> | null = null

async function refresh() {
  if (inflight) return inflight
  inflight = getNotifications()
    .then((d) => {
      snapshot = { unread: d.unread, items: d.results, loaded: true }
      emit()
    })
    .catch(() => {})
    .finally(() => {
      inflight = null
    })
  return inflight
}

function useNotifications(enabled: boolean) {
  const snap = React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => snapshot,
    () => snapshot
  )
  React.useEffect(() => {
    if (!enabled) return
    refresh()
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 60_000)
    const onFocus = () => refresh()
    window.addEventListener("focus", onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener("focus", onFocus)
    }
  }, [enabled])
  return snap
}

async function markRead(ids?: number[]) {
  snapshot = {
    ...snapshot,
    items: snapshot.items.map((n) => (!ids || ids.includes(n.id) ? { ...n, is_read: true } : n)),
    unread: ids ? Math.max(0, snapshot.unread - snapshot.items.filter((n) => ids.includes(n.id) && !n.is_read).length) : 0,
  }
  emit()
  await markNotificationsRead(ids).catch(() => refresh())
}

/** Unread count for anything that wants to show a dot (e.g. the sidebar row). */
export function useUnreadNotifications() {
  const { user } = useAuth()
  return useNotifications(!!user).unread
}

const KIND: Record<string, { icon: React.ReactNode; tone: string; label: string }> = {
  status: { icon: <ApplicationsIcon />, tone: "tone-violet", label: "Application" },
  applicant: { icon: <PeopleIcon />, tone: "tone-blue", label: "New applicant" },
  interview: { icon: <CalendarIcon />, tone: "tone-blue", label: "Interview" },
  offer: { icon: <TrophyIcon />, tone: "tone-mint", label: "Offer" },
  drive: { icon: <GraduateIcon />, tone: "tone-amber", label: "Campus drive" },
  announcement: { icon: <MegaphoneIcon />, tone: "tone-peach", label: "Announcement" },
  verification: { icon: <VerifiedIcon />, tone: "tone-mint", label: "Verification" },
  team: { icon: <BuildingsIcon />, tone: "tone-sage", label: "Team" },
  message: { icon: <MailIcon />, tone: "tone-violet", label: "Message" },
  system: { icon: <SettingsIcon />, tone: "tone-mist", label: "System" },
}

const TABS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "hiring", label: "Hiring", kinds: ["status", "applicant", "interview", "offer", "message"] },
  { id: "campus", label: "Campus", kinds: ["drive", "announcement", "verification"] },
] as const
type TabId = (typeof TABS)[number]["id"]

/* ── Panel ───────────────────────────────────────────────────────────────── */
export function NotificationsMenu({ className }: { className?: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const { unread, items, loaded } = useNotifications(!!user)
  const [open, setOpenState] = React.useState(false)
  const [tab, setTab] = React.useState<TabId>("all")
  const rootRef = React.useRef<HTMLDivElement>(null)

  // Stay mounted while the closing animation plays, then unmount.
  const [mounted, setMounted] = React.useState(false)
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const setOpen = React.useCallback((next: boolean) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpenState(next)
    if (next) {
      setMounted(true)
      refresh()
    } else {
      closeTimer.current = setTimeout(() => setMounted(false), 300)
    }
  }, [])
  React.useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  React.useEffect(() => {
    const openIt = () => setOpen(true)
    window.addEventListener("cb:notifications", openIt)
    return () => window.removeEventListener("cb:notifications", openIt)
  }, [setOpen])

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, setOpen])

  const def = TABS.find((t) => t.id === tab)
  const shown = items.filter((n) => {
    if (tab === "unread") return !n.is_read
    if (def && "kinds" in def) return (def.kinds as readonly string[]).includes(n.kind)
    return true
  })
  const fresh = shown.filter((n) => !n.is_read)
  const earlier = shown.filter((n) => n.is_read)

  const card = (n: AppNotification) => {
    const k = KIND[n.kind] ?? KIND.system
    return (
      <li key={n.id}>
        <button
          type="button"
          onClick={() => {
            if (!n.is_read) markRead([n.id])
            if (n.link) {
              setOpen(false)
              router.push(n.link)
            }
          }}
          className="w-full rounded-[26px] border border-(--hairline) bg-card p-4 text-left shadow-[0_1px_2px_oklch(0.2_0.05_280/0.04),0_14px_28px_-20px_oklch(0.2_0.06_280/0.28)] transition-transform duration-150 active:scale-[0.99]"
        >
          <div className="flex items-start gap-3.5">
            <span className={cn(k.tone, "flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-(--t-bg) text-(--t-fg) [&_svg]:size-5")}>{k.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-snug font-medium">{n.title}</p>
              {n.body && <p className="mt-0.5 line-clamp-3 text-[14px] leading-snug text-foreground/70">{n.body}</p>}
              <p className="mt-1 text-[12.5px] text-muted-foreground">{k.label}</p>
            </div>
            <span className="flex shrink-0 items-center gap-2 pt-0.5 text-[12.5px] text-muted-foreground tabular-nums">
              {!n.is_read && <span className="size-2 rounded-full bg-(--c-violet)" aria-label="Unread" />}
              {timeAgo(n.created_at)}
            </span>
          </div>
        </button>
      </li>
    )
  }

  const group = (label: string, list: AppNotification[]) =>
    list.length === 0 ? null : (
      <li key={label} className="list-none">
        <p className="mb-2.5 px-2 text-[12.5px] font-medium tracking-[0.1em] text-muted-foreground uppercase">{label}</p>
        <ul className="space-y-3">{list.map(card)}</ul>
      </li>
    )

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="glass-nav relative flex size-11 shrink-0 items-center justify-center rounded-full text-foreground/85 outline-none transition-[transform,color] duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-90 [&_svg]:size-[18px]"
      >
        <BellIcon />
        {unread > 0 && <span className="absolute top-2.5 right-3 size-2 rounded-full bg-destructive ring-2 ring-card" />}
      </button>

      {(open || mounted) && (
        <div
          role="dialog"
          aria-label="Notifications"
          data-state={open ? "open" : "closed"}
          inert={!open}
          className="absolute top-full right-0 z-50 mt-3 flex max-h-[min(42rem,calc(100svh-7rem))] w-[min(31rem,calc(100vw-2rem))] origin-top-right flex-col overflow-hidden rounded-[30px] border border-(--hairline) bg-popover text-popover-foreground shadow-[0_36px_72px_-28px_oklch(0.2_0.06_280/0.5),0_2px_6px_oklch(0.2_0.06_280/0.06)] duration-350 ease-(--ease-out) data-[state=closed]:animate-out data-[state=closed]:fill-mode-forwards data-[state=closed]:duration-250 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-0 motion-reduce:animate-none"
        >
          <span aria-hidden className="pointer-events-none absolute inset-[5px] z-20 rounded-[24px] border border-(--keyline-card)" />

          <div className="flex shrink-0 items-center justify-between gap-3 px-7 pt-6">
            <h3 className="text-[24px] font-medium tracking-[-0.025em]">Notifications</h3>
            {unread > 0 && <span className="rounded-full bg-secondary px-3 py-1 text-[13px] font-medium tabular-nums">{unread} new</span>}
          </div>

          <div role="tablist" className="mt-4 flex shrink-0 gap-6 overflow-x-auto border-b border-(--hairline) px-7">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "-mb-px shrink-0 border-b-2 pb-3.5 text-[15px] font-medium outline-none transition-colors duration-150",
                  tab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <ul className="flex-1 space-y-6 overflow-y-auto overscroll-contain bg-secondary/55 p-4 pb-5">
            {!loaded && <li className="px-4 py-14 text-center text-[15px] text-muted-foreground">Loading…</li>}
            {loaded && shown.length === 0 && (
              <li className="flex flex-col items-center gap-3 px-4 py-14 text-center text-[15px] text-muted-foreground">
                <CheckCircleIcon className="size-8" />
                You’re all caught up.
              </li>
            )}
            {group("New", fresh)}
            {group("Earlier", earlier)}
          </ul>

          <div className="flex shrink-0 items-center justify-between border-t border-(--hairline) px-7 py-4 text-[14px]">
            <button
              type="button"
              disabled={unread === 0}
              className="font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground disabled:opacity-50"
              onClick={() => markRead()}
            >
              Mark all as read
            </button>
            <span className="text-muted-foreground">{unread > 0 ? `${unread} unread` : "No unread"}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/** Open the notifications panel from anywhere (e.g. the sidebar row). */
export function openNotifications() {
  window.dispatchEvent(new Event("cb:notifications"))
}
