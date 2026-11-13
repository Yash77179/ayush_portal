"use client"

/**
 * Dashboard widgets borrowed from real job portals (recommended roles, closing
 * soon, saved jobs, activity, upcoming interviews) plus two that are ours:
 * skill-gap view and match scores.
 */

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"

import { demoSkills, type InternshipRow } from "@/lib/demo"
import { MODE_LABEL, getSampleDetail, makeSampleDetails, type BrowseInternship } from "@/lib/internship-data"
import { useSavedJobs } from "@/lib/use-jobs"
import { ArrowRightUpIcon, BookmarkIcon, BookmarkSolidIcon, CheckCircleIcon, ClockIcon, CloseCircleIcon, PlusIcon, StarIcon, TrophyIcon } from "@/components/icons"
import { OrgAvatar, Panel, STATUS_DOT, TickProgress, stagger } from "@/components/kit"
import { daysUntil } from "@/components/internship-card"
import { Button } from "@/components/ui/button"

const rupees = (v: string | number) => `₹${Number(v || 0).toLocaleString("en-IN")}`

/** Weighted skill match for sample data (required skills count 3×, like the backend). */
export function sampleMatch(jobId: number): number {
  const mine = new Set(demoSkills.map((s) => s.skill.name))
  const skills = getSampleDetail(jobId).internship_skills
  const req = skills.filter((s) => s.is_required)
  const pref = skills.filter((s) => !s.is_required)
  const max = req.length * 3 + pref.length
  if (!max) return 100
  const earned = req.filter((s) => mine.has(s.skill.name)).length * 3 + pref.filter((s) => mine.has(s.skill.name)).length
  return Math.round((earned / max) * 100)
}

