"use client"

import * as React from "react"
import gsap from "gsap"

import { getLenis } from "@/lib/lenis-instance"

/**
 * "Watch agents build it": a small button on the side of the page. Pressed, the page scrolls itself from the very top
 * to the footer, with every scroll animation playing as usual, while a swarm of named agent cursors builds it live,
 * straight in its finished look. Anything not built yet is blank design-canvas paper. Once a section has fully
 * arrived on screen (and, if it slides out from under another, once it is completely uncovered), an agent renders
 * its background in, top to bottom, and the others build its parts: text typed in, buttons popped in, cards and
 * images drawn in, all following the page as it moves. The scroll waits while a section renders and slows while
 * there is work on screen, so nothing goes by unbuilt. Then it's "shipped", and you're put back where you were.
 *
 * The page is never changed: the paper is one 2D canvas laid over it (only where an unbuilt section can actually be
 * seen), and the parts are hidden and revealed with their own clip-paths, restored when they're built.
 * Skip with the button or Esc. Hidden with reduced motion.
 */

type Agent = { name: string; color: string; rgb: string }
const AGENTS: Agent[] = [
  { name: "Scout", color: "oklch(0.6 0.15 160)", rgb: "34,150,104" },
  { name: "Designer", color: "oklch(0.6 0.21 330)", rgb: "196,58,150" },
  { name: "Matcher", color: "oklch(0.56 0.2 290)", rgb: "116,80,214" },
  { name: "Recruiter", color: "oklch(0.68 0.15 65)", rgb: "205,130,30" },
  { name: "Campus", color: "oklch(0.58 0.15 240)", rgb: "40,120,200" },
  { name: "Bridge", color: "oklch(0.58 0.2 25)", rgb: "205,60,60" },
]
const PAPER = "#efedf5"
const DOT = "#cdc8de"

type Kind = "type" | "pop" | "draw"
type Spec = {
  name: string
  /** what is covered by paper until it's rendered (its live box) */
  bg: string
  /** where its parts live (every heading, text, link, image, card in it is built) */
  root: string
  /** parts with a particular way of being built, before the automatic ones */
  fg: [Kind, string, string][]
  /** it sits underneath this and slides out from under it: it's only built once it's clear of it */
  under?: string
  /** it lies below the sections after it, so it doesn't hide them */
  beneath?: boolean
}
const SECTIONS: Spec[] = [
  {
    name: "the opening scene",
    bg: "section[aria-label='Intro'] [data-stage]",
    root: "section[aria-label='Intro']",
    fg: [
      ["draw", "[data-wall] [data-pane]", "window"],
      ["type", "[data-them]", "copy"],
      ["pop", "[data-skip]", "sticker"],
    ],
  },
  {
    name: "the hero",
    bg: "[data-hero]",
    root: "[data-hero]",
    fg: [
      ["draw", "[data-build='letters']", "background type"],
      ["type", "[data-intro='line']", "headline"],
      ["type", "header nav a, header nav span", "nav"],
      ["pop", "header a[aria-label='CareerBridge home']", "logo"],
    ],
  },
  { name: "the logo wall", bg: "section[aria-label='Teams students apply to']", root: "section[aria-label='Teams students apply to']", fg: [] },
  { name: "the statement", bg: "[data-read-scope] > div", root: "[data-read-scope]", fg: [["type", "[data-read]", "statement"]] },
  {
    name: "open roles",
    bg: "#internships [data-pane]",
    root: "#internships",
    fg: [
      ["type", "#open-roles", "title"],
      ["draw", "#internships [data-card]", "role card"],
    ],
  },
  {
    name: "who it's for",
    bg: "#roles .h-stick",
    root: "#roles",
    under: "#internships [data-pane]",
    beneath: true,
    fg: [
      ["type", "[data-build='roles-title'] .mask-line", "headline"],
      ["type", "[data-build='roles-pitch']", "copy"],
      ["type", "[data-build='roles-label']", "progress"],
      ["draw", "[data-build='roles-card']", "card"],
    ],
  },
  { name: "the numbers", bg: "[data-curl]", root: "[data-curl]", fg: [["draw", ".stat-cell", "stat"]] },
  {
    name: "the story",
    bg: "section[aria-label='Why CareerBridge'] [data-stage]",
    root: "section[aria-label='Why CareerBridge']",
    fg: [
      ["type", "section[aria-label='Why CareerBridge'] [data-line]", "headline"],
      ["draw", "section[aria-label='Why CareerBridge'] [data-card]", "card"],
    ],
  },
  // the footer sits behind the whole page; its spacer is exactly the part of it that has been uncovered
  { name: "the footer", bg: "[data-footer-spacer]", root: "footer[aria-label='Site footer']", fg: [], beneath: true },
]

