"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"

import { MODE_LABEL } from "@/lib/internship-data"
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/icons"
import { PlateArt, type ArtKind } from "@/components/landing/plate-art"

const CATS = [
  { id: "all", label: "All roles", test: () => true },
  { id: "dev", label: "Development", test: (t: string) => /develop|engineer|devops|backend|frontend|software/i.test(t) },
  { id: "design", label: "Design", test: (t: string) => /design|ux|ui\b/i.test(t) },
  { id: "data", label: "Data & AI", test: (t: string) => /data|ml\b|machine|research|analyst/i.test(t) },
]

/** One colour and one line-art figure per card, in the same language as the plates in the horizontal journey. */
export const LOOKS: { tint: string; hue: number; art: ArtKind }[] = [
  { tint: "oklch(0.955 0.04 300)", hue: 300, art: "silk" },
  { tint: "oklch(0.955 0.04 230)", hue: 230, art: "ripples" },
  { tint: "oklch(0.955 0.045 175)", hue: 175, art: "waves" },
  { tint: "oklch(0.965 0.045 80)", hue: 70, art: "contours" },
  { tint: "oklch(0.955 0.04 345)", hue: 345, art: "rays" },
  { tint: "oklch(0.955 0.04 262)", hue: 262, art: "spiro" },
]

/** Showcase roles for the landing page: well-known companies with their real logos (from /public/logos). */
export interface ShowcaseJob {
  id: string
  title: string
  company: string
  logo: string
  location: string
  work_mode: "onsite" | "hybrid" | "remote"
  stipend: number
  duration_months: number
  openings: number
  skills: number
  days_left: number
}

export const SHOWCASE: ShowcaseJob[] = [
  { id: "google", title: "Software Engineering Intern", company: "Google", logo: "google", location: "Bengaluru", work_mode: "hybrid", stipend: 100000, duration_months: 3, openings: 6, skills: 5, days_left: 12 },
  { id: "nvidia", title: "Deep Learning Research Intern", company: "NVIDIA", logo: "nvidia", location: "Pune", work_mode: "onsite", stipend: 90000, duration_months: 6, openings: 3, skills: 6, days_left: 9 },
  { id: "atlassian", title: "Frontend Engineering Intern", company: "Atlassian", logo: "atlassian", location: "Bengaluru", work_mode: "remote", stipend: 85000, duration_months: 3, openings: 4, skills: 4, days_left: 18 },
  { id: "meta", title: "Product Design Intern", company: "Meta", logo: "meta", location: "Hyderabad", work_mode: "hybrid", stipend: 80000, duration_months: 3, openings: 2, skills: 4, days_left: 6 },
  { id: "razorpay", title: "Backend Engineer Intern", company: "Razorpay", logo: "razorpay", location: "Bengaluru", work_mode: "onsite", stipend: 60000, duration_months: 6, openings: 5, skills: 5, days_left: 14 },
  { id: "netflix", title: "Data Science Intern", company: "Netflix", logo: "netflix", location: "Mumbai", work_mode: "hybrid", stipend: 75000, duration_months: 3, openings: 2, skills: 5, days_left: 21 },
  { id: "postman", title: "DevOps Intern", company: "Postman", logo: "postman", location: "Bengaluru", work_mode: "remote", stipend: 50000, duration_months: 6, openings: 3, skills: 4, days_left: 11 },
  { id: "swiggy", title: "Data Analyst Intern", company: "Swiggy", logo: "swiggy", location: "Bengaluru", work_mode: "hybrid", stipend: 45000, duration_months: 6, openings: 4, skills: 4, days_left: 5 },
  { id: "figma", title: "UX Design Intern", company: "Figma", logo: "figma", location: "Remote", work_mode: "remote", stipend: 70000, duration_months: 3, openings: 2, skills: 3, days_left: 25 },
  { id: "phonepe", title: "Android Developer Intern", company: "PhonePe", logo: "phonepe", location: "Pune", work_mode: "onsite", stipend: 55000, duration_months: 6, openings: 4, skills: 4, days_left: 16 },
  { id: "zomato", title: "Machine Learning Intern", company: "Zomato", logo: "zomato", location: "Gurugram", work_mode: "hybrid", stipend: 50000, duration_months: 6, openings: 3, skills: 5, days_left: 8 },
  { id: "zoho", title: "Full Stack Developer Intern", company: "Zoho", logo: "zoho", location: "Chennai", work_mode: "onsite", stipend: 35000, duration_months: 6, openings: 8, skills: 5, days_left: 20 },
]
export const short = (v: string | number) => {
  const n = Number(v || 0)
  return n >= 1000 ? `${Math.round(n / 1000)}K` : String(n)
}

