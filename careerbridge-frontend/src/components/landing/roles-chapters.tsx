"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"

import { ArrowRightIcon } from "@/components/icons"
import { PlateArt, type ArtKind } from "@/components/landing/plate-art"
import { Roll } from "@/components/landing/roll-link"

/**
 * "Who it's for" on phones & tablets — three chapters you see rather than read.
 *
 * Every chapter has the same build, so the eye always knows where it is:
 *   number + title  →  one line  →  the story panel (three beats); "Pick yours" at the end is the way in
 * The beats are made things, not widgets — paper, ink and rubber stamps, in the page's serif: a highlighter sweeps a
 * real resume, an inked loop draws round an 86 that counts up, the application travels a route to an OFFER stamp;
 * a printed notice types itself and gets a LIVE stamp, a podium ranks candidates, a funnel inks in and is stamped
 * HIRED; a hall of seats fills, a radar of a batch's skills draws itself, a seal turns around 92%.
 * It ends with the choice itself: three round plates, tap yours to start.
 * With reduced motion every beat simply shows its finished state.
 */

/** The oval link used across this section (shared with the desktop journey). */
export function OvalLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="group/oval font-display relative inline-flex h-14 items-center justify-center px-12 text-[1.1rem] tracking-[0.08em] text-[oklch(0.22_0.06_280)] uppercase outline-none">
      <svg aria-hidden viewBox="0 0 320 56" preserveAspectRatio="none" className="absolute inset-0 size-full text-[oklch(0.22_0.06_280/0.55)] transition-[transform,color] duration-500 ease-(--ease-out) group-hover/oval:scale-[1.06] group-hover/oval:text-[oklch(0.22_0.06_280)]" fill="none" stroke="currentColor">
        <ellipse cx="160" cy="28" rx="158" ry="26" />
      </svg>
      <span className="relative">
        <Roll>{children}</Roll>
      </span>
    </Link>
  )
}

