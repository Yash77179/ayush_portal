"use client"

import Link from "next/link"
import { cn } from "cn"

import { MODE_LABEL, type BrowseInternship } from "@/lib/internship-data"
import { useSavedJobs } from "@/lib/use-jobs"
import { BookmarkIcon, BookmarkSolidIcon, ArrowRightUpIcon } from "@/components/icons"
import { OrgAvatar, TickProgress } from "@/components/kit"

const PANEL_TONES = ["tone-peach", "tone-mint", "tone-violet", "tone-blue", "tone-pink", "tone-mist"]

export function daysUntil(deadline: string, now: number) {
  return Math.ceil((new Date(deadline).getTime() - now) / 86_400_000)
}

const rupees = (v: string | number) => `₹${Number(v || 0).toLocaleString("en-IN")}`

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-8 items-center rounded-full border border-foreground/25 px-3.5 text-[13.5px] whitespace-nowrap text-foreground/80">
      {children}
    </span>
  )
}

function SaveButton({ id, inert }: { id: number; inert?: boolean }) {
  const { has, toggle } = useSavedJobs()
  const saved = has(id)
  return (
    <button
      type="button"
      tabIndex={inert ? -1 : 0}
      onClick={inert ? undefined : () => toggle(id)}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save job"}
      className={cn(
        "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-[0_1px_2px_oklch(0.2_0.04_280/0.06)] outline-none transition-[transform,background-color] duration-150 hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring active:scale-90",
        inert && "pointer-events-none"
      )}
    >
      {saved ? <BookmarkSolidIcon className="size-5" /> : <BookmarkIcon className="size-5" />}
    </button>
  )
}

/** The listing card used on the browse page, in related lists and in the post-job preview. */
export function InternshipCard({
  internship,
  now,
  index = 0,
  onApply,
  preview = false,
  className,
}: {
  internship: BrowseInternship
  now: number
  index?: number
  onApply?: (i: BrowseInternship) => void
  /** Preview mode renders inert buttons (used while posting a job). */
  preview?: boolean
  className?: string
}) {
  const daysLeft = daysUntil(internship.deadline, now)
  const urgent = daysLeft > 0 && daysLeft <= 7
  const href = `/internships/${internship.id}`
  const closes = new Date(internship.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })

  return (
    <article
      className={cn("rise lift glass-card group/job relative flex flex-col rounded-[32px] bg-card p-2 text-foreground [--fh:4.5rem] [--r:32px]", className)}
      style={{ "--i": index } as React.CSSProperties}
    >
      {/* colour panel */}
      <div className={cn(PANEL_TONES[index % PANEL_TONES.length], "flex flex-1 flex-col rounded-[26px] bg-[color-mix(in_oklab,var(--t-bg)_72%,var(--card))] p-5 text-foreground")}>
        <div className="flex items-center justify-between gap-3">
          <span className={cn("inline-flex h-11 items-center rounded-full bg-card px-4 text-[14.5px] font-medium", "text-foreground")}>
            {daysLeft > 0 ? `Closes ${closes}` : "Closed"}
          </span>
          <SaveButton id={internship.id} inert={preview} />
        </div>

        <div className="mt-7 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-[15px] text-foreground/70">{internship.company_name}</p>
            <h3 className="mt-1.5 text-[26px] leading-[1.12] font-medium tracking-[-0.025em]">
              {preview ? (
                internship.title
              ) : (
                <Link href={href} className="outline-none after:absolute after:inset-0 after:z-0 after:rounded-[32px] focus-visible:after:ring-2 focus-visible:after:ring-ring">
                  {internship.title}
                </Link>
              )}
            </h3>
          </div>
          <OrgAvatar name={internship.company_name} className="size-14 shrink-0 bg-card text-[16px] ring-4 ring-card/70 [&>*]:text-[16px]" />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Chip>{MODE_LABEL[internship.work_mode] ?? internship.work_mode}</Chip>
          <Chip>{internship.duration_months} months</Chip>
          <Chip>
            {internship.openings} opening{internship.openings === 1 ? "" : "s"}
          </Chip>
          <Chip>{internship.skills_count} skills</Chip>
        </div>

        <div className="mt-auto pt-6">
          <TickProgress
            value={Math.max(0, Math.min(100, (daysLeft / 30) * 100))}
            color={urgent ? "oklch(0.72 0.09 28)" : "color-mix(in oklab, var(--foreground) 38%, transparent)"}
            ticks={26}
            className="h-6"
          />
          <p className={cn("mt-2 text-[14px]", urgent ? "text-[oklch(0.58_0.1_28)]" : "text-foreground/55")}>
            {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left to apply` : "Deadline passed"}
          </p>
        </div>
      </div>

      {/* footer: stipend on the left; the Apply button sits in a notch cut into the panel's bottom-right corner */}
      <div className="flex h-(--fh) items-center px-4">
        <div className="min-w-0 pr-[13.5rem]">
          <p className="text-[22px] leading-none font-medium tracking-[-0.02em] tabular-nums">
            {rupees(internship.stipend)}
            <span className="ml-1 text-[14px] font-normal tracking-normal text-muted-foreground">/mo</span>
          </p>
          <p className="mt-1.5 truncate text-[14.5px] text-muted-foreground">{internship.location || MODE_LABEL[internship.work_mode] || "Flexible"}</p>
        </div>
      </div>

      {/* the notch + its two inverted-corner fillets */}
      <div aria-hidden className="pointer-events-none absolute right-2 bottom-[calc(0.5rem+var(--fh)+2.5rem)] size-[26px] [background:radial-gradient(circle_at_0_0,transparent_25.5px,var(--card)_26px)]" />
      <div aria-hidden className="pointer-events-none absolute right-[calc(0.5rem+13rem)] bottom-[calc(0.5rem+var(--fh))] size-[26px] [background:radial-gradient(circle_at_0_0,transparent_25.5px,var(--card)_26px)]" />
      <div className="absolute right-2 bottom-2 flex h-[calc(var(--fh)+2.5rem)] w-52 items-center justify-center rounded-tl-[26px] bg-card">
        {preview ? (
          <span aria-hidden className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-[15.5px] font-medium text-primary-foreground">
            Apply now
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onApply?.(internship)}
            disabled={daysLeft <= 0}
            className="relative z-10 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-[15.5px] font-medium text-primary-foreground outline-none transition-[transform,opacity] duration-150 hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-ring active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            {daysLeft > 0 ? "Apply now" : "Closed"}
            {daysLeft > 0 && <ArrowRightUpIcon className="size-4" />}
          </button>
        )}
      </div>
    </article>
  )
}