export function timeAgo(iso: string, now: number) {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

function BookmarkButton({ id }: { id: number }) {
  const { has, toggle } = useSavedJobs()
  const saved = has(id)
  return (
    <button
      type="button"
      onClick={() => toggle(id)}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save job"}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full outline-none transition-[background-color,color,transform] duration-150 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring active:scale-90",
        saved ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {saved ? <BookmarkSolidIcon className="size-[18px]" /> : <BookmarkIcon className="size-[18px]" />}
    </button>
  )
}

/* ── Recommended for you ─────────────────────────────────────────────── */
export function RecommendedJobs({ jobs, isDemo, className }: { jobs: BrowseInternship[]; isDemo: boolean; className?: string }) {
  const rows = jobs
    .map((j) => ({ ...j, match: isDemo ? sampleMatch(j.id) : undefined }))
    .sort((a, b) => (b.match ?? 0) - (a.match ?? 0))
    .slice(0, 4)

  return (
    <Panel
      className={className}
      title="Recommended for you"
      style={stagger(6)}
      action={<Link href="/internships" className="text-[16px] font-medium underline-offset-4 hover:underline">See all</Link>}
      contentClassName="-mx-3"
    >
      {rows.length === 0 ? (
        <p className="px-3 py-10 text-center text-sm text-muted-foreground">New internships will appear here.</p>
      ) : (
        <ul className="stagger">
          {rows.map((j) => (
            <li key={j.id} className="flex items-center gap-4 rounded-[20px] px-3 py-3 transition-colors duration-150 hover:bg-secondary/70">
              <OrgAvatar name={j.company_name} className="size-11" />
              <Link href={`/internships/${j.id}`} className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-medium">{j.title}</p>
                <p className="mt-0.5 truncate text-[15px] text-muted-foreground">
                  {j.company_name} · {j.location || "Remote"} · {MODE_LABEL[j.work_mode] ?? j.work_mode}
                </p>
              </Link>
              <p className="hidden text-right sm:block">
                <span className="text-[16px] font-medium tabular-nums">{rupees(j.stipend)}</span>
                <span className="block text-[13.5px] text-muted-foreground">per month</span>
              </p>
              {j.match !== undefined && (
                <p className="w-12 text-right">
                  <span className="text-[17px] font-medium tabular-nums">{j.match}%</span>
                  <span className="block text-[13.5px] text-muted-foreground">match</span>
                </p>
              )}
              <BookmarkButton id={j.id} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/* ── Closing soon ────────────────────────────────────────────────────── */
export function ClosingSoon({ jobs, now, className }: { jobs: BrowseInternship[]; now: number; className?: string }) {
  const rows = jobs
    .map((j) => ({ ...j, days: daysUntil(j.deadline, now) }))
    .filter((j) => j.days > 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, 4)

  return (
    <Panel className={className} title="Closing soon" style={stagger(7)} contentClassName="-mx-3">
      {rows.length === 0 ? (
        <p className="px-3 py-10 text-center text-sm text-muted-foreground">Nothing is closing soon.</p>
      ) : (
        <ul className="stagger">
          {rows.map((j) => (
            <li key={j.id}>
              <Link href={`/internships/${j.id}`} className="flex items-center gap-4 rounded-[20px] px-3 py-3 transition-colors duration-150 hover:bg-secondary/70">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] font-medium">{j.title}</p>
                  <p className="mt-0.5 truncate text-[15px] text-muted-foreground">{j.company_name}</p>
                </div>
                <div className="w-24 shrink-0">
                  <TickProgress className="h-5" value={Math.min(100, (j.days / 30) * 100)} color={j.days <= 7 ? "var(--c-red)" : "var(--foreground)"} ticks={14} />
                  <p className={cn("mt-1.5 text-right text-[14px] tabular-nums", j.days <= 7 ? "font-medium text-[var(--c-red)]" : "text-muted-foreground")}>
                    {j.days} day{j.days === 1 ? "" : "s"} left
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/* ── Saved jobs: a shelf with bookmark ribbons ───────────────────────── */
const RIBBON = "polygon(0 0, 100% 0, 100% 100%, 50% 76%, 0 100%)"

export function SavedJobs({ jobs, className }: { jobs: BrowseInternship[]; className?: string }) {
  const { ids, toggle } = useSavedJobs()
  const [now] = React.useState(() => Date.now())
  const saved = jobs.filter((j) => ids.includes(j.id))
  const RIB = ["var(--c-violet)", "var(--c-sky)", "var(--c-mint)", "var(--c-yellow)"]
  return (
    <Panel
      className={className}
      title="Saved jobs"
      style={stagger(9)}
      action={saved.length > 0 ? <span className="text-[15px] text-muted-foreground tabular-nums">{saved.length} saved</span> : undefined}
    >
      {saved.length === 0 ? (
        <div className="relative h-full min-h-56">
          <ul aria-hidden className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="relative flex items-center gap-3.5 rounded-[22px] border border-dashed border-border px-4 py-3.5" style={{ opacity: 0.9 - i * 0.17 }}>
                <span className="size-11 rounded-2xl bg-foreground/[0.06]" />
                <span className="flex-1 space-y-2">
                  <span className="block h-2.5 w-3/5 rounded-full bg-foreground/[0.08]" />
                  <span className="block h-2 w-2/5 rounded-full bg-foreground/[0.05]" />
                </span>
                <span className="mr-1 h-7 w-5 bg-foreground/[0.07]" style={{ clipPath: RIBBON }} />
              </li>
            ))}
          </ul>
          <p className="absolute inset-x-0 top-[38%] -translate-y-1/2 text-center">
            <span className="mx-auto inline-block rounded-full bg-card px-5 py-2.5 text-[15.5px] text-muted-foreground shadow-[0_8px_24px_-12px_oklch(0.2_0.03_260/0.3),inset_0_0_0_1px_var(--hairline)]">
              Tap the bookmark on any role to keep it here
            </span>
          </p>
        </div>
      ) : (
        <ul className="stagger space-y-2.5">
          {saved.map((j, i) => {
            const left = daysUntil(j.deadline, now)
            return (
              <li key={j.id} className="group/saved relative flex items-center gap-3.5 rounded-[22px] bg-secondary/55 py-3.5 pr-14 pl-4 transition-colors duration-200 hover:bg-secondary">
                <OrgAvatar name={j.company_name} className="size-11" />
                <Link href={`/internships/${j.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-[17px] leading-snug font-medium">{j.title}</p>
                  <p className="mt-0.5 flex items-center gap-2 truncate text-[14.5px] text-muted-foreground">
                    <span className="truncate">{j.company_name}</span>
                    <span aria-hidden>·</span>
                    <span className={cn("shrink-0", left <= 7 && left >= 0 && "font-medium text-(--pink-fg)")}>{left < 0 ? "Closed" : left === 0 ? "Closes today" : `${left}d left`}</span>
                  </p>
                </Link>
                <button
                  type="button"
                  aria-label="Remove from saved"
                  onClick={() => toggle(j.id)}
                  className="absolute top-0 right-5 h-9 w-6 origin-top transition-[height,transform] duration-300 ease-(--ease-out) group-hover/saved:h-11 active:scale-y-90"
                  style={{ background: RIB[i % RIB.length], clipPath: RIBBON }}
                />
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/* ── Activity: a week strip on top, a grouped timeline below ─────────── */
export interface ActivityItem {
  id: number
  text: React.ReactNode
  status: string
  at: string
}

const EVENT: Record<string, { Icon: typeof StarIcon; tone: string; label: string; dot: string }> = {
  applied: { Icon: ArrowRightUpIcon, tone: "tone-blue", label: "Applied", dot: "var(--c-sky)" },
  review: { Icon: ClockIcon, tone: "tone-amber", label: "In review", dot: "var(--c-yellow)" },
  shortlisted: { Icon: StarIcon, tone: "tone-violet", label: "Shortlisted", dot: "var(--c-violet)" },
  selected: { Icon: TrophyIcon, tone: "tone-mint", label: "Offer", dot: "var(--c-mint)" },
  rejected: { Icon: CloseCircleIcon, tone: "tone-pink", label: "Closed", dot: "var(--c-red)" },
}

export function ActivityFeed({ items, now, title = "Activity", className }: { items: ActivityItem[]; now: number; title?: string; className?: string }) {
  const kinds = Object.keys(EVENT).map((k) => ({ k, n: items.filter((a) => a.status === k).length })).filter((x) => x.n > 0)
  return (
    <Panel className={className} title={title} style={stagger(8)}>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Activity will show up here.</p>
      ) : (
        <div className="space-y-6">
          {/* composition of recent activity */}
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-[3rem] leading-none font-light tracking-[-0.05em] tabular-nums">{items.length}</p>
              <p className="text-[15px] text-muted-foreground">recent updates</p>
            </div>
            <div className="mt-4 flex h-3 gap-1" aria-hidden>
              {kinds.map(({ k, n }, i) => (
                <span key={k} className="grow-x rounded-full" style={{ flex: n, background: EVENT[k].dot, "--i": i } as React.CSSProperties} />
              ))}
            </div>
            <ul className="mt-3.5 flex flex-wrap gap-x-5 gap-y-1.5">
              {kinds.map(({ k, n }) => (
                <li key={k} className="flex items-center gap-2 text-[14.5px] text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ background: EVENT[k].dot }} />
                  {EVENT[k].label} <span className="font-medium text-foreground tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* timeline: date gutter · rail · tinted event card — scrolls inside the panel so neighbours don't stretch */}
          <div className="-mr-2 max-h-[23rem] overflow-y-auto overscroll-contain pr-2 [scrollbar-width:thin]">
          <ol className="stagger relative space-y-3">
            <span aria-hidden className="absolute top-3 bottom-3 left-[calc(3.25rem+0.625rem)] w-px bg-border" />
            {items.map((a) => {
              const e = EVENT[a.status] ?? EVENT.applied
              const d = new Date(a.at)
              return (
                <li key={a.id} className="relative grid grid-cols-[3.25rem_1fr] gap-x-5">
                  <div className="pt-3 text-center leading-none">
                    <p className="text-[1.75rem] font-light tracking-[-0.04em] tabular-nums">{d.getDate()}</p>
                    <p className="mt-1 text-[11.5px] font-medium tracking-[0.1em] text-muted-foreground uppercase">{d.toLocaleDateString("en-IN", { month: "short" })}</p>
                  </div>
                  <span aria-hidden className="absolute top-[1.15rem] left-[calc(3.25rem+0.625rem-5px)] size-[11px] rounded-full ring-4 ring-card" style={{ background: e.dot }} />
                  <div className={cn(e.tone, "flex items-start gap-3.5 rounded-[22px] bg-(--t-bg) p-4")}>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-card text-(--t-fg) [&_svg]:size-5">
                      <e.Icon />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium tracking-[0.08em] text-(--t-fg) uppercase">
                        {e.label} <span className="font-normal tracking-normal text-muted-foreground normal-case">· {timeAgo(a.at, now)}</span>
                      </p>
                      <p className="mt-1 text-[16px] leading-snug">{a.text}</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
          </div>
        </div>
      )}
    </Panel>
  )
}

/* ── Skills in demand: a bubble map — size is demand, fill is "you have it" ── */
export function SkillGap({ className }: { className?: string }) {
  const mine = new Set(demoSkills.map((s) => s.skill.name))
  const counts = new Map<string, number>()
  makeSampleDetails().forEach((d) =>
    d.internship_skills.filter((s) => s.is_required).forEach((s) => counts.set(s.skill.name, (counts.get(s.skill.name) ?? 0) + 1))
  )
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7)
  const max = Math.max(1, ...rows.map((r) => r[1]))
  const covered = rows.filter(([n]) => mine.has(n)).length
  const nextGap = rows.find(([n]) => !mine.has(n))

  return (
    <Panel className={className} title="Skills in demand" style={stagger(10)}>
      <div className="flex h-full flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <p className="text-[3.5rem] leading-none font-light tracking-[-0.06em] tabular-nums">
            {covered}
            <span className="text-[1.75rem] tracking-normal text-muted-foreground"> / {rows.length}</span>
          </p>
          <p className="pb-1.5 text-right text-[15px] leading-snug text-muted-foreground">
            top skills
            <br />
            you already have
          </p>
        </div>

        <ul className="stagger flex flex-1 flex-wrap content-center items-center justify-center gap-1.5 py-2">
          {rows.map(([name, n]) => {
            const has = mine.has(name)
            const size = Math.round(100 + (n / max) * 70)
            return (
              <li
                key={name}
                title={`${name} · needed in ${n} role${n === 1 ? "" : "s"}`}
                className={cn(
                  "flex shrink-0 flex-col items-center justify-center rounded-full text-center transition-transform duration-300 ease-(--ease-out) hover:scale-[1.06]",
                  has
                    ? "tone-mint bg-(--t-bg) shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--t-fg)_14%,transparent)]"
                    : "border border-dashed border-foreground/25 text-muted-foreground"
                )}
                style={{ width: size, height: size }}
              >
                <span className={cn("max-w-[85%] text-[17px] leading-tight font-medium", has && "text-(--t-fg)")}>{name}</span>
                <span className="mt-1 text-[14px] opacity-70 tabular-nums">{n} role{n === 1 ? "" : "s"}</span>
              </li>
            )
          })}
        </ul>

        <div className="flex items-center gap-4 text-[13.5px] text-muted-foreground">
          <span className="flex items-center gap-2"><span className="size-3 rounded-full bg-(--mint-bg) ring-1 ring-(--mint-fg)/25" /> You have it</span>
          <span className="flex items-center gap-2"><span className="size-3 rounded-full border border-dashed border-foreground/30" /> To learn</span>
          <span className="ml-auto">size = demand</span>
        </div>

        <Button className="w-full" render={<Link href="/dashboard/student/skills" />} nativeButton={false}>
          {nextGap ? `Learn ${nextGap[0]} next` : "Explore skills"}
        </Button>
      </div>
    </Panel>
  )
}

/* ── Upcoming interviews: boarding-pass tickets ──────────────────────── */
export function Interviews({ now, className }: { now: number; className?: string }) {
  const rows = [
    { in: 2, title: "Frontend Developer Intern", company: "Zoho Corporation", time: "11:00 AM", mode: "Video call", tone: "tone-blue" },
    { in: 5, title: "Backend Engineer Intern", company: "Freshworks", time: "3:30 PM", mode: "On-site", tone: "tone-violet" },
  ].map((r) => ({ ...r, date: new Date(now + r.in * 86_400_000) }))

  return (
    <Panel className={className} title="Upcoming interviews" style={stagger(11)}>
      <ul className="stagger space-y-3.5">
        {rows.map((r) => (
          <li key={r.title} className={cn(r.tone, "relative flex overflow-hidden rounded-[26px] bg-(--t-bg)")}>
            <div className="flex w-[5.5rem] shrink-0 flex-col items-center justify-center py-5 leading-none text-(--t-fg)">
              <span className="text-[2.25rem] font-light tracking-[-0.04em] tabular-nums">{r.date.getDate()}</span>
              <span className="mt-1.5 text-[12.5px] font-medium tracking-[0.12em] uppercase">{r.date.toLocaleDateString("en-IN", { month: "short" })}</span>
            </div>
            <div aria-hidden className="relative w-0 self-stretch border-l-2 border-dashed border-foreground/15">
              <span className="absolute -top-3 -left-3 size-6 rounded-full bg-card" />
              <span className="absolute -bottom-3 -left-3 size-6 rounded-full bg-card" />
            </div>
            <div className="min-w-0 flex-1 px-5 py-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-card/80 px-2.5 py-1 text-[12.5px] font-medium text-(--t-fg)">
                <ClockIcon className="size-3.5" /> In {r.in} days · {r.time}
              </span>
              <p className="mt-2.5 truncate text-[17px] leading-snug font-medium text-foreground">{r.title}</p>
              <p className="mt-0.5 truncate text-[14.5px] text-muted-foreground">
                {r.company} · {r.mode}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/* ── Company: your listings at a glance ──────────────────────────────── */
export function YourListings({ items, now, className }: { items: InternshipRow[]; now: number; className?: string }) {
  const rows = items.slice(0, 5)
  return (
    <Panel
      className={className}
      title="Your listings"
      style={stagger(6)}
      action={<Link href="/dashboard/company/internships" className="text-[16px] font-medium underline-offset-4 hover:underline">Manage</Link>}
      contentClassName="-mx-3"
    >
      {rows.length === 0 ? (
        <p className="px-3 py-10 text-center text-sm text-muted-foreground">Post your first internship to see it here.</p>
      ) : (
        <ul className="stagger">
          {rows.map((i) => {
            const days = daysUntil(i.deadline, now)
            return (
              <li key={i.id}>
                <Link href={`/internships/${i.id}`} className="flex items-center gap-4 rounded-[20px] px-3 py-3 transition-colors duration-150 hover:bg-secondary/70">
                  <OrgAvatar name={i.title} className="size-11" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-medium">{i.title}</p>
                    <p className="mt-0.5 truncate text-[15px] text-muted-foreground capitalize">
                      {i.status} · {i.openings} opening{i.openings === 1 ? "" : "s"} · {rupees(i.stipend)}/mo
                    </p>
                  </div>
                  <div className="hidden w-24 shrink-0 sm:block">
                    <TickProgress className="h-5" value={i.status === "published" ? Math.max(0, Math.min(100, (days / 30) * 100)) : 0} ticks={14} />
                    <p className="mt-1.5 text-right text-[14px] text-muted-foreground tabular-nums">
                      {i.status !== "published" ? "—" : days > 0 ? `${days} days left` : "Closed"}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
