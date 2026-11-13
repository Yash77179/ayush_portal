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
          <CardTitle className="text-[28px] leading-tight font-medium tracking-[-0.02em]">{title}</CardTitle>
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
}

export function StatTile({ title, value, unit, pill, caption, tone = "blue", icon, href, index = 0 }: StatTileProps) {
  const body = (
    <Card
      className={cn(
        "rise tint h-full min-h-[11.5rem] justify-between gap-6",
        `tone-${tone}`,
        href && "lift"
      )}
      style={stagger(index)}
    >
      <CardHeader className="items-center">
        <div className="flex items-center gap-3">
          {icon && <IconChip>{icon}</IconChip>}
          <CardTitle className="text-[24px] leading-snug font-medium tracking-[-0.02em]">{title}</CardTitle>
        </div>
        {href && (
          <CardAction>
            <span className="flex size-9 items-center justify-center rounded-full bg-card text-foreground">
              <ArrowRightUpIcon className="size-[18px]" />
            </span>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className={cn("text-[5rem] leading-none font-light tracking-[-0.06em] tabular-nums", false)}>
            {typeof value === "number" ? <CountUp value={value} delay={index * 40} /> : value}
          </span>
          {unit && <span className="text-[2.25rem] font-light text-muted-foreground">{unit}</span>}
        </div>
        {(caption || pill) && (
          <div className="mt-3 flex items-center justify-between gap-2">
            {caption && <p className="min-w-0 truncate text-[16.5px] text-muted-foreground">{caption}</p>}
            {pill && <Badge variant={pill.variant ?? "violet"} className="shrink-0">{pill.text}</Badge>}
          </div>
        )}
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
      <div className="mt-2.5 flex items-center justify-between text-[16px] text-muted-foreground">
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

/* ── Segmented bars: slim track, two small lead-in blocks, labelled fill ── */
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
  const max = Math.max(0, ...data.map((d) => d.value))
  if (max === 0) {
    return <p className={cn("py-10 text-center text-sm text-muted-foreground", className)}>{emptyText}</p>
  }
  return (
    <ul className={cn("space-y-3.5", className)}>
      {data.map((d, i) => {
        const c = PALETTE[(d.tone ?? i) % PALETTE.length]
        const pct = (d.value / max) * 100
        return (
          <li key={d.label} className="grid grid-cols-[6.75rem_1fr] items-center gap-4">
            <span className="truncate text-[15.5px] text-muted-foreground">{d.label}</span>
            <div className="relative h-9 overflow-hidden rounded-[12px] bg-foreground/[0.045]">
              {d.value > 0 ? (
                <div
                  className="grow-x absolute inset-y-0 left-0 flex gap-[3px]"
                  style={{ width: `${pct}%`, minWidth: "5.5rem", "--i": i } as React.CSSProperties}
                >
                  <span className="w-3.5 shrink-0 rounded-[10px]" style={{ background: c.bg, opacity: 0.4 }} />
                  <span className="w-3.5 shrink-0 rounded-[10px]" style={{ background: c.bg, opacity: 0.7 }} />
                  <span
                    className="flex flex-1 items-center justify-end rounded-[10px] px-3 text-[15px] font-medium tabular-nums"
                    style={{
                      color: c.fg,
                      backgroundColor: c.bg,
                      backgroundImage: HATCH,
                    }}
                  >
                    {d.value}
                    {suffix}
                  </span>
                </div>
              ) : (
                <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-muted-foreground tabular-nums">0</span>
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
          <p className="truncate text-[15.5px] text-muted-foreground">{st.label}</p>
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
        <p className="mt-2 text-[16px] text-muted-foreground">{label}</p>
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
      <AvatarFallback className={cn(`tone-${tone}`, "bg-(--t-bg) text-[13px] font-medium text-(--t-fg)")}>
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
      <span className="absolute text-[12px] font-semibold tabular-nums">{Math.round(v * 100)}</span>
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
          <p className="text-[16px] text-muted-foreground">Plan progress</p>
          <p className="mt-1.5 text-[4rem] leading-none font-light tracking-[-0.06em] tabular-nums">
            {Math.round(overall)}
            <span className="ml-1 text-[22px] tracking-normal text-muted-foreground">%</span>
          </p>
        </div>
        <p className="pb-2 text-[15px] text-muted-foreground tabular-nums">
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
                  <span className="block truncate text-[17px] leading-snug font-medium tracking-[-0.01em]">{t.title}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-[14.5px] text-muted-foreground">
                    {next && <span className="shrink-0 rounded-full bg-lime px-2.5 py-0.5 text-[12px] font-medium text-(--on-lime)">Up next</span>}
                    <span className="truncate">{done ? "All done" : t.description}</span>
                  </span>
                </span>
                <ArrowRightUpIcon className="size-[18px] shrink-0 text-muted-foreground transition-[transform,color] duration-200 group-hover/step:translate-x-0.5 group-hover/step:-translate-y-0.5 group-hover/step:text-foreground" />
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
    <div className={cn("frost rounded-[24px] p-5", className)}>
      <p className="text-[17px] font-medium text-muted-foreground">{label}</p>
      {value !== undefined && (
        <p className="mt-3 text-[3.25rem] leading-none font-light tracking-[-0.05em] tabular-nums">{value}</p>
      )}
      {caption && <p className="mt-2.5 text-[15.5px] text-muted-foreground">{caption}</p>}
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
          <label className="block pl-1 text-[15px] font-medium text-foreground/75">{label}</label>
          {action}
        </div>
      ) : (
        <label className="block pl-1 text-[15px] font-medium text-foreground/75">{label}</label>
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
        <h1 className="text-[clamp(2.5rem,4.4vw,3.75rem)] leading-[1.05] font-light tracking-[-0.045em]">
          Welcome back, <span className="font-medium">{name}</span>
        </h1>
        {(subtitle || demo) && (
          <p className="mt-3 text-[18px] text-muted-foreground">
            {subtitle}
            {demo && <span className="ml-2 text-[13px] opacity-60">· Showing sample data</span>}
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
    <div className="rise flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-[clamp(2.5rem,4.4vw,3.5rem)]">{title}</h1>
          {badge}
        </div>
        {(subtitle || demo) && (
          <p className="mt-3 text-[18px] text-muted-foreground">
            {subtitle}
            {demo && <span className="ml-2 text-[13px] opacity-60">· Showing sample data</span>}
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
          <Skeleton key={i} className="h-44 rounded-[32px]" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-80 rounded-[32px]" />
        <Skeleton className="h-80 rounded-[32px]" />
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
    <div className={cn("rise tone-lime tint dbl flex min-h-[23rem] flex-col rounded-[32px] border p-7 [--r:32px]", className)}>
      <div className="flex items-center gap-3">
        <OrgAvatar name={name} className="size-12" />
        <div className="leading-tight">
          <p className="text-[22px] font-medium tracking-[-0.01em]">{name}</p>
          <p className="mt-0.5 text-[16px] text-muted-foreground">{role}</p>
        </div>
        <p className="ml-auto text-right text-[15px] leading-tight text-muted-foreground">
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
  "flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-white text-[15.5px] font-medium text-[oklch(0.3_0.1_280)] shadow-[0_8px_20px_-10px_oklch(0.2_0.06_280/0.6)] transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"

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
        "rise pc-theme group/pc relative isolate flex min-h-[23rem] flex-col overflow-hidden rounded-[32px] text-white shadow-[0_1px_2px_oklch(0.2_0.04_280/0.08),0_24px_44px_-24px_oklch(0.3_0.12_280/0.5)]",
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
          <div aria-hidden className="photo-in absolute inset-x-0 bottom-0 -z-10 flex h-3/5 items-end justify-between gap-[5px] px-5 opacity-60">
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
      <span aria-hidden className="absolute inset-0 -z-10 rounded-[32px] shadow-[inset_0_1px_0_oklch(1_0_0/0.35),inset_0_0_0_1px_oklch(1_0_0/0.14)]" />

      <div className="rise px-6 pt-7 text-center" style={{ "--i": 4 } as React.CSSProperties}>
        <p className="text-[26px] leading-tight font-medium tracking-[-0.02em] [text-shadow:0_1px_14px_oklch(0.25_0.08_280/0.45)]">{name}</p>
        <p className="mt-2 inline-flex items-center gap-2 text-[15px] text-white/85">
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
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/25 text-[14px] font-semibold ring-1 ring-white/40 backdrop-blur">
            {initials}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[15.5px] font-medium">{handle}</span>
            <span className="mt-0.5 block text-[13.5px] text-white/75">{roleLabel ?? (action === "View profile" ? "Student" : "Recruiter")}</span>
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
        <ArrowRightIcon className="size-[18px]" />
      </span>
      <span className="cta-label absolute inset-y-0 right-5 left-16 flex items-center truncate text-[17px] font-medium">{label}</span>
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
        `tone-${tone} tint dbl lift flex min-h-[7.5rem] flex-col justify-between rounded-[26px] border p-5 transition-transform duration-150 active:scale-[0.97] [--r:26px]`
      )}
    >
      <span className="flex size-9 items-center justify-center self-end rounded-full bg-card text-foreground">
        <ArrowRightUpIcon className="size-[18px]" />
      </span>
      <span>
        <span className="block text-[18px] font-medium">{label}</span>
        <span className="mt-0.5 block text-[14.5px] leading-snug text-muted-foreground">{hint}</span>
      </span>
    </Link>
  )
}
