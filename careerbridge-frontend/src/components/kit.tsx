"use client"

/**
 * Shared building blocks — "bento" language: flat colour blocks, huge radii,
 * thin oversized numbers, slim progress bars and roadmap-style hatched bars.
 */

import * as React from "react"
import { Portrait, hasPortrait } from "@/components/portrait"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import gsap from "gsap"

import { ArrowRightIcon, ArrowRightUpIcon, PlusIcon, CameraIcon
} from "@/components/icons"
import { CountUp } from "@/components/count-up"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export type Tone =
  | "lime" | "sage" | "white" | "ink" | "mist"
  | "blue" | "mint" | "violet" | "peach" | "pink" | "amber"
const AVATAR_TONES: Tone[] = ["lime", "sage", "violet", "peach", "pink", "blue"]

/** Stagger helper: <div className="rise" style={stagger(3)} /> */
export const stagger = (i: number) => ({ "--i": i }) as React.CSSProperties

/* ── Panel: a titled flat card, optionally tinted ──────────────────────── */
export function Panel({
  title,
  action,
  tone,
  className,
  contentClassName,
  style,
  children,
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  tone?: Tone
  className?: string
  contentClassName?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  return (
    <Card className={cn("rise", tone && `tone-${tone} tint`, className)} style={style}>
      {title && (
        <CardHeader>
          <CardTitle className="text-[1.375rem] leading-tight font-medium tracking-[-0.02em] sm:text-[1.5rem]">{title}</CardTitle>
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}
      <CardContent className={cn("flex-1", contentClassName)}>{children}</CardContent>
    </Card>
  )
}

/* ── Round icon chip (white circle, like the reference) ────────────────── */
export function IconChip({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-foreground [&_svg]:size-5",
        className
      )}
    >
      {children}
    </span>
  )
}

/* ── Stat tile ─────────────────────────────────────────────────────────── */
export interface StatTileProps {
  title: string
  value: number | string
  unit?: string
  pill?: { text: string; variant?: "success" | "danger" | "info" | "warning" | "violet" | "lime" }
  caption?: string
  tone?: Tone
  icon?: React.ReactNode
  href?: string
  index?: number
  /** A share of a whole, drawn as a tick meter with the percentage marked where the fill ends. */
  meter?: { value: number; max: number }
  /** Weekly counts, oldest first, drawn as mini bars; the pill shows the last 4 weeks against the 4 before. */
  series?: number[]
  /** `series` is a running total (e.g. students linked): the pill shows growth over the whole window instead. */
  cumulative?: boolean
}

/**
 * What changed lately: the last 4 weeks against the 4 before as a percentage, or, when the earlier window is too
 * small for a percentage to mean anything (0-2), the plain count added in the last 4 weeks.
 * Running totals compare the first week with the last.
 */
type Delta = { kind: "pct"; value: number } | { kind: "count"; value: number }
function seriesDelta(s: number[], cumulative?: boolean): Delta | null {
  if (s.length < 2) return null
  const a = cumulative ? s[0] : s.slice(-8, -4).reduce((t, x) => t + x, 0)
  const b = cumulative ? s[s.length - 1] : s.slice(-4).reduce((t, x) => t + x, 0)
  if (a < 3) return b - (cumulative ? a : 0) > 0 ? { kind: "count", value: b - (cumulative ? a : 0) } : null
  return { kind: "pct", value: ((b - a) / a) * 100 }
}

function TrendPill({ delta, cumulative }: { delta: Delta; cumulative?: boolean }) {
  const up = delta.value >= 0
  const flat = delta.kind === "pct" && Math.abs(delta.value) < 0.5
  const text = flat ? "±0%" : delta.kind === "count" ? `+${delta.value} in 4 wks` : `${up ? "+" : ""}${Math.round(delta.value)}%`
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-card px-2 text-[0.75rem] font-medium tabular-nums",
        flat ? "text-muted-foreground" : up ? "text-(--mint-fg)" : "text-(--pink-fg)"
      )}
      title={cumulative ? "Growth over 12 weeks" : "Last 4 weeks vs the 4 before"}
    >
      {!flat && <ArrowRightUpIcon className={cn("size-3", !up && "rotate-90")} />}
      {text}
    </span>
  )
}