/** the automatic parts: every heading, text, link, image, list item and card, outermost first */
const AUTO = "h1,h2,h3,h4,p,a,button,img,li,article,label"
const autoKind = (el: Element): [Kind, string] => {
  const t = el.tagName
  if (/^H\d$/.test(t)) return ["type", "heading"]
  if (t === "P" || t === "LABEL") return ["type", "text"]
  if (t === "A") return ["pop", "link"]
  if (t === "BUTTON") return ["pop", "button"]
  if (t === "IMG") return ["draw", "image"]
  if (t === "LI") return ["draw", "item"]
  return ["draw", "card"]
}

/** one agent: the pointer and its name tag */
function Cursor({ a, i }: { a: Agent; i: number }) {
  return (
    <div data-cursor={i} className="pointer-events-none absolute top-0 left-0 z-30 opacity-0 will-change-transform">
      <svg viewBox="0 0 24 24" className="size-[22px] drop-shadow-[0_2px_4px_rgb(0_0_0/0.3)]" aria-hidden>
        <path d="M3 2l17 9.5-7.4 1.6L9.4 21z" fill={a.color} stroke="white" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <span className="absolute top-[18px] left-[14px] rounded-full px-2 py-[2px] text-[11px] font-semibold whitespace-nowrap text-white shadow-[0_4px_10px_rgb(0_0_0/0.2)]" style={{ background: a.color }}>
        {a.name}
        <span data-doing className="ml-1 font-medium opacity-85" />
      </span>
    </div>
  )
}

type Part = { el: HTMLElement; kind: Kind; what: string; clip: string; state: "wait" | "building" | "done" }
type Section = {
  name: string
  el: HTMLElement | null
  under: HTMLElement | null
  beneath: boolean
  state: "wait" | "filling" | "done"
  wp: number
  agent: number
  parts: Part[]
}
type Job = { type: "fill" | "build"; s: Section; part: Part | null; t: number; dur: number; fx: number; fy: number }
type Worker = { el: HTMLElement; tag: HTMLElement; x: number; y: number; job: Job | null }
type Band = [number, number]