const INK = "oklch(0.22 0.05 280)"

/** A framed card: a tinted plate with its own figure and a big stipend, then the role, the facts and the company. */
function JobCard({ j, i }: { j: ShowcaseJob; i: number }) {
  const ref = React.useRef<HTMLAnchorElement>(null)
  const look = LOOKS[i % LOOKS.length]
  const left = j.days_left
  const urgent = left > 0 && left <= 7

  const move = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const el = ref.current
    if (!el || e.pointerType !== "mouse") return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty("--rx", `${(-py * 6).toFixed(2)}deg`)
    el.style.setProperty("--ry", `${(px * 8).toFixed(2)}deg`)
  }
  const leave = () => {
    ref.current?.style.setProperty("--rx", "0deg")
    ref.current?.style.setProperty("--ry", "0deg")
  }

  return (
    <li className="shrink-0 snap-start [perspective:1100px] sm:[zoom:0.86]">
      <Link
        ref={ref}
        href="/internships"
        style={{ color: INK }}
        onPointerMove={move}
        onPointerLeave={leave}
        className="group/job relative flex w-[min(17.5rem,78vw)] flex-col rounded-[26px] bg-white p-1.5 sm:h-[33rem] sm:w-[21rem] sm:rounded-[34px] sm:p-2text-[oklch(0.22_0.05_280)] shadow-[0_26px_44px_-30px_oklch(0.15_0.1_280/0.5),0_2px_5px_oklch(0.15_0.1_280/0.1)] transition-transform duration-300 ease-(--ease-out) will-change-transform outline-none [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))] focus-visible:ring-2 focus-visible:ring-white lg:w-[max(19.5rem,calc((100vw-2*clamp(1.5rem,4vw,4rem)-4.5rem)/4))]"
      >
        {/* the plate */}
        <div className="relative flex min-h-[13.5rem] flex-1 flex-col overflow-hidden rounded-[21px] p-4 sm:min-h-0 sm:rounded-[27px] sm:p-6" style={{ background: `linear-gradient(160deg, oklch(0.995 0.004 ${look.hue}), ${look.tint})` }}>
          <PlateArt kind={look.art} hue={look.hue} id={`jc-${i}`} />
          <span aria-hidden className="pointer-events-none absolute inset-[7px] rounded-[21px] border border-[oklch(0.22_0.05_280/0.12)]" />

          <div className="relative flex items-center justify-between">
            <span className="font-display text-[1.35rem] leading-none tracking-[0.06em] text-[oklch(0.22_0.05_280/0.55)] italic">{String(i + 1).padStart(2, "0")}</span>
            <span className="rounded-full border border-[oklch(0.22_0.05_280/0.14)] bg-white/90 px-3.5 py-1.5 text-[12.5px] font-medium tracking-[0.02em] shadow-[0_6px_14px_-8px_oklch(0.2_0.06_280/0.35)]">{MODE_LABEL[j.work_mode] ?? j.work_mode}</span>
          </div>

          <div className="relative mt-auto">
            <p className="font-display text-[4.2rem] leading-[0.82] tracking-[-0.03em] italic sm:text-[6rem] [text-shadow:0_1px_0_oklch(1_0_0/0.7),0_0_30px_oklch(1_0_0/0.9),0_0_12px_oklch(1_0_0/0.6)]">
              <span className="mr-1 align-top text-[1.5rem] not-italic sm:text-[2.1rem]">₹</span>
              {short(j.stipend)}
            </p>
            <p className="mt-3.5 flex items-center gap-2.5 text-[12.5px] tracking-[0.16em] text-[oklch(0.22_0.05_280/0.62)] uppercase">
              <span aria-hidden className="h-px w-5 bg-[oklch(0.22_0.05_280/0.4)]" />
              per month · {j.duration_months} months
            </p>
          </div>
        </div>

        {/* the role */}
        <div className="px-3 pt-4 pb-2 sm:px-4 sm:pt-5 sm:pb-3">
          <h3 className="text-[19px] leading-[1.15] sm:text-[24px] sm:leading-[1.1] font-medium tracking-[-0.03em] text-balance">{j.title}</h3>
          <p className="mt-1.5 flex items-center gap-2 text-[15px] text-[oklch(0.22_0.05_280/0.6)]">
            <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 14.5s4.6-4.1 4.6-7.7A4.6 4.6 0 0 0 3.4 6.8C3.4 10.4 8 14.5 8 14.5Z" />
              <circle cx="8" cy="6.8" r="1.6" />
            </svg>
            {j.location}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {j.openings > 0 && <span className="rounded-full border border-[oklch(0.22_0.05_280/0.14)] px-3 py-1 text-[12.5px] font-medium">{j.openings} {j.openings === 1 ? "opening" : "openings"}</span>}
            <span className="rounded-full border border-[oklch(0.22_0.05_280/0.14)] px-3 py-1 text-[12.5px] font-medium">{j.skills} skills</span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-medium"
              style={{ background: urgent ? "oklch(0.95 0.06 60)" : "oklch(0.96 0.012 280)", color: urgent ? "oklch(0.42 0.12 50)" : INK }}
            >
              <span aria-hidden className={cn("size-1.5 rounded-full", urgent && "animate-pulse")} style={{ background: urgent ? "oklch(0.62 0.17 50)" : "oklch(0.65 0.12 160)" }} />
              {left > 0 ? `${left} days left` : "Closed"}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-3 border-t border-[oklch(0.22_0.05_280/0.1)] pt-3 sm:mt-5 sm:pt-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[oklch(0.22_0.05_280/0.1)] bg-white shadow-[0_4px_10px_-6px_oklch(0.2_0.06_280/0.35)] sm:size-11">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/logos/${j.logo}.svg`} alt={`${j.company} logo`} className="size-[55%] object-contain" loading="lazy" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[11px] tracking-[0.2em] text-[oklch(0.22_0.05_280/0.5)] uppercase">Hiring company</p>
              <p className="mt-1 truncate text-[16.5px] font-medium">{j.company}</p>
            </div>
            <span className="flex size-10 shrink-0 items-center sm:size-12 justify-center rounded-full bg-[oklch(0.22_0.05_280)] text-white transition-transform duration-500 ease-(--ease-out) group-hover/job:-rotate-45">
              <ArrowRightIcon className="size-5" />
            </span>
          </div>
        </div>
      </Link>
    </li>
  )
}