/** Weekly mini bars: older weeks soft, the last four in the tile's colour, the latest labelled. */
export function SparkBars({ data, className }: { data: number[]; className?: string }) {
  const max = Math.max(1, ...data)
  return (
    <div className={cn("relative flex h-11 items-end gap-[3px]", className)} aria-hidden>
      {data.map((v, i) => {
        const recent = i >= data.length - 4
        return (
          <span
            key={i}
            className="grow-y flex-1 origin-bottom rounded-full"
            style={
              {
                height: `${Math.max(10, (v / max) * 100)}%`,
                background: recent ? "var(--t-fg)" : "color-mix(in oklab, var(--t-fg) 26%, transparent)",
                "--i": i,
              } as React.CSSProperties
            }
          />
        )
      })}
    </div>
  )
}

/** Tick meter: filled ticks are the share, with its percentage pinned above where the fill stops. */
export function MeterTicks({ value, max, ticks = 30, className }: { value: number; max: number; ticks?: number; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const filled = Math.round((pct / 100) * ticks)
  const at = Math.min(ticks - 1, Math.max(0, filled - 1))
  return (
    <div className={cn("relative pt-5", className)} role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <span
        className="absolute top-0 text-[0.75rem] font-medium tabular-nums text-foreground/80"
        style={{ left: `${((at + 0.5) / ticks) * 100}%`, transform: `translateX(${at > ticks * 0.85 ? "-100%" : at < ticks * 0.15 ? "0" : "-50%"})` }}
      >
        {Math.round(pct)}%
      </span>
      <div className="flex h-9 items-end justify-between">
        {Array.from({ length: ticks }).map((_, i) => (
          <span
            key={i}
            className="tick w-[2px] rounded-full"
            style={
              {
                height: i === at && filled > 0 ? "100%" : "72%",
                background: i < filled ? "var(--t-fg)" : "color-mix(in oklab, var(--foreground) 13%, transparent)",
                "--i": i,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  )
}

export function StatTile({ title, value, unit, pill, caption, tone = "blue", icon, href, index = 0, meter, series, cumulative }: StatTileProps) {
  const delta = series ? seriesDelta(series, cumulative) : null
  const body = (
    <Card
      className={cn("rise tint h-full justify-between gap-4 [--card-spacing:--spacing(5)]", `tone-${tone}`, href && "lift")}
      style={stagger(index)}
    >
      <CardHeader className="items-center">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && <IconChip className="size-9 [&_svg]:size-[1.125rem]">{icon}</IconChip>}
          <CardTitle className="truncate text-[1.0625rem] leading-snug font-medium tracking-[-0.01em]">{title}</CardTitle>
        </div>
        {href && (
          <CardAction>
            <span className="flex size-8 items-center justify-center rounded-full bg-card text-foreground">
              <ArrowRightUpIcon className="size-4" />
            </span>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-[2.75rem] leading-none font-light tracking-[-0.05em] tabular-nums">
            {typeof value === "number" ? <CountUp value={value} delay={index * 40} /> : value}
          </span>
          {unit && <span className="text-[1.25rem] font-light text-muted-foreground">{unit}</span>}
          {delta && <TrendPill delta={delta} cumulative={cumulative} />}
          {pill && <Badge variant={pill.variant ?? "violet"} className="h-6 shrink-0 px-2.5 text-[0.75rem]">{pill.text}</Badge>}
        </div>
        {series && series.some((v) => v > 0) ? <SparkBars data={series} /> : meter ? <MeterTicks value={meter.value} max={meter.max} /> : null}
        {caption && <p className="truncate text-[0.875rem] text-muted-foreground">{caption}</p>}
      </CardContent>
    </Card>
  )
  return href ? (
    <Link href={href} className="block active:scale-[0.985] transition-transform duration-150">
      {body}
    </Link>
  ) : (
    body
  )
}

/* ── Slim progress bar (label left, value right) ───────────────────────── */
export function ProgressBar({
  label,
  value,
  track = "white",
  className,
}: {
  label: string
  value: number
  track?: "white" | "muted"
  className?: string
}) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={className}>
      <div className={cn("h-1.5 w-full overflow-hidden rounded-full", track === "white" ? "bg-white" : "bg-foreground/10")}>
        <div className={cn("grow-x h-full rounded-full", "bg-foreground")} style={{ width: `${v}%` }} />
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[1rem] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(v)}%</span>
      </div>
    </div>
  )
}

/* ── Chart palette (saturated, used only for data) ─────────────────────── */
const PALETTE = [
  { bg: "var(--c-sky)", fg: "oklch(0.2 0.03 240)" },
  { bg: "var(--c-yellow)", fg: "oklch(0.25 0.05 90)" },
  { bg: "var(--c-violet)", fg: "white", hatch: true },
  { bg: "var(--c-mint)", fg: "oklch(0.22 0.05 165)" },
  { bg: "var(--c-red)", fg: "white" },
] as const
const HATCH = "repeating-linear-gradient(-45deg, rgb(255 255 255 / 0.28) 0 2px, transparent 2px 6px)"

/* ── Segmented bars: slim track, two lead-in blocks, labelled fill ─────────
 * GSAP: bars sweep in one after another while their numbers count up. Hovering (or focusing) a row spotlights it:
 * it lifts forward, its share of the total slides in, and the other rows fade back. Leaving restores everyone.
 */
export function SegBars({
  data,
  suffix = "",
  emptyText = "No data yet",
  className,
}: {
  data: { label: string; value: number; tone?: number }[]
  suffix?: string
  emptyText?: string
  className?: string
}) {
  const ref = React.useRef<HTMLUListElement>(null)
  const max = Math.max(0, ...data.map((d) => d.value))
  const total = data.reduce((t, d) => t + d.value, 0)
  const key = data.map((d) => `${d.label}:${d.value}`).join("|")

  // entrance
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const ctx = gsap.context(() => {
      const fills = gsap.utils.toArray<HTMLElement>("[data-fill]")
      const nums = gsap.utils.toArray<HTMLElement>("[data-num]")
      if (reduce) return
      gsap.fromTo(fills, { scaleX: 0 }, { scaleX: 1, duration: 1.15, ease: "expo.out", stagger: 0.075, delay: 0.15 })
      gsap.fromTo(
        "[data-row]",
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.075, clearProps: "transform" }
      )
      nums.forEach((n, i) => {
        const to = Number(n.dataset.num)
        const o = { v: 0 }
        gsap.to(o, {
          v: to,
          duration: 1.1,
          ease: "power2.out",
          delay: 0.15 + i * 0.075,
          onUpdate: () => (n.textContent = String(Math.round(o.v))),
        })
      })
    }, el)
    return () => ctx.revert()
  }, [key])

  const spotlight = (i: number | null) => {
    const el = ref.current
    if (!el) return
    const rows = gsap.utils.toArray<HTMLElement>("[data-row]", el)
    rows.forEach((row, j) => {
      const on = i === j
      const dim = i !== null && !on
      gsap.to(row, { opacity: dim ? 0.28 : 1, filter: dim ? "saturate(0.35)" : "saturate(1)", duration: 0.45, ease: "power3.out", overwrite: "auto" })
      gsap.to(row.querySelector("[data-bar]"), { x: on ? 6 : 0, scaleY: on ? 1.12 : 1, duration: 0.5, ease: on ? "back.out(2.2)" : "power3.out", overwrite: "auto" })
      gsap.to(row.querySelector("[data-share]"), { autoAlpha: on ? 1 : 0, x: on ? 0 : -8, duration: on ? 0.4 : 0.2, ease: "power3.out", overwrite: "auto" })
      gsap.to(row.querySelector("[data-label]"), { color: on ? "var(--foreground)" : "var(--muted-foreground)", duration: 0.3, overwrite: "auto" })
    })
  }

  if (max === 0) {
    return <p className={cn("py-10 text-center text-sm text-muted-foreground", className)}>{emptyText}</p>
  }
  return (
    <ul ref={ref} className={cn("space-y-3", className)} onPointerLeave={() => spotlight(null)}>
      {data.map((d, i) => {
        const c = PALETTE[(d.tone ?? i) % PALETTE.length]
        const pct = (d.value / max) * 100
        const share = total ? Math.round((d.value / total) * 100) : 0
        return (
          <li
            key={d.label}
            data-row
            tabIndex={0}
            aria-label={`${d.label}: ${d.value}${suffix}, ${share}% of the total`}
            onPointerEnter={() => spotlight(i)}
            onFocus={() => spotlight(i)}
            onBlur={() => spotlight(null)}
            className="grid cursor-default grid-cols-[6.75rem_1fr] items-center gap-4 rounded-[0.875rem] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <span data-label className="truncate text-[0.9375rem] text-muted-foreground">{d.label}</span>
            <div className="relative flex h-9 items-center">
              <div className="absolute inset-0 rounded-[0.75rem] bg-foreground/[0.045]" />
              {d.value > 0 ? (
                <div data-bar className="relative flex h-full origin-left" style={{ width: `${pct}%`, minWidth: "5.5rem" }}>
                  <div data-fill className="flex h-full w-full origin-left gap-[3px]">
                    <span className="w-3.5 shrink-0 rounded-[0.625rem]" style={{ background: c.bg, opacity: 0.4 }} />
                    <span className="w-3.5 shrink-0 rounded-[0.625rem]" style={{ background: c.bg, opacity: 0.7 }} />
                    <span
                      className="flex flex-1 items-center justify-end rounded-[0.625rem] px-3 text-[0.9375rem] font-medium tabular-nums"
                      style={{ color: c.fg, backgroundColor: c.bg, backgroundImage: HATCH }}
                    >
                      <span data-num={d.value}>{d.value}</span>
                      {suffix}
                    </span>
                  </div>
                  <span
                    data-share
                    className={cn(
                      "invisible absolute top-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-[0.75rem] font-medium whitespace-nowrap tabular-nums opacity-0",
                      // a near-full bar has no room after it: the chip sits inside, past the lead-in blocks
                      pct > 72 ? "left-10 bg-card text-foreground shadow-sm" : "left-full ml-2.5 bg-foreground text-background"
                    )}
                  >
                    {share}% of all
                  </span>
                </div>
              ) : (
                <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[0.8125rem] text-muted-foreground tabular-nums">0</span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ── Tick-mark progress ────────────────────────────────────────────────── */
export function TickProgress({
  value,
  color = "var(--foreground)",
  ticks = 28,
  className,
}: {
  /** 0–100 */
  value: number
  color?: string
  ticks?: number
  className?: string
}) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * ticks)
  return (
    <div className={cn("flex h-8 items-end justify-between", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      {Array.from({ length: ticks }).map((_, i) => (
        <span
          key={i}
          className="tick h-full w-[2px] rounded-full"
          style={{ background: i < filled ? color : "color-mix(in oklab, var(--foreground) 14%, transparent)", "--i": i } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

/* ── Funnel: coloured edge, big number, tick progress ──────────────────── */
export function Funnel({
  stages,
  className,
}: {
  stages: { label: string; value: number; color: string }[]
  className?: string
}) {
  const max = Math.max(1, ...stages.map((s) => s.value))
  return (
    <div className={cn("grid gap-5", className)} style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
      {stages.map((st) => (
        <div key={st.label} className="min-w-0 border-l-2 pl-3.5" style={{ borderColor: st.color }}>
          <p className="truncate text-[0.9688rem] text-muted-foreground">{st.label}</p>
          <p className="mt-1.5 text-[3rem] leading-none font-light tracking-[-0.05em] tabular-nums">{st.value}</p>
          <TickProgress className="mt-5 h-9" value={(st.value / max) * 100} color={st.color} ticks={10} />
        </div>
      ))}
    </div>
  )
}

/* ── Radial tick gauge: filled ticks == the actual value ───────────────── */
export function Gauge({ value, label, className }: { value: number; label: string; className?: string }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  const [shown, setShown] = React.useState(false)
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const N = 41
  const cx = 130
  const cy = 128
  const r1 = 94
  const r2 = 120
  const filled = (v / 100) * (N - 1)
  return (
    <div className={cn("relative mx-auto w-full max-w-[17rem]", className)}>
      <svg viewBox="0 0 260 140" className="w-full overflow-visible" role="img" aria-label={`${label}: ${Math.round(v)} percent`}>
        {Array.from({ length: N }, (_, i) => {
          const a = Math.PI + (i / (N - 1)) * Math.PI
          const on = i <= filled
          const edge = i === 0 || i === N - 1
          const rr = on && Math.abs(i - filled) < 1 ? r1 - 6 : r1
          return (
            <line
              key={i}
              x1={cx + rr * Math.cos(a)}
              y1={cy + rr * Math.sin(a)}
              x2={cx + (edge ? r2 + 2 : r2) * Math.cos(a)}
              y2={cy + (edge ? r2 + 2 : r2) * Math.sin(a)}
              strokeWidth={3.2}
              strokeLinecap="round"
              className={on ? "stroke-foreground" : "stroke-foreground/12"}
              style={{
                opacity: on ? (shown ? 1 : 0.12) : 1,
                transition: `opacity 420ms var(--ease-out) ${on ? i * 16 : 0}ms`,
              }}
            />
          )
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="text-[3.75rem] leading-none font-light tracking-[-0.06em] tabular-nums">
          <CountUp value={Math.round(v)} />
          <span className="ml-1 text-[1.75rem] tracking-normal text-muted-foreground">%</span>
        </p>
        <p className="mt-2 text-[1rem] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

/* ── Status pill ───────────────────────────────────────────────────────── */
const STATUS: Record<string, { label: string; variant: "info" | "warning" | "violet" | "success" | "danger" }> = {
  applied: { label: "Applied", variant: "info" },
  review: { label: "Screening", variant: "warning" },
  shortlisted: { label: "Shortlisted", variant: "violet" },
  interview: { label: "Interview", variant: "info" },
  offered: { label: "Offer", variant: "warning" },
  selected: { label: "Hired", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
}
export const statusLabel = (s: string) => STATUS[s]?.label ?? s
export const STATUS_DOT: Record<string, string> = {
  applied: "bg-sky-400",
  review: "bg-amber-400",
  shortlisted: "bg-violet-400",
  interview: "bg-blue-500",
  offered: "bg-orange-400",
  selected: "bg-green-500",
  rejected: "bg-red-500",
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, variant: "violet" as const }
  return (
    <Badge variant={s.variant}>
      <span className="size-1.5 rounded-full bg-current" />
      {s.label}
    </Badge>
  )
}

/* ── Avatar with a stable tone from the name ───────────────────────────── */
export function OrgAvatar({ name, className }: { name: string; className?: string }) {
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0)
  const tone = AVATAR_TONES[hash % AVATAR_TONES.length]
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
  return (
    <Avatar className={cn("size-10", className)}>
      <AvatarFallback className={cn(`tone-${tone}`, "bg-(--t-bg) text-[0.8125rem] font-medium text-(--t-fg)")}>
        {initials || "?"}
      </AvatarFallback>
    </Avatar>
  )
}

/* ── Progress ring (becomes a check when complete) ─────────────────────── */
export function Ring({ value, size = 24 }: { value: number; size?: number }) {
  const r = 8
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  if (v >= 1) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-full bg-(--c-mint) text-[oklch(0.22_0.05_165)]" style={{ width: size, height: size }}>
        <svg viewBox="0 0 20 20" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 10.5l3.5 3.5 7.5-8" />
        </svg>
      </span>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className="shrink-0 -rotate-90">
      <circle cx="10" cy="10" r={r} fill="none" strokeWidth="2.2" className="stroke-foreground/10" />
      <circle
        cx="10"
        cy="10"
        r={r}
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        className="stroke-foreground"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v)}
        style={{ transition: "stroke-dashoffset 700ms var(--ease-out)" }}
      />
    </svg>
  )
}

/* ── Task list ─────────────────────────────────────────────────────────── */
export interface TaskItem {
  title: string
  description: string
  progress: number
  href: string
}

const STEP_COLORS = ["var(--c-sky)", "var(--c-violet)", "var(--c-mint)", "var(--c-yellow)"]

/** A progress ring with the percentage in the middle (Apple-Fitness style). */
function StepRing({ value, color, size = 52 }: { value: number; color: string; size?: number }) {
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <span className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="4.5" className="stroke-foreground/10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="4.5"
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 800ms var(--ease-out)" }}
        />
      </svg>
      <span className="absolute text-[0.75rem] font-semibold tabular-nums">{Math.round(v * 100)}</span>
    </span>
  )
}

/** "Your plan": overall progress, then four evenly spaced steps — the next one is called out. */
export function TaskList({ items, highlight = 0 }: { items: TaskItem[]; highlight?: number }) {
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  const overall = (items.reduce((n, t) => n + clamp(t.progress), 0) / Math.max(1, items.length)) * 100
  const doneCount = items.filter((t) => t.progress >= 1).length
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[1rem] text-muted-foreground">Plan progress</p>
          <p className="mt-1.5 text-[4rem] leading-none font-light tracking-[-0.06em] tabular-nums">
            {Math.round(overall)}
            <span className="ml-1 text-[1.375rem] tracking-normal text-muted-foreground">%</span>
          </p>
        </div>
        <p className="pb-2 text-[0.9375rem] text-muted-foreground tabular-nums">
          {doneCount} of {items.length} complete
        </p>
      </div>
      <TickProgress className="mt-4 h-6" value={overall} ticks={26} />

      <ul className="stagger mt-5 flex flex-1 flex-col justify-between divide-y divide-border">
        {items.map((t, i) => {
          const done = t.progress >= 1
          const next = i === highlight && !done
          return (
            <li key={t.title} className="flex-1">
              <Link
                href={t.href}
                className="group/step -mx-3 flex h-full min-h-[4.5rem] items-center gap-4 rounded-2xl px-3 py-2.5 outline-none transition-[background-color,transform] duration-200 hover:bg-secondary/70 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
              >
                <StepRing value={t.progress} color={STEP_COLORS[i % STEP_COLORS.length]} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[1.0625rem] leading-snug font-medium tracking-[-0.01em]">{t.title}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-[0.9063rem] text-muted-foreground">
                    {next && <span className="shrink-0 rounded-full bg-lime px-2.5 py-0.5 text-[0.75rem] font-medium text-(--on-lime)">Up next</span>}
                    <span className="truncate">{done ? "All done" : t.description}</span>
                  </span>
                </span>
                <ArrowRightUpIcon className="size-[1.125rem] shrink-0 text-muted-foreground transition-[transform,color] duration-200 group-hover/step:translate-x-0.5 group-hover/step:-translate-y-0.5 group-hover/step:text-foreground" />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ── Frosted stat (for use on a .scene) ────────────────────────────────── */
export function FrostStat({
  label,
  value,
  caption,
  children,
  className,
}: {
  label: string
  value?: React.ReactNode
  caption?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("frost rounded-[1.5rem] p-5", className)}>
      <p className="text-[1.0625rem] font-medium text-muted-foreground">{label}</p>
      {value !== undefined && (
        <p className="mt-3 text-[3.25rem] leading-none font-light tracking-[-0.05em] tabular-nums">{value}</p>
      )}
      {caption && <p className="mt-2.5 text-[0.9688rem] text-muted-foreground">{caption}</p>}
      {children}
    </div>
  )
}

/* ── Form field ────────────────────────────────────────────────────────── */
export function Field({
  label,
  hint,
  action,
  className,
  children,
}: {
  label: string
  hint?: string
  /** something small at the right end of the label row, e.g. a "Forgot password?" link */
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {action ? (
        <div className="flex items-baseline justify-between gap-3">
          <label className="block pl-1 text-[0.9375rem] font-medium text-foreground/75">{label}</label>
          {action}
        </div>
      ) : (
        <label className="block pl-1 text-[0.9375rem] font-medium text-foreground/75">{label}</label>
      )}
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/* ── Dashboard greeting: one quiet line, a subtitle, the main action ──── */
export function GreetingHeader({
  name,
  subtitle,
  demo,
  actions,
}: {
  name: string
  subtitle?: React.ReactNode
  demo?: boolean
  actions?: React.ReactNode
}) {
  return (
    <div className="rise flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
      <div className="min-w-0">
        <h1 className="text-[clamp(2rem,3.4vw,3.125rem)] leading-[1.05] font-light tracking-[-0.045em]">
          Welcome back, <span className="font-medium">{name}</span>
        </h1>
        {(subtitle || demo) && (
          <p className="mt-2 text-[1rem] text-muted-foreground">
            {subtitle}
            {demo && <span className="ml-2 text-[0.8125rem] opacity-60">· Showing sample data</span>}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ── Page header ───────────────────────────────────────────────────────── */
export function PageHeader({
  title,
  subtitle,
  badge,
  demo,
  actions,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  badge?: React.ReactNode
  demo?: boolean
  actions?: React.ReactNode
}) {
  return (
    <div className="rise -mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 sm:-mt-5">
      <div>
        <div className="flex items-center gap-3">
          {/* the title melts into the page: full ink at the top, fading toward the background */}
          <h1 className="bg-[linear-gradient(180deg,var(--foreground)_25%,color-mix(in_oklab,var(--foreground)_30%,var(--background))_100%)] bg-clip-text pb-1 text-[clamp(2rem,3.2vw,2.875rem)] text-transparent">{title}</h1>
          {badge}
        </div>
        {(subtitle || demo) && (
          <p className="mt-1 text-[1rem] text-muted-foreground/85">
            {subtitle}
            {demo && <span className="ml-2 text-[0.8125rem] opacity-60">· Showing sample data</span>}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-12 w-72 rounded-2xl" />
      <div className="grid gap-5 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-[2rem]" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-80 rounded-[2rem]" />
        <Skeleton className="h-80 rounded-[2rem]" />
      </div>
    </div>
  )
}

/* ── Hero card: identity, gauge, next step ────────────────────────────── */
export function HeroCard({
  name,
  role,
  kicker,
  value,
  progress,
  nextLabel,
  nextHref,
  className,
}: {
  name: string
  role: string
  title?: string
  kicker: string
  value: string
  progress: { label: string; value: number }
  nextLabel: string
  nextHref: string
  className?: string
}) {
  return (
    <div className={cn("rise tone-lime tint dbl flex min-h-[23rem] flex-col rounded-[2rem] border p-7 [--r:32px]", className)}>
      <div className="flex items-center gap-3">
        <OrgAvatar name={name} className="size-12" />
        <div className="leading-tight">
          <p className="text-[1.375rem] font-medium tracking-[-0.01em]">{name}</p>
          <p className="mt-0.5 text-[1rem] text-muted-foreground">{role}</p>
        </div>
        <p className="ml-auto text-right text-[0.9375rem] leading-tight text-muted-foreground">
          {kicker}
          <span className="mt-0.5 block text-[2.25rem] font-light tracking-tight text-foreground tabular-nums">{value}</span>
        </p>
      </div>

      <Gauge className="my-auto pt-6 pb-2" value={progress.value} label={progress.label} />

      <div className="mt-6 flex items-center gap-3">
        <SlideCta href={nextHref} label={nextLabel} />
        <Link
          href={nextHref}
          aria-label={nextLabel}
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-150 hover:scale-105 active:scale-95"
        >
          <ArrowRightUpIcon className="size-5" />
        </Link>
      </div>
    </div>
  )
}

const PC_BTN =
  "flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-white text-[0.9688rem] font-medium text-[oklch(0.3_0.1_280)] shadow-[0_8px_20px_-10px_oklch(0.2_0.06_280/0.6)] transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"

/** Stacked, masked backdrop-blur layers: blur ramps up smoothly from nothing to heavy. */
function ProgressiveBlur({ className }: { className?: string }) {
  const layers = [1, 2, 4, 8, 16, 28]
  const n = layers.length
  return (
    <div aria-hidden className={cn("pointer-events-none", className)}>
      {layers.map((px, i) => {
        const a = (i / (n + 1)) * 100
        const b = ((i + 1) / (n + 1)) * 100
        const c = ((i + 2) / (n + 1)) * 100
        const d = ((i + 3) / (n + 1)) * 100
        const mask = `linear-gradient(to bottom, transparent ${a}%, black ${b}%, black ${c}%, transparent ${Math.min(d, 100)}%)`
        const last = i === n - 1
        const m = last ? `linear-gradient(to bottom, transparent ${a}%, black ${b}%)` : mask
        return (
          <span
            key={px}
            className="absolute inset-0"
            style={{ backdropFilter: `blur(${px}px)`, WebkitBackdropFilter: `blur(${px}px)`, maskImage: m, WebkitMaskImage: m }}
          />
        )
      })}
    </div>
  )
}

/* ── Profile card: portrait scene, name on top, handle + action on the bottom ── */
export function ProfileCard({
  name,
  status,
  handle,
  photo,
  gender,
  href,
  onAction,
  onPhoto,
  uploading,
  style,
  roleLabel,
  action = "View profile",
  className,
}: {
  name: string
  status: string
  handle: string
  photo?: string | null
  gender?: string | null
  href: string
  onAction?: () => void
  onPhoto?: (file: File) => void
  uploading?: boolean
  style?: React.CSSProperties
  roleLabel?: string
  action?: string
  className?: string
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
  return (
    <div
      className={cn(
        "rise pc-theme group/pc relative isolate flex min-h-[23rem] flex-col overflow-hidden rounded-[2rem] text-white shadow-[0_1px_2px_oklch(0.2_0.04_280/0.08),0_24px_44px_-24px_oklch(0.3_0.12_280/0.5)]",
        className
      )}
      style={{ ...style, background: "linear-gradient(165deg, var(--pc-1) 0%, var(--pc-2) 55%, var(--pc-3) 100%)" }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="photo-in absolute inset-0 -z-10 size-full object-cover" />
      ) : hasPortrait(gender) ? (
        <Portrait gender={gender} className="photo-in absolute inset-0 -z-10 size-full" />
      ) : (
        <>
          {/* soft fading bars, like a quiet equaliser */}
          <div aria-hidden className="photo-in absolute inset-x-0 bottom-0 -z-10 flex h-3/5 items-end justify-between gap-[0.3125rem] px-5 opacity-60">
            {Array.from({ length: 22 }, (_, i) => (
              <span key={i} className="w-full rounded-t-full bg-gradient-to-t from-white/35 to-white/0" style={{ height: `${28 + ((i * 37) % 62)}%` }} />
            ))}
          </div>
          <span aria-hidden className="absolute top-[50%] left-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 text-[8rem] leading-none font-light tracking-[-0.06em] text-white/25 select-none">
            {initials}
          </span>
        </>
      )}
      {/* progressive blur: the picture melts into focus-less glass toward the bottom */}
      <ProgressiveBlur className="absolute inset-x-0 bottom-0 -z-10 h-[42%]" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-[38%] bg-gradient-to-t from-(--pc-deep) to-transparent" />
      <span aria-hidden className="absolute inset-0 -z-10 rounded-[2rem] shadow-[inset_0_1px_0_oklch(1_0_0/0.35),inset_0_0_0_1px_oklch(1_0_0/0.14)]" />

      <div className="rise px-6 pt-7 text-center" style={{ "--i": 4 } as React.CSSProperties}>
        <p className="text-[1.625rem] leading-tight font-medium tracking-[-0.02em] [text-shadow:0_1px_14px_oklch(0.25_0.08_280/0.45)]">{name}</p>
        <p className="mt-2 inline-flex items-center gap-2 text-[0.9375rem] text-white/85">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
            <span className="relative inline-flex size-2.5 rounded-full bg-white" />
          </span>
          {status}
        </p>
      </div>

      {onPhoto && (
        <label
          title="Change photo"
          className="absolute top-4 right-4 flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/25 text-white ring-1 ring-white/40 backdrop-blur transition-[background-color,transform] duration-150 hover:bg-white/40 active:scale-90 has-focus-visible:ring-2 has-focus-visible:ring-white"
        >
          <CameraIcon className={cn("size-5", uploading && "animate-pulse")} />
          <span className="sr-only">Change photo</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onPhoto(f)
              e.target.value = ""
            }}
          />
        </label>
      )}

      <div className="rise mt-auto space-y-3.5 p-4" style={{ "--i": 6 } as React.CSSProperties}>
        <div className="flex items-center gap-3 px-1">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/25 text-[0.875rem] font-semibold ring-1 ring-white/40 backdrop-blur">
            {initials}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[0.9688rem] font-medium">{handle}</span>
            <span className="mt-0.5 block text-[0.8438rem] text-white/75">{roleLabel ?? (action === "View profile" ? "Student" : "Recruiter")}</span>
          </span>
        </div>
        {onAction ? (
          <button type="button" onClick={onAction} className={PC_BTN}>
            {action}
          </button>
        ) : (
          <Link href={href} className={PC_BTN}>
            <PlusIcon className="size-4" /> {action}
          </Link>
        )}
      </div>
    </div>
  )
}

/** Pill link: on hover the arrow glides over the label (which blurs); on tap it slides home, then navigates. */
function SlideCta({ href, label }: { href: string; label: string }) {
  const router = useRouter()
  const [go, setGo] = React.useState(false)
  return (
    <a
      href={href}
      data-go={go}
      onMouseEnter={() => router.prefetch(href)}
      onFocus={() => router.prefetch(href)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        if (go) return
        setGo(true)
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        window.setTimeout(() => router.push(href), reduce ? 0 : 900)
      }}
      className="group/cta relative block h-14 min-w-0 flex-1 overflow-hidden rounded-full border border-(--hairline) bg-card outline-none [container-type:inline-size] focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.985]"
    >
      <span className="cta-chip absolute top-1.5 bottom-1.5 left-1.5 z-10 flex w-11 items-center justify-center rounded-full bg-secondary text-foreground">
        <ArrowRightIcon className="size-[1.125rem]" />
      </span>
      <span className="cta-label absolute inset-y-0 right-5 left-16 flex items-center truncate text-[1.0625rem] font-medium">{label}</span>
    </a>
  )
}

/* ── Quick action tile ─────────────────────────────────────────────────── */
export function QuickTile({
  href,
  label,
  hint,
  tone,
}: {
  href: string
  label: string
  hint: string
  tone: Tone
}) {
  return (
    <Link
      href={href}
      className={cn(
        `tone-${tone} tint dbl lift flex min-h-[7.5rem] flex-col justify-between rounded-[1.625rem] border p-5 transition-transform duration-150 active:scale-[0.97] [--r:26px]`
      )}
    >
      <span className="flex size-9 items-center justify-center self-end rounded-full bg-card text-foreground">
        <ArrowRightUpIcon className="size-[1.125rem]" />
      </span>
      <span>
        <span className="block text-[1.125rem] font-medium">{label}</span>
        <span className="mt-0.5 block text-[0.9063rem] leading-snug text-muted-foreground">{hint}</span>
      </span>
    </Link>
  )
}