/* ── plumbing ───────────────────────────────────────────────────────────────────────────────────────────────────── */
function useInView<T extends Element>(threshold = 0.6) {
  const ref = React.useRef<T>(null)
  const [on, setOn] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        setOn(true)
      },
      { threshold }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return [ref, on] as const
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Counts 0 → target once `on` turns true (ease-out). */
function useCount(target: number, on: boolean, ms = 1300, delay = 0) {
  const [v, setV] = React.useState(0)
  React.useEffect(() => {
    if (!on) return
    let raf = 0
    let start = 0
    const still = reduced()
    const tick = (t: number) => {
      if (!start) start = t
      const p = still ? 1 : Math.min(1, Math.max(0, (t - start - delay) / ms))
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [on, target, ms, delay])
  return v
}

/** Types `text` out once `on` turns true. */
function useTyped(text: string, on: boolean, delay = 200) {
  const [n, setN] = React.useState(0)
  React.useEffect(() => {
    if (!on) return
    if (reduced()) {
      const id = requestAnimationFrame(() => setN(text.length))
      return () => cancelAnimationFrame(id)
    }
    let i = 0
    let iv: ReturnType<typeof setInterval> | undefined
    const t = setTimeout(() => {
      iv = setInterval(() => {
        i += 1
        setN(i)
        if (i >= text.length && iv) clearInterval(iv)
      }, 55)
    }, delay)
    return () => {
      clearTimeout(t)
      if (iv) clearInterval(iv)
    }
  }, [on, text, delay])
  return text.slice(0, n)
}

/** Steps 0 → steps-1, one every `every` ms, once `on`. */
function useSteps(steps: number, on: boolean, every = 520, delay = 250) {
  const [s, setS] = React.useState(-1)
  React.useEffect(() => {
    if (!on) return
    if (reduced()) {
      const id = requestAnimationFrame(() => setS(steps - 1))
      return () => cancelAnimationFrame(id)
    }
    const ts = Array.from({ length: steps }, (_, i) => setTimeout(() => setS(i), delay + i * every))
    return () => ts.forEach(clearTimeout)
  }, [on, steps, every, delay])
  return s
}

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
const INK = "oklch(0.2 0.05 280)"
const VIOLET = "oklch(0.47 0.17 285)"
const MUTED = "text-[oklch(0.22_0.06_280/0.6)]"
/** ink for stamps: a deep, slightly warm violet-red, like a real rubber stamp pad */
const STAMP = "oklch(0.5 0.19 350)"

function rise(on: boolean, delay = 0) {
  return {
    className: cn("transition-[opacity,translate] duration-700", EASE, on ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"),
    style: { transitionDelay: on ? `${delay}ms` : "0ms" } as React.CSSProperties,
  }
}

/* ── hand-made pieces: ink that draws itself, a highlighter, a rubber stamp ─────────────────────────────────────── */
/** A loose, hand-drawn loop that draws itself around whatever it wraps. */
function InkCircle({ on, delay = 0, className, color = VIOLET }: { on: boolean; delay?: number; className?: string; color?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 120 80" preserveAspectRatio="none" className={cn("pointer-events-none absolute", className)} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round">
      <path
        d="M70 6C40 3 9 15 6 38c-3 24 25 37 56 36 32-1 54-15 52-37C112 15 86 4 58 9"
        pathLength={1}
        strokeDasharray="1"
        className={cn("transition-[stroke-dashoffset] duration-[900ms]", EASE)}
        style={{ strokeDashoffset: on ? 0 : 1, transitionDelay: on ? `${delay}ms` : "0ms" }}
      />
    </svg>
  )
}

/** A word on paper that a highlighter sweeps across. */
function Mark({ on, delay, children }: { on: boolean; delay: number; children: React.ReactNode }) {
  return (
    <span
      className={cn("rounded-[2px] bg-no-repeat px-0.5 font-semibold text-[oklch(0.2_0.05_280)] transition-[background-size] duration-500", EASE)}
      style={{
        backgroundImage: "linear-gradient(100deg, oklch(0.85 0.13 300 / 0.75), oklch(0.82 0.15 290 / 0.85))",
        backgroundPosition: "0 82%",
        backgroundSize: on ? "100% 72%" : "0% 72%",
        transitionDelay: on ? `${delay}ms` : "0ms",
      }}
    >
      {children}
    </span>
  )
}

/** A rubber stamp that lands: drops from above at a skew, overshoots, settles crooked. */
function Stamp({ on, delay = 0, children, className, tilt = -9 }: { on: boolean; delay?: number; children: React.ReactNode; className?: string; tilt?: number }) {
  return (
    <span
      className={cn(
        "font-display pointer-events-none inline-flex items-center gap-1.5 rounded-[7px] border-[2.5px] px-2.5 py-0.5 text-[1.05rem] tracking-[0.12em] uppercase italic mix-blend-multiply transition-[opacity,scale,rotate] duration-[420ms] ease-[cubic-bezier(0.2,1.7,0.4,1)] motion-reduce:transition-none",
        className
      )}
      style={{
        color: STAMP,
        borderColor: STAMP,
        boxShadow: `inset 0 0 0 2px oklch(1 0 0 / 0.5), inset 0 0 0 3.5px ${STAMP}`,
        opacity: on ? 0.92 : 0,
        scale: on ? "1" : "1.9",
        rotate: `${on ? tilt : tilt - 14}deg`,
        transitionDelay: on ? `${delay}ms` : "0ms",
        maskImage: "radial-gradient(circle at 30% 40%, #000 60%, rgb(0 0 0 / 0.75) 100%)",
      }}
    >
      {children}
    </span>
  )
}

/* ── the beat: "01 — label ———" then its object ─────────────────────────────────────────────────────────────────── */
function Beat({ n, label, children }: { n: number; label: string; children: (on: boolean) => React.ReactNode }) {
  const [ref, on] = useInView<HTMLLIElement>(0.55)
  return (
    <li ref={ref} className="py-4 first:pt-1">
      <p className="flex items-center gap-3">
        <span className={cn("font-display text-[1.05rem] italic transition-colors duration-500", on ? "text-[oklch(0.47_0.17_285)]" : "text-[oklch(0.22_0.06_280/0.4)]")}>0{n}</span>
        <span className="text-[11px] font-semibold tracking-[0.18em] text-[oklch(0.22_0.06_280/0.75)] uppercase">{label}</span>
        <span aria-hidden className="relative h-px flex-1 overflow-hidden bg-[oklch(0.2_0.05_280/0.12)]">
          <span className={cn("absolute inset-0 origin-left bg-[oklch(0.47_0.17_285/0.6)] transition-[scale] duration-[1100ms]", EASE)} style={{ scale: on ? "1 1" : "0 1" }} />
        </span>
      </p>
      <div className="mt-3">{children(on)}</div>
    </li>
  )
}

/* ── students ──────────────────────────────────────────────────────────────────────────────────────────────────── */
function ResumeRead({ on }: { on: boolean }) {
  return (
    <div className="relative flex items-start gap-3">
      {/* a real sheet of paper, a little crooked */}
      <div className="relative w-[74%] -rotate-[1.6deg] rounded-[3px] bg-[oklch(0.995_0.004_90)] px-3.5 pt-3 pb-3.5 shadow-[0_1px_0_oklch(0.2_0.05_280/0.06),0_14px_26px_-16px_oklch(0.2_0.06_280/0.45)]">
        <span aria-hidden className="absolute top-0 right-0 size-5 bg-[linear-gradient(225deg,oklch(0.93_0.02_285)_50%,oklch(0.985_0.004_90)_50%)] shadow-[-1px_1px_2px_oklch(0.2_0.05_280/0.08)]" />
        <p className="font-display text-[1.15rem] leading-none italic">Arjun Mehta</p>
        <p className="mt-1 text-[9px] tracking-[0.18em] text-[oklch(0.22_0.06_280/0.5)] uppercase">B.Tech CSE · 2026</p>
        <span aria-hidden className="mt-2.5 block h-px bg-[oklch(0.2_0.05_280/0.15)]" />
        <ul className="mt-2.5 space-y-1.5 text-[11.5px] leading-snug text-[oklch(0.22_0.06_280/0.72)]">
          <li>Scraped 2k listings with <Mark on={on} delay={500}>Python</Mark></li>
          <li>Shipped a <Mark on={on} delay={900}>React</Mark> dashboard</li>
          <li>Wrote weekly <Mark on={on} delay={1300}>SQL</Mark> reports</li>
        </ul>
      </div>
      {/* the margin note */}
      <div {...rise(on, 1700)}>
        <div className="mt-8 flex flex-col items-start">
          <svg aria-hidden viewBox="0 0 40 24" className="-ml-2 w-9 text-[oklch(0.47_0.17_285)]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M38 4C26 2 12 8 6 18M6 18l-1-7M6 18l7-2" />
          </svg>
          <p className="font-display mt-1 text-[1.25rem] leading-[1.05] text-[oklch(0.47_0.17_285)] italic">
            3 skills,
            <br />
            found
          </p>
        </div>
      </div>
    </div>
  )
}

function Matched({ on }: { on: boolean }) {
  const v = useCount(86, on, 1300, 200)
  const also = useCount(78, on, 1300, 500)
  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0 px-3 py-1">
        <InkCircle on={on} delay={900} className="-inset-x-1 -inset-y-2 h-[calc(100%+1rem)] w-[calc(100%+0.5rem)]" />
        <p className="font-display flex items-start leading-[0.8] tabular-nums italic">
          <span className="inline-block w-[2ch] text-right text-[3.8rem]">{v}</span>
          <span className="mt-1.5 ml-0.5 text-[1.4rem]">%</span>
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-[oklch(0.22_0.06_280/0.5)] uppercase">Your best match</p>
        <p className="font-display mt-1 text-[1.25rem] leading-[1.05] italic">Frontend Intern</p>
        <p className={cn("mt-0.5 text-[12.5px] font-medium", MUTED)}>Zoho Corporation · Chennai</p>
        <p className={cn("mt-2.5 border-t border-[oklch(0.2_0.05_280/0.12)] pt-2 text-[11.5px]", MUTED)}>
          also <span className="font-display inline-block w-[2ch] text-right text-[0.95rem] text-[oklch(0.22_0.06_280)] tabular-nums italic">{also}</span> · Data Analyst, Razorpay
        </p>
      </div>
    </div>
  )
}

const STATIONS = ["Applied", "Review", "Shortlist", "Offer"]
const OFFER_RED = "oklch(0.58 0.2 25)"
function Tracked({ on }: { on: boolean }) {
  // one step at a time: the line inks to the next station, then that station fills. Every station is drawn the same
  // way; the last one, Offer, turns red and gets a small ring around it.
  const s = useSteps(STATIONS.length, on, 650, 250)
  const last = STATIONS.length - 1
  const span = 100 - 100 / STATIONS.length // the line runs from the first station's centre to the last one's
  return (
    <div className="relative grid grid-cols-4 pt-1">
      {/* the route: a faint dashed line the whole way, inked over as the application travels it */}
      <span aria-hidden className="absolute top-[15px] h-0 border-t-[1.5px] border-dashed border-[oklch(0.2_0.05_280/0.25)]" style={{ left: `${50 / STATIONS.length}%`, right: `${50 / STATIONS.length}%` }} />
      <span
        aria-hidden
        className="absolute top-[14px] h-[2.5px] rounded-full bg-[oklch(0.47_0.17_285)] transition-[width] duration-[600ms] ease-out motion-reduce:transition-none"
        style={{ left: `${50 / STATIONS.length}%`, width: s <= 0 ? "0%" : `${(Math.min(s, last) / last) * span}%` }}
      />
      {STATIONS.map((st, i) => {
        const reached = s >= i
        const offer = i === last && reached
        const color = offer ? OFFER_RED : "oklch(0.47 0.17 285)"
        return (
          <div key={st} className="relative flex flex-col items-center">
            <span className="relative z-10 grid size-[22px] place-items-center">
              {/* the small ring that marks the finish */}
              {i === last && (
                <span
                  aria-hidden
                  className={cn("absolute -inset-[6px] rounded-full border-[1.5px] transition-[opacity,scale] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none", offer ? "scale-100 opacity-100" : "scale-50 opacity-0")}
                  style={{ borderColor: OFFER_RED, transitionDelay: offer ? "550ms" : "0ms" }}
                />
              )}
              <span
                className={cn("grid size-[22px] place-items-center rounded-full border-[1.5px] bg-[oklch(0.995_0.004_90)] transition-[border-color,scale] duration-300", reached ? "scale-100" : "scale-90")}
                style={{ borderColor: reached ? color : "oklch(0.2 0.05 280 / 0.25)", transitionDelay: reached ? "350ms" : "0ms" }}
              >
                <span className={cn("size-2 rounded-full transition-[scale] duration-300", reached ? "scale-100" : "scale-0")} style={{ background: color, transitionDelay: reached ? "450ms" : "0ms" }} />
              </span>
            </span>
            <span
              className={cn("font-display mt-2 text-[1rem] italic transition-colors duration-300", reached ? "" : "text-[oklch(0.22_0.06_280/0.38)]")}
              style={reached ? { color: offer ? OFFER_RED : "oklch(0.22 0.06 280)", transitionDelay: "350ms" } : undefined}
            >
              {st}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ── companies ─────────────────────────────────────────────────────────────────────────────────────────────────── */
function Posted({ on }: { on: boolean }) {
  const title = useTyped("Frontend Intern", on, 250)
  const typed = title.length === "Frontend Intern".length
  return (
    <div className="relative">
      {/* a printed notice: double rule frame, cream stock */}
      <div className="relative rotate-[0.8deg] rounded-[3px] bg-[oklch(0.99_0.008_85)] p-1.5 shadow-[0_14px_26px_-16px_oklch(0.2_0.06_280/0.45)]">
        <div className="border border-[oklch(0.2_0.05_280/0.55)] px-4 pt-3 pb-3.5 [box-shadow:inset_0_0_0_3px_oklch(0.99_0.008_85),inset_0_0_0_4px_oklch(0.2_0.05_280/0.35)]">
          <p className="text-center text-[9.5px] font-semibold tracking-[0.3em] text-[oklch(0.22_0.06_280/0.6)] uppercase">— Now hiring —</p>
          <p className="font-display mt-1.5 min-h-[1.2em] text-center text-[1.65rem] leading-none italic">
            {title}
            <span className={cn("ml-0.5 inline-block h-[0.85em] w-[1.5px] translate-y-[1px] bg-[oklch(0.47_0.17_285)]", typed ? "opacity-0" : "animate-pulse")} />
          </p>
          <p className={cn("mt-2 text-center text-[11.5px] transition-opacity duration-500", typed ? "opacity-100" : "opacity-0", MUTED)}>React · TypeScript · ₹25K a month · 6 months</p>
        </div>
      </div>
      <div className="absolute -top-3 -right-1">
        <Stamp on={typed} delay={250} tilt={10}>Live</Stamp>
      </div>
    </div>
  )
}

const PODIUM = [
  { place: "1st", name: "Aarav Shah", fit: 92 },
  { place: "2nd", name: "Priya Nair", fit: 84 },
  { place: "3rd", name: "Liam Khan", fit: 79 },
]
function Ranked({ on }: { on: boolean }) {
  return (
    <ol className="divide-y divide-[oklch(0.2_0.05_280/0.12)] border-y border-[oklch(0.2_0.05_280/0.12)]">
      {PODIUM.map((c, i) => (
        <PodiumRow key={c.name} c={c} i={i} on={on} />
      ))}
    </ol>
  )
}
function PodiumRow({ c, i, on }: { c: (typeof PODIUM)[number]; i: number; on: boolean }) {
  const v = useCount(c.fit, on, 1000, 200 + i * 260)
  return (
    <li {...rise(on, i * 260)}>
      <div className="flex items-baseline gap-4 py-2.5">
        <span className={cn("font-display w-10 text-[1.5rem] leading-none italic", i === 0 ? "text-[oklch(0.47_0.17_285)]" : "text-[oklch(0.22_0.06_280/0.4)]")}>{c.place}</span>
        <span className={cn("flex-1 text-[14px]", i === 0 ? "font-semibold" : "font-medium text-[oklch(0.22_0.06_280/0.75)]")}>{c.name}</span>
        <span className="relative px-1.5">
          {i === 0 && <InkCircle on={on} delay={1300} className="-inset-x-2 -inset-y-2.5 h-[calc(100%+1.25rem)] w-[calc(100%+1rem)]" />}
          <span className="font-display inline-block w-[2ch] text-right text-[1.45rem] leading-none tabular-nums italic">{v}</span>
          <span className={cn("ml-0.5 text-[10px]", MUTED)}>% fit</span>
        </span>
      </div>
    </li>
  )
}

const TIERS: [string, number][] = [["Applied", 92], ["Shortlisted", 36], ["Selected", 14]]
function Hired({ on }: { on: boolean }) {
  return (
    <div className="relative flex items-center gap-4">
      {/* a funnel, drawn in ink, tier by tier */}
      <svg aria-hidden viewBox="0 0 160 120" className="w-[44%] shrink-0 overflow-visible" fill="none" stroke={INK} strokeWidth="1.5" strokeLinejoin="round">
        {[
          "M4 4h152l-22 34H26Z",
          "M30 44h100l-16 32H46Z",
          "M50 82h60l-12 32H62Z",
        ].map((d, i) => (
          <path
            key={d}
            d={d}
            pathLength={1}
            strokeDasharray="1"
            fill={on ? `oklch(0.47 0.17 285 / ${0.08 + i * 0.12})` : "transparent"}
            className="transition-[stroke-dashoffset,fill] duration-700 ease-out motion-reduce:transition-none"
            style={{ strokeDashoffset: on ? 0 : 1, transitionDelay: on ? `${200 + i * 320}ms` : "0ms" }}
          />
        ))}
      </svg>
      <ol className="flex-1 space-y-2.5">
        {TIERS.map(([label, n], i) => (
          <TierRow key={label} label={label} n={n} i={i} on={on} />
        ))}
      </ol>
      <div className="absolute -bottom-2 left-[13%]">
        <Stamp on={on} delay={1500} tilt={-7}>Hired</Stamp>
      </div>
    </div>
  )
}
function TierRow({ label, n, i, on }: { label: string; n: number; i: number; on: boolean }) {
  const v = useCount(n, on, 900, 200 + i * 320)
  return (
    <li {...rise(on, 200 + i * 320)}>
      <div className="flex items-baseline justify-between border-b border-dashed border-[oklch(0.2_0.05_280/0.18)] pb-1.5">
        <span className="text-[12.5px] font-medium text-[oklch(0.22_0.06_280/0.7)]">{label}</span>
        <span className="font-display inline-block w-[2ch] text-right text-[1.45rem] leading-none tabular-nums italic">{v}</span>
      </div>
    </li>
  )
}

/* ── universities ──────────────────────────────────────────────────────────────────────────────────────────────── */
const SEATS = 60
function Joined({ on }: { on: boolean }) {
  const n = useCount(1240, on, 1500, 250)
  const filled = Math.round((n / 1240) * SEATS)
  return (
    <div className="flex items-center gap-5">
      {/* a hall of seats, filling up */}
      <div className="grid w-[46%] shrink-0 grid-cols-12 gap-[5px]" aria-hidden>
        {Array.from({ length: SEATS }, (_, i) => (
          <span key={i} className={cn("aspect-square rounded-full transition-[background-color,scale] duration-300", i < filled ? "scale-100 bg-[oklch(0.47_0.17_285)]" : "scale-75 bg-[oklch(0.2_0.05_280/0.12)]")} style={{ opacity: i < filled ? 0.55 + ((i * 37) % 45) / 100 : 1 }} />
        ))}
      </div>
      <div>
        <p className="font-display inline-block min-w-[4.4ch] text-[2.3rem] leading-none tabular-nums italic">{n.toLocaleString("en-IN")}</p>
        <p className={cn("mt-1.5 text-[10.5px] tracking-[0.16em] uppercase", MUTED)}>students, one roll</p>
      </div>
    </div>
  )
}

const AXES: [string, number][] = [["Python", 0.82], ["SQL", 0.64], ["React", 0.51], ["DSA", 0.72], ["Design", 0.4]]
function Mapped({ on }: { on: boolean }) {
  const C = 70
  const R = 52
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i / AXES.length) * Math.PI * 2
    return [C + Math.cos(a) * r, C + Math.sin(a) * r] as const
  }
  const shape = AXES.map(([, v], i) => pt(i, R * v).join(",")).join(" ")
  return (
    <div className="flex justify-center">
      <svg viewBox="0 0 140 140" className="w-[min(62vw,15rem)] overflow-visible" aria-hidden>
        {/* the web */}
        {[0.33, 0.66, 1].map((k) => (
          <polygon key={k} points={AXES.map((_, i) => pt(i, R * k).join(",")).join(" ")} fill="none" stroke="oklch(0.2 0.05 280 / 0.14)" strokeWidth="0.7" />
        ))}
        {AXES.map((_, i) => {
          const [x, y] = pt(i, R)
          return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="oklch(0.2 0.05 280 / 0.14)" strokeWidth="0.7" />
        })}
        {/* the shape of a batch's skills, drawn in */}
        <polygon
          points={shape}
          fill={VIOLET}
          fillOpacity={on ? 0.16 : 0}
          stroke={VIOLET}
          strokeWidth="1.6"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1"
          className="transition-[stroke-dashoffset,fill-opacity] duration-[1300ms] ease-out motion-reduce:transition-none"
          style={{ strokeDashoffset: on ? 0 : 1 }}
        />
        {AXES.map(([label, v], i) => {
          const [x, y] = pt(i, R * v)
          const [lx, ly] = pt(i, R + 13)
          return (
            <g key={label}>
              <circle cx={x} cy={y} r="2.4" fill={VIOLET} className="transition-opacity duration-300" style={{ opacity: on ? 1 : 0, transitionDelay: `${900 + i * 90}ms` }} />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="font-display" fontSize="8.5" fontStyle="italic" fill="oklch(0.22 0.06 280 / 0.75)">
                {label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function Placed({ on }: { on: boolean }) {
  const v = useCount(92, on, 1500, 250)
  return (
    <div className="flex items-center gap-5">
      {/* a seal: the batch's name around the rim, turning slowly, the number in the middle */}
      <div className="relative size-[6.5rem] shrink-0">
        <svg viewBox="0 0 120 120" className={cn("absolute inset-0 size-full", on && "animate-[spin_26s_linear_infinite] motion-reduce:animate-none")} aria-hidden>
          <defs>
            <path id="seal-rim" d="M60 60m-47 0a47 47 0 1 1 94 0a47 47 0 1 1-94 0" />
          </defs>
          <circle cx="60" cy="60" r="57" fill="none" stroke={VIOLET} strokeWidth="1" />
          <circle cx="60" cy="60" r="38" fill="none" stroke={VIOLET} strokeWidth="1" />
          <text fontSize="9" fontWeight="600" fill={VIOLET}>
            <textPath href="#seal-rim" textLength={2 * Math.PI * 47 - 6} lengthAdjust="spacing">BATCH OF 2026 ✦ PLACED ✦ BATCH OF 2026 ✦ PLACED ✦</textPath>
          </text>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="font-display text-[2.2rem] leading-none tabular-nums italic">
            {v}
            <span className="text-[1rem]">%</span>
          </p>
        </div>
      </div>
      <div {...rise(on, 1200)}>
        <p className="font-display text-[1.25rem] leading-tight italic">placed, avg ₹4.2 LPA</p>
        <p className="mt-2 inline-flex items-center gap-1.5 border-b border-[oklch(0.2_0.05_280/0.35)] pb-0.5 text-[12.5px] font-semibold">
          Export the report
          <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 2v7M3 6.5 6 9.5 9 6.5" />
          </svg>
        </p>
      </div>
    </div>
  )
}

/* ── chapters ───────────────────────────────────────────────────────────────────────────────────────────────────── */
type Chapter = {
  n: string; title: string; line: string; art: ArtKind; hue: number
  beats: { label: string; Scene: (p: { on: boolean }) => React.ReactNode }[]
}
const CHAPTERS: Chapter[] = [
  {
    n: "01", title: "Students", line: "Know where you fit, and where you stand.", art: "waves", hue: 262,
    beats: [
      { label: "Your resume, read", Scene: ResumeRead },
      { label: "Matched to roles", Scene: Matched },
      { label: "Every step, tracked", Scene: Tracked },
    ],
  },
  {
    n: "02", title: "Companies", line: "Hire on skill, without the pile.", art: "silk", hue: 300,
    beats: [
      { label: "Posted in a minute", Scene: Posted },
      { label: "Ranked by fit", Scene: Ranked },
      { label: "Pipeline, at a glance", Scene: Hired },
    ],
  },
  {
    n: "03", title: "Universities", line: "See every student's outcome.", art: "contours", hue: 200,
    beats: [
      { label: "Every student, one roll", Scene: Joined },
      { label: "Skills, mapped", Scene: Mapped },
      { label: "Placements, sealed", Scene: Placed },
    ],
  },
]

function ChapterBlock({ c }: { c: Chapter }) {
  const [ref, on] = useInView<HTMLElement>(0.25)
  return (
    <article ref={ref} aria-label={c.title}>
      {/* 1 · the number and the title, on one line */}
      <div className="flex items-center gap-3">
        <span className="font-display grid size-9 shrink-0 -translate-y-0.5 place-items-center rounded-full border border-[oklch(0.2_0.05_280/0.3)] text-[1rem] italic">{c.n}</span>
      <h3 className="font-display relative inline-block text-[clamp(2.2rem,10vw,3.6rem)] leading-[0.95] tracking-[-0.01em] uppercase italic">
        {c.title}
        <svg aria-hidden viewBox="0 0 300 20" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-full text-[oklch(0.5_0.17_285)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 13C60 5 150 3 297 9" pathLength={1} strokeDasharray="1" className={cn("transition-[stroke-dashoffset] duration-[900ms]", EASE)} style={{ strokeDashoffset: on ? 0 : 1, transitionDelay: "150ms" }} />
        </svg>
      </h3>
      </div>

      {/* 2 · one line */}
      <p className="mt-4 text-[15px] leading-snug font-medium text-[oklch(0.22_0.06_280/0.75)]">{c.line}</p>

      {/* 4 · the story in three beats (the way in is "Pick yours", at the end) */}
      <div
        className="relative mt-5 overflow-hidden rounded-[24px] border border-[oklch(0.2_0.05_280/0.1)] px-4 pt-4 pb-5 sm:px-6"
        style={{ background: `linear-gradient(165deg, oklch(0.995 0.005 ${c.hue}), oklch(0.955 0.035 ${c.hue}))` }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-25">
          <PlateArt kind={c.art} hue={c.hue} id={`story-${c.n}`} />
        </div>
        <ol className="relative">
          {c.beats.map((b, i) => (
            <Beat key={b.label} n={i + 1} label={b.label}>
              {(beatOn) => <b.Scene on={beatOn} />}
            </Beat>
          ))}
        </ol>
      </div>
    </article>
  )
}

/* ── the choice ─────────────────────────────────────────────────────────────────────────────────────────────────── */
function FigPlate({ art, hue, id, size, children }: { art: ArtKind; hue: number; id: string; size: string; children: React.ReactNode }) {
  return (
    <figure className={cn("relative shrink-0", size)}>
      <span aria-hidden className="absolute inset-0 translate-x-2 translate-y-2 rounded-full border border-[oklch(0.2_0.05_280/0.22)]" />
      <div className="relative size-full overflow-hidden rounded-full border border-[oklch(0.2_0.05_280/0.85)] shadow-[0_30px_50px_-34px_oklch(0.2_0.06_280/0.4)]" style={{ background: `oklch(0.985 0.012 ${hue})` }}>
        <PlateArt kind={art} hue={hue} id={id} centered />
        <span aria-hidden className="pointer-events-none absolute inset-[7px] rounded-full border border-[oklch(0.2_0.05_280/0.14)]" />
      </div>
      {/* the sticker sits on the plate, not inside it, so it can overhang the rim a little */}
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </figure>
  )
}

/** Each choice wears its sticker (from the vintage career sheets, /public/stickers/career/). */
const PICKS: { label: string; href: string; art: ArtKind; hue: number; sticker: string; alt: string; tilt: number }[] = [
  { label: "Student", href: "/register?role=student", art: "waves", hue: 262, sticker: "coffee-books", alt: "Coffee on a stack of books", tilt: -8 },
  { label: "Company", href: "/register?role=company", art: "silk", hue: 300, sticker: "briefcase-badge", alt: "Briefcase with an ID badge", tilt: 6 },
  { label: "University", href: "/register?role=university", art: "spiro", hue: 200, sticker: "grad-cap", alt: "Graduation cap and diploma", tilt: -5 },
]

export function PickYours() {
  const [ref, on] = useInView<HTMLDivElement>(0.4)
  return (
    <div ref={ref} className="relative isolate w-full px-5 text-center sm:px-12">
      {/* the design behind it: a soft violet pool of light, and round rings (circles keep their shape on a tall screen) like the heading above */}
      <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[34rem] w-[min(46rem,160vw)] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,oklch(0.86_0.08_295/0.55),transparent)]" />
      <svg aria-hidden viewBox="0 0 400 400" className="pointer-events-none absolute top-1/2 left-1/2 -z-10 w-[150%] max-w-[56rem] -translate-x-1/2 -translate-y-1/2 text-[oklch(0.35_0.12_280)]" fill="none" stroke="currentColor">
        <circle cx="200" cy="200" r="196" strokeOpacity="0.06" />
        <circle cx="200" cy="200" r="150" strokeOpacity="0.09" />
        <circle cx="200" cy="200" r="104" strokeOpacity="0.13" />
        <circle cx="200" cy="200" r="58" strokeOpacity="0.17" />
      </svg>
      <h3 className="font-display text-[clamp(2.8rem,12vw,4.6rem)] leading-[0.92] tracking-[-0.01em] uppercase italic">Pick yours</h3>
      <ul className="mx-auto mt-10 flex max-w-[30rem] items-start justify-between gap-2">
        {PICKS.map((p, i) => (
          <li key={p.label} className={cn("flex-1", i === 1 ? "mt-0" : "mt-7")}>
            <Link
              href={p.href}
              className={cn("group flex flex-col items-center gap-4 outline-none transition-[opacity,translate,scale] duration-700 active:scale-95", EASE, on ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 scale-90 opacity-0")}
              style={{ transitionDelay: on ? `${i * 140}ms` : "0ms" }}
            >
              <span className="transition-transform duration-300 group-hover:-translate-y-1 group-focus-visible:-translate-y-1">
                <FigPlate art={p.art} hue={p.hue} id={`pick-${i}`} size="size-[min(26vw,8.5rem)]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- small, already-optimised sticker art */}
                  <img
                    src={`/stickers/career/${p.sticker}.webp`}
                    alt={p.alt}
                    draggable={false}
                    decoding="async"
                    className="w-[96%] drop-shadow-[0_8px_10px_oklch(0.2_0.08_285/0.35)] transition-[rotate,scale,translate] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] rotate-(--tilt) group-hover:-translate-y-1.5 group-hover:scale-[1.07] group-hover:rotate-0 group-focus-visible:rotate-0 group-active:scale-95"
                    style={{ "--tilt": `${p.tilt}deg` } as React.CSSProperties}
                  />
                </FigPlate>
              </span>
              <span className="font-display flex items-center gap-1.5 text-[1.1rem] tracking-[0.06em] uppercase italic">
                {p.label}
                <ArrowRightIcon className="size-3.5 -rotate-45 opacity-60 transition-transform duration-300 group-hover:rotate-0" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/register" className="mt-10 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[oklch(0.22_0.06_280/0.6)] underline decoration-[oklch(0.22_0.06_280/0.25)] underline-offset-4">
        Not sure yet? Create a free account
      </Link>
    </div>
  )
}

/* ── the section (below desktop) ────────────────────────────────────────────────────────────────────────────────── */
export function RolesChapters() {
  return (
    <div className="relative overflow-clip px-5 pt-20 pb-16 sm:px-12 lg:hidden">
      {/* round rings behind the heading (circles keep their shape on a tall screen) */}
      <svg aria-hidden viewBox="0 0 400 400" className="pointer-events-none absolute top-0 left-1/2 w-[150%] max-w-[56rem] -translate-x-1/2 text-[oklch(0.35_0.12_280)]" fill="none" stroke="currentColor">
        <circle cx="200" cy="170" r="190" strokeOpacity="0.07" />
        <circle cx="200" cy="170" r="138" strokeOpacity="0.1" />
        <circle cx="200" cy="170" r="86" strokeOpacity="0.14" />
      </svg>

      <header className="relative text-center">
        <p className={cn("text-[12px] font-semibold tracking-[0.22em] uppercase", MUTED)}>Who it&rsquo;s for</p>
        <h2 data-mask className="font-display mt-4 text-[clamp(2.7rem,11vw,4.6rem)] leading-[0.92] tracking-[-0.01em] uppercase italic">
          <span className="mask-line pr-[0.12em]"><span>One portal,</span></span>
          <span className="mask-line pr-[0.12em]"><span>three sides</span></span>
        </h2>
      </header>

      {/* one column, one rhythm: every chapter has the same build */}
      <div className="relative mx-auto mt-14 flex max-w-[34rem] flex-col gap-16">
        {CHAPTERS.map((c) => (
          <ChapterBlock key={c.n} c={c} />
        ))}
      </div>

    </div>
  )
}