/** Category tabs with a sliding hairline marker, then a swipeable row of listings that runs the full width of the screen. */
export function LatestJobs() {
  const jobs = SHOWCASE
  const [cat, setCat] = React.useState("all")
  const rail = React.useRef<HTMLUListElement>(null)
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([])
  const [mark, setMark] = React.useState({ x: 0, w: 0 })

  const counts = CATS.map((c) => ({ ...c, n: jobs.filter((j) => c.test(j.title)).length }))
  const index = Math.max(0, CATS.findIndex((c) => c.id === cat))
  const active = CATS[index]
  const list = jobs.filter((j) => active.test(j.title))

  React.useLayoutEffect(() => {
    const el = tabRefs.current[index]
    if (el) setMark({ x: el.offsetLeft, w: el.offsetWidth })
  }, [index, jobs.length])

  const [pos, setPos] = React.useState(0)
  const tick = React.useRef(0)
  const onScroll = () => {
    if (tick.current) return
    tick.current = requestAnimationFrame(() => {
      tick.current = 0
      const el = rail.current
      const first = el?.firstElementChild as HTMLElement | null
      if (!el || !first) return
      const step = first.getBoundingClientRect().width + parseFloat(getComputedStyle(el).columnGap || "24")
      setPos(Math.max(0, Math.round(el.scrollLeft / step)))
    })
  }
  React.useEffect(() => () => cancelAnimationFrame(tick.current), [])
  const nudge = (dir: 1 | -1) => rail.current?.scrollBy({ left: dir * 460, behavior: "smooth" })
  const gutter = "px-[clamp(1.5rem,4vw,4rem)]"

  return (
    <div className="mt-6 sm:mt-8">
      <div className={`flex flex-wrap items-center justify-between gap-5 ${gutter}`}>
        <div className="no-scrollbar relative max-w-full overflow-x-auto" role="tablist" aria-label="Categories">
          <ul className="flex gap-2">
            {counts.map((c, i) => (
              <li key={c.id} className="shrink-0">
                <button
                  ref={(el) => {
                    tabRefs.current[i] = el
                  }}
                  type="button"
                  role="tab"
                  aria-selected={cat === c.id}
                  onClick={() => setCat(c.id)}
                  className={cn(
                    "font-display flex h-11 items-center px-3.5 text-[1.05rem] tracking-[0.08em] uppercase italic sm:h-14 sm:px-6 sm:text-[1.45rem] outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-white",
                    cat === c.id ? "text-white" : "text-white/55 hover:text-white"
                  )}
                >
                  {c.label}
                  <sup className="relative -top-[0.1em] ml-1.5 text-[0.5em] tracking-normal text-white/70 not-italic tabular-nums">{c.n}</sup>
                </button>
              </li>
            ))}
          </ul>
          <span aria-hidden className="absolute right-0 bottom-0 left-0 h-px bg-gradient-to-r from-white/40 via-white/20 to-transparent" />
          <span
            aria-hidden
            className="absolute bottom-0 left-0 h-[3px] rounded-full bg-white shadow-[0_0_12px_1px_oklch(1_0_0/0.5)] transition-[transform,width] duration-500 ease-(--ease-drawer)"
            style={{ width: mark.w, transform: `translateX(${mark.x}px)` }}
          />
        </div>

        <div className="flex items-center gap-6 max-sm:hidden">
          <p aria-live="polite" className="font-display text-[1.6rem] leading-none tracking-[0.04em] text-white italic tabular-nums">
            {String(Math.min(pos + 1, Math.max(list.length, 1))).padStart(2, "0")}
            <span className="mx-2.5 text-white/40">/</span>
            <span className="text-white/60">{String(list.length).padStart(2, "0")}</span>
          </p>
          <div className="flex gap-2.5">
            {([-1, 1] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => nudge(dir)}
                aria-label={dir < 0 ? "Previous" : "Next"}
                className="group/nav flex h-12 w-[4.5rem] items-center justify-center rounded-full border border-white/50 text-white outline-none transition-[background-color,color,transform] duration-300 ease-(--ease-out) hover:bg-white hover:text-[oklch(0.3_0.12_282)] focus-visible:ring-2 focus-visible:ring-white active:scale-95"
              >
                {dir < 0 ? <ChevronLeftIcon className="size-5 transition-transform duration-300 group-hover/nav:-translate-x-0.5" /> : <ChevronRightIcon className="size-5 transition-transform duration-300 group-hover/nav:translate-x-0.5" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* full-bleed: cards start at the page gutter and slide off the real screen edges */}
      <ul ref={rail} onScroll={onScroll} className={`no-scrollbar -mt-2 flex snap-x snap-mandatory scroll-px-[clamp(1.5rem,4vw,4rem)] gap-4 overflow-x-auto pt-6 pb-10 -mb-8 sm:gap-5 sm:pt-8 sm:pb-14 sm:-mb-10 ${gutter}`}>
        {list.map((j, i) => (
          <JobCard key={j.id} j={j} i={i} />
        ))}
        {list.length === 0 && <li className="py-16 text-[17px] text-white/70">No roles in this category yet.</li>}
      </ul>
    </div>
  )
}