export function AgentSwarm() {
  const [open, setOpen] = React.useState(false)
  const stage = React.useRef<HTMLDivElement>(null)
  const closeRef = React.useRef<() => void>(() => setOpen(false))

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  React.useLayoutEffect(() => {
    const root = stage.current
    if (!open || !root) return
    const q = gsap.utils.selector(root)
    const canvas = q("canvas")[0] as HTMLCanvasElement
    const g = canvas.getContext("2d")!
    const status = q("[data-status]")[0] as HTMLElement
    const counter = q("[data-count]")[0] as HTMLElement
    const timer = q("[data-timer]")[0] as HTMLElement
    const ship = q("[data-shipped]")[0] as HTMLElement
    const lenis = getLenis()
    const startY = window.scrollY
    const t0 = performance.now()
    let built = 0
    let raf = 0
    let finished = false

    lenis?.stop()
    const block = (e: Event) => e.preventDefault()
    window.addEventListener("wheel", block, { passive: false })
    window.addEventListener("touchmove", block, { passive: false })

    // ── the page, as a build plan; every part starts hidden ──
    const taken = new Set<HTMLElement>()
    const covered = (el: HTMLElement) => {
      for (const t of taken) if (t.contains(el) || el.contains(t)) return true
      return false
    }
    const part = (el: HTMLElement, kind: Kind, what: string): Part => {
      taken.add(el)
      const p: Part = { el, kind, what, clip: el.style.clipPath, state: "wait" }
      el.style.clipPath = "inset(50% 50% 50% 50%)"
      return p
    }
    const sections: Section[] = SECTIONS.map((s) => {
      const parts: Part[] = []
      for (const [kind, sel, what] of s.fg) for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) if (!covered(el)) parts.push(part(el, kind, what))
      const scope = document.querySelector<HTMLElement>(s.root)
      if (scope) {
        let n = 0
        for (const el of Array.from(scope.querySelectorAll<HTMLElement>(AUTO))) {
          if (n >= 28 || covered(el)) continue
          const [kind, what] = autoKind(el)
          parts.push(part(el, kind, what))
          n++
        }
      }
      return {
        name: s.name,
        el: document.querySelector<HTMLElement>(s.bg),
        under: s.under ? document.querySelector<HTMLElement>(s.under) : null,
        beneath: !!s.beneath,
        state: "wait",
        wp: 0,
        agent: 0,
        parts,
      }
    })
    const allParts = sections.flatMap((s) => s.parts)
    const restoreAll = () => allParts.forEach((p) => (p.el.style.clipPath = p.clip))
    // what lies over each section: the sections after it (unless it lies over them), and what it slides out from under
    const coverers = sections.map((s, i) => {
      const out: HTMLElement[] = []
      if (i === sections.length - 1) return out // (the footer: its spacer is exactly what's uncovered)
      sections.forEach((o, j) => {
        if (j > i && o.el && !o.beneath) out.push(o.el)
      })
      if (s.under) out.push(s.under)
      return out
    })

    // the scroll runs from the very top to the very end
    const endY = () => document.documentElement.scrollHeight - window.innerHeight
    let y = 0
    const jump = (to: number) => {
      if (lenis) lenis.scrollTo(to, { immediate: true, force: true })
      else window.scrollTo(0, to)
    }
    jump(0)

    // ── the agents ──
    let W = window.innerWidth
    let H = window.innerHeight
    const workers: Worker[] = AGENTS.map((_, i) => {
      const el = q(`[data-cursor='${i}']`)[0] as HTMLElement
      const edge = [[-0.05, 0.3], [1.05, 0.2], [0.3, -0.05], [-0.05, 0.85], [1.05, 0.8], [0.7, 1.05]][i]
      return { el, tag: el.querySelector<HTMLElement>("[data-doing]")!, x: edge[0] * W, y: edge[1] * H, job: null }
    })
    gsap.set(workers.map((w) => w.el), { opacity: 1 })

    // ── the canvas ──
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const size = () => {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
    }
    size()
    const tile = document.createElement("canvas")
    tile.width = tile.height = Math.round(22 * dpr)
    const tg = tile.getContext("2d")!
    tg.fillStyle = PAPER
    tg.fillRect(0, 0, tile.width, tile.height)
    tg.fillStyle = DOT
    tg.beginPath()
    tg.arc(tile.width / 2, tile.height / 2, 1.05 * dpr, 0, Math.PI * 2)
    tg.fill()
    const paper = g.createPattern(tile, "repeat")!
    paper.setTransform(new DOMMatrix().scale(1 / dpr))

    const inView = (r: DOMRect, m = 0) => r.width > 6 && r.height > 6 && r.bottom > m && r.top < H - m && r.right > 0 && r.left < W
    const shown = (el: HTMLElement) => {
      const cs = getComputedStyle(el)
      return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05
    }
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
    const clipFor = (kind: Kind, p: number) => {
      const k = ((1 - p) * 100).toFixed(1)
      if (kind === "type") return `inset(-8% ${k}% -8% -8%)`
      if (kind === "draw") return `inset(-8% ${k}% ${k}% -8%)`
      const c = ((1 - p) * 50).toFixed(1)
      return `inset(${c}% ${c}% ${c}% ${c}%)`
    }
    /** where the pointer sits while doing a job, at progress p */
    const pen = (job: Job, r: DOMRect, p: number) => {
      const x0 = Math.max(0, r.left)
      const y0 = Math.max(0, r.top)
      const w = Math.min(W, r.right) - x0
      const h = Math.min(H, r.bottom) - y0
      if (job.type === "fill") return [x0 + w * (0.5 + 0.42 * Math.sin(p * Math.PI * 3)), y0 + h * p]
      const kind = job.part!.kind
      if (kind === "pop") return [x0 + w / 2, y0 + h / 2 - Math.sin(p * Math.PI) * 10]
      if (kind === "type") return [x0 + w * p, y0 + Math.min(h, 60) * 0.55]
      return [x0 + w * p, y0 + h * p]
    }
    const height = (bands: Band[]) => bands.reduce((n, [a, b]) => n + b - a, 0)

    let last = t0
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      timer.textContent = `${((t - t0) / 1000).toFixed(1)}s`
      if (finished) return

      const rects = new Map<HTMLElement, DOMRect>()
      const r = (el: HTMLElement) => {
        let b = rects.get(el)
        if (!b) rects.set(el, (b = el.getBoundingClientRect()))
        return b
      }
      // what of each section can actually be seen: its box on screen minus whatever lies over it (as bands of y)
      const visible: Band[][] = sections.map((s, i) => {
        if (!s.el) return []
        const sr = r(s.el)
        if (!inView(sr)) return []
        let bands: Band[] = [[Math.max(0, sr.top), Math.min(H, sr.bottom)]]
        for (const c of coverers[i]) {
          const cr = r(c)
          if (!inView(cr) || cr.width < W * 0.6) continue
          const a = Math.max(0, cr.top)
          const b = Math.min(H, cr.bottom)
          bands = bands.flatMap(([y0, y1]): Band[] => {
            if (b <= y0 || a >= y1) return [[y0, y1]]
            const keep: Band[] = []
            if (a > y0) keep.push([y0, a])
            if (b < y1) keep.push([b, y1])
            return keep
          })
        }
        return bands.filter(([a, b]) => b - a > 1)
      })
      /** fully arrived: as much of it can be seen as ever will (all of it, or the whole screen) */
      const arrived = (i: number) => {
        const s = sections[i]
        if (!s.el) return false
        return height(visible[i]) >= Math.min(H, r(s.el).height) * 0.96 - 2
      }
      const ready = (i: number, p: Part) => {
        const pr = r(p.el)
        if (!inView(pr, 12) || !shown(p.el)) return false
        const cy = Math.min(H - 1, Math.max(0, (pr.top + pr.bottom) / 2))
        return visible[i].some(([a, b]) => cy >= a && cy <= b)
      }

      // 1. how much work is on screen, and whether a section is rendering (the page waits for that)
      let pending = 0
      let hold = false
      sections.forEach((s, i) => {
        if (!visible[i].length) return
        if (s.state === "filling") hold = true
        if (s.state !== "done") pending += 3
        else for (const p of s.parts) if (p.state !== "done" && ready(i, p)) pending++
      })

      // 2. the scroll: steady, waiting while a section renders, slowing while there's work in view
      const end = endY()
      const speed = hold ? 0 : Math.max(120, 1100 / (1 + pending * 0.55))
      if (y < end) {
        y = Math.min(end, y + speed * dt)
        jump(y)
      }

      // 3. work out to free agents: a section once it has fully arrived, then its parts as they come into view
      const take = (job: Omit<Job, "t" | "fx" | "fy">) => {
        const w = workers.find((x) => !x.job)
        if (!w) return -1
        w.job = { ...job, t: 0, fx: w.x, fy: w.y }
        return workers.indexOf(w)
      }
      sections.forEach((s, i) => {
        if (s.state === "wait" && arrived(i)) {
          const a = take({ type: "fill", s, part: null, dur: 0.75 })
          if (a >= 0) {
            s.state = "filling"
            s.agent = a
            status.textContent = `rendering ${s.name}`
          }
          return
        }
        if (s.state !== "done") return
        for (const p of s.parts) {
          if (p.state !== "wait" || !ready(i, p)) continue
          const pr = r(p.el)
          const dur = p.kind === "type" ? Math.min(0.9, 0.34 + Math.min(W, pr.width) / 1700) : p.kind === "pop" ? 0.45 : 0.62
          if (take({ type: "build", s, part: p, dur }) < 0) break
          p.state = "building"
          status.textContent = `building ${s.name}`
        }
      })

      // 4. the agents at work
      const FLY = 0.3
      workers.forEach((w, i) => {
        const job = w.job
        if (!job) {
          const tx = i === 5 ? W * (0.5 + Math.sin(t / 900) * 0.32) : W * (0.12 + i * 0.17)
          const ty = i === 5 ? H * (0.45 + Math.cos(t / 1300) * 0.22) : H * 0.82 + Math.sin(t / 700 + i) * 12
          w.x += (tx - w.x) * Math.min(1, dt * 3)
          w.y += (ty - w.y) * Math.min(1, dt * 3)
          w.tag.textContent = i === 5 ? "· reviewing" : ""
        } else {
          job.t += dt
          const rr = r(job.part ? job.part.el : job.s.el!)
          if (job.t < FLY) {
            const k = ease(job.t / FLY)
            const [px, py] = pen(job, rr, 0)
            w.x = job.fx + (px - job.fx) * k
            w.y = job.fy + (py - job.fy) * k
          } else {
            const p = Math.min(1, (job.t - FLY) / job.dur)
            const e = ease(p)
            const [px, py] = pen(job, rr, e)
            w.x = px
            w.y = py
            w.tag.textContent = `· ${job.part ? job.part.what : `render ${job.s.name.replace(/^the /, "")}`}`
            if (job.type === "fill") job.s.wp = e
            else job.part!.el.style.clipPath = clipFor(job.part!.kind, e)
            if (p >= 1) {
              if (job.type === "fill") job.s.state = "done"
              else {
                job.part!.state = "done"
                job.part!.el.style.clipPath = job.part!.clip
                counter.textContent = String(++built)
              }
              w.job = null
              w.tag.textContent = ""
            }
          }
        }
        w.el.style.transform = `translate3d(${w.x.toFixed(1)}px,${w.y.toFixed(1)}px,0)`
      })

      // 5. paper wherever an unbuilt section can be seen (rendered away from the top while it renders)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, W, H)
      sections.forEach((s, i) => {
        if (!s.el || s.state === "done" || !visible[i].length) return
        const sr = r(s.el)
        const x0 = Math.max(0, sr.left)
        let x1 = Math.min(W, sr.right)
        if (x0 <= 1 && x1 >= W - 24) x1 = W // (the page is a scrollbar's width narrower than the screen)
        const cut = s.state === "filling" ? Math.max(0, sr.top) + (Math.min(H, sr.bottom) - Math.max(0, sr.top)) * s.wp : -1
        g.fillStyle = paper
        for (const [a, b] of visible[i]) {
          const top = Math.max(a, cut)
          if (b > top) g.fillRect(x0, top, x1 - x0, b - top)
        }
        if (s.state === "filling" && visible[i].some(([a, b]) => cut >= a && cut <= b)) {
          const rgb = AGENTS[s.agent].rgb
          const glow = g.createLinearGradient(0, cut - 44, 0, cut)
          glow.addColorStop(0, `rgba(${rgb},0)`)
          glow.addColorStop(1, `rgba(${rgb},0.2)`)
          g.fillStyle = glow
          g.fillRect(x0, cut - 44, x1 - x0, 44)
          g.fillStyle = `rgba(${rgb},0.9)`
          g.fillRect(x0, cut - 1, x1 - x0, 2)
        }
      })

      // 6. all the way down, and nothing left to do on screen
      if (y >= end - 1 && pending === 0 && workers.every((w) => !w.job)) finish()
    }
    raf = requestAnimationFrame(frame)

    const finish = () => {
      finished = true
      status.textContent = "shipped"
      g.clearRect(0, 0, W, H)
      ship.querySelector<HTMLElement>("[data-ship-time]")!.textContent = `${((performance.now() - t0) / 1000).toFixed(0)} seconds`
      ship.querySelector<HTMLElement>("[data-ship-count]")!.textContent = String(built)
      gsap.to(workers.map((w) => w.el), { opacity: 0, duration: 0.3 })
      gsap.fromTo(ship, { autoAlpha: 0, y: 16, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: "power3.out" })
      gsap.delayedCall(2.6, () => closeRef.current())
    }

    // ── closing: put everything back, and you where you were ──
    let closing = false
    closeRef.current = () => {
      if (closing) return
      closing = true
      finished = true
      gsap.to(root, {
        autoAlpha: 0,
        duration: 0.4,
        ease: "power1.in",
        onComplete: () => {
          restoreAll()
          jump(startY)
          setOpen(false)
        },
      })
    }

    gsap.fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 })
    window.addEventListener("resize", size)
    return () => {
      cancelAnimationFrame(raf)
      restoreAll()
      window.removeEventListener("resize", size)
      window.removeEventListener("wheel", block)
      window.removeEventListener("touchmove", block)
      lenis?.start()
      closeRef.current = () => setOpen(false)
    }
  }, [open])

  return (
    <>
      {/* the button, on the side */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Watch agents build this page"
        style={{ visibility: open ? "hidden" : undefined }}
        className="group/swarm fixed right-3 bottom-4 z-[55] flex items-center gap-2 rounded-full border border-white/15 bg-[oklch(0.17_0.05_285/0.88)] py-1.5 pr-3.5 pl-1.5 text-[12px] font-semibold text-white shadow-[0_10px_30px_-10px_rgb(10_6_30/0.7)] transition-transform duration-300 ease-(--ease-out) hover:-translate-y-0.5 active:scale-95 motion-reduce:hidden sm:right-5 sm:bottom-5"
      >
        <span aria-hidden className="relative flex h-6 w-9 items-center">
          {AGENTS.slice(0, 3).map((a, i) => (
            <svg key={a.name} viewBox="0 0 24 24" className="absolute size-[15px] transition-transform duration-300 group-hover/swarm:-translate-y-0.5" style={{ left: i * 9, top: i % 2 ? 6 : 1, transitionDelay: `${i * 50}ms` }}>
              <path d="M3 2l17 9.5-7.4 1.6L9.4 21z" fill={a.color} stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          ))}
        </span>
        <span className="hidden sm:inline">Watch agents build it</span>
        <span className="sm:hidden">Agents</span>
      </button>

      {open && (
        <div ref={stage} role="dialog" aria-label="Agents building the page" className="invisible fixed inset-0 z-[90]">
          <canvas className="pointer-events-none absolute inset-0 size-full" />
          {AGENTS.map((a, i) => (
            <Cursor key={a.name} a={a} i={i} />
          ))}

          {/* the status: a light pill, like a design tool's toolbar */}
          <div className="absolute bottom-4 left-1/2 z-40 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-[oklch(0.2_0.05_280/0.12)] bg-white/90 py-1.5 pr-4 pl-2 text-[12px] text-[oklch(0.25_0.05_280)] shadow-[0_12px_30px_-12px_oklch(0.3_0.1_285/0.35)] sm:bottom-5">
            <span aria-hidden className="flex -space-x-1.5">
              {AGENTS.map((a) => (
                <span key={a.name} className="size-4 rounded-full ring-2 ring-white" style={{ background: a.color }} />
              ))}
            </span>
            <span data-status className="font-display min-w-0 truncate text-[14px] italic">starting</span>
            <span className="hidden text-[oklch(0.25_0.05_280/0.5)] sm:inline">
              · <span data-count className="text-[oklch(0.25_0.05_280)] tabular-nums">0</span> built
            </span>
            <span data-timer className="font-mono text-[11px] tabular-nums text-[oklch(0.25_0.05_280/0.55)]">0.0s</span>
          </div>

          {/* shipped: in the site's own look */}
          <div data-shipped className="invisible absolute top-1/2 left-1/2 z-40 w-[min(30rem,calc(100vw-2.5rem))] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-[oklch(0.2_0.05_280/0.1)] bg-[oklch(0.985_0.006_290/0.96)] px-8 py-7 text-center text-[oklch(0.22_0.05_280)] shadow-[0_40px_80px_-30px_oklch(0.2_0.1_285/0.55)]">
            <p className="flex items-center justify-center gap-3 text-[11px] font-semibold tracking-[0.24em] text-[oklch(0.5_0.17_285)] uppercase">
              <span aria-hidden className="h-px w-6 bg-[oklch(0.5_0.17_285/0.5)]" />
              Shipped
              <span aria-hidden className="h-px w-6 bg-[oklch(0.5_0.17_285/0.5)]" />
            </p>
            <p className="font-display mt-3 text-[clamp(1.7rem,4vw,2.6rem)] leading-[1.05] tracking-[-0.01em] uppercase italic">
              Built live by <span className="text-[oklch(0.5_0.19_290)]">six agents</span>
            </p>
            <p className="mt-3 text-[14px] text-[oklch(0.22_0.06_280/0.65)]">
              <span data-ship-count className="font-semibold text-[oklch(0.22_0.05_280)]">0</span> components · {SECTIONS.length} sections · <span data-ship-time>0 seconds</span>
            </p>
            <div aria-hidden className="mt-4 flex justify-center -space-x-1.5">
              {AGENTS.map((a) => (
                <span key={a.name} title={a.name} className="size-5 rounded-full ring-2 ring-white" style={{ background: a.color }} />
              ))}
            </div>
          </div>

          <button type="button" onClick={() => closeRef.current()} className="absolute top-4 right-4 z-50 rounded-full border border-[oklch(0.2_0.05_280/0.12)] bg-white/90 px-3.5 py-1.5 text-[12px] font-semibold text-[oklch(0.25_0.05_280)] shadow-[0_8px_20px_-10px_oklch(0.3_0.1_285/0.4)] transition-colors hover:bg-white sm:top-5 sm:right-6">
            Skip · Esc
          </button>
        </div>
      )}
    </>
  )
}
