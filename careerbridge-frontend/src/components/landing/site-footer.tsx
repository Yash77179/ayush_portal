"use client"

import * as React from "react"
import Link from "next/link"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

import { Roll } from "@/components/landing/roll-link"
import { getLenis } from "@/lib/lenis-instance"

/**
 * The footer lives fixed behind the page. When you reach the end, the page lifts away like a curtain and
 * uncovers it, its content settling into place with a small depth shift. Scrolling gets a little heavier
 * while it is only partly uncovered, and once about two thirds of it is showing it carries on by itself
 * and reveals the rest. (It needs the <div data-footer-spacer> that page.tsx puts after the page.)
 *
 * The thin zig-zag lines are strings: each one is a chain of points on springs. The pointer pushes the
 * nearby points sideways, away from it, with a soft falloff, so a line bulges out like a plucked string
 * and settles with a small wobble. The canvas only runs while the footer is on screen and something
 * is still moving.
 */

const GAP = 36 // distance between lines
const STEP = 14 // distance between points along a line
const AMP = 26 // how far the zig-zag swings
const PERIOD = 230 // vertical length of one zig and zag
const PUSH = 78 // the furthest a string is pushed
const SIGMA_X = 120
const SIGMA_Y = 130
const STIFFNESS = 0.085
const DAMPING = 0.82

interface Pt {
  y: number
  o: number // current sideways offset
  v: number // its velocity
}
interface Line {
  x0: number
  pts: Pt[]
}

const tri = (t: number) => Math.abs((((t % 1) + 1) % 1) * 2 - 1) * 2 - 1 // triangle wave, −1…1

const LINKS = [
  { label: "Internships", href: "/internships" },
  { label: "Who it’s for", href: "/#roles" },
  { label: "Sign in", href: "/login" },
  { label: "Sign up", href: "/register" },
]
const JOIN = [
  { label: "Student", href: "/register?role=student" },
  { label: "Company", href: "/register?role=company" },
  { label: "University", href: "/register?role=university" },
]

const LABEL = "text-[clamp(0.85rem,1vw,1rem)] text-[oklch(0.94_0.02_85/0.5)]"
const LINK = "font-display block text-[clamp(1.35rem,2.1vw,2.2rem)] leading-[1.05] tracking-[0.01em] uppercase text-[oklch(0.94_0.02_85)] outline-none transition-colors hover:text-white focus-visible:text-white"

export function SiteFooter() {
  const root = React.useRef<HTMLElement>(null)
  const canvas = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    const footer = root.current
    const cv = canvas.current
    if (!footer || !cv) return
    const ctx2d = cv.getContext("2d")
    if (!ctx2d) return
    gsap.registerPlugin(ScrollTrigger)
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    // ── the strings ──
    let lines: Line[] = []
    let w = 0
    let h = 0
    let dpr = 1
    let raf = 0
    let pointer: { x: number; y: number } | null = null

    const build = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      w = footer.clientWidth
      h = footer.clientHeight
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
      lines = []
      const count = Math.ceil(w / GAP) + 4
      for (let i = 0; i < count; i++) {
        const pts: Pt[] = []
        for (let y = -STEP * 2; y <= h + STEP * 2; y += STEP) pts.push({ y, o: 0, v: 0 })
        lines.push({ x0: (i - 2) * GAP, pts })
      }
    }
    const baseX = (l: Line, y: number) => l.x0 + AMP * tri(y / PERIOD) + (y - h / 2) * 0.05 // a slight slant, so the sheet reads as slightly turned

    const frame = () => {
      raf = 0
      ctx2d.clearRect(0, 0, w, h)
      ctx2d.lineWidth = 1
      ctx2d.strokeStyle = "rgba(240, 232, 215, 0.14)"
      let energy = 0
      for (const l of lines) {
        ctx2d.beginPath()
        for (let k = 0; k < l.pts.length; k++) {
          const p = l.pts[k]
          const bx = baseX(l, p.y)
          let target = 0
          if (pointer) {
            const hx = bx - pointer.x
            const vy = p.y - pointer.y
            const wgt = Math.exp(-(vy * vy) / (2 * SIGMA_Y * SIGMA_Y) - (hx * hx) / (2 * SIGMA_X * SIGMA_X))
            target = (hx / (Math.abs(hx) + 28)) * PUSH * wgt // away from the pointer; the nearest strings move most
          }
          p.v = (p.v + (target - p.o) * STIFFNESS) * DAMPING
          p.o += p.v
          energy += Math.abs(p.v) + Math.abs(target - p.o)
          const x = bx + p.o
          if (k === 0) ctx2d.moveTo(x, p.y)
          else ctx2d.lineTo(x, p.y)
        }
        ctx2d.stroke()
      }
      if (pointer || energy > 0.6) raf = requestAnimationFrame(frame)
    }
    const wake = () => {
      if (!raf && !reduce) raf = requestAnimationFrame(frame)
    }

    build()
    if (reduce) frame()
    const ro = new ResizeObserver(() => {
      build()
      wake()
      if (reduce) frame()
    })
    ro.observe(footer)
    const move = (e: PointerEvent) => {
      const r = footer.getBoundingClientRect()
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top }
      wake()
    }
    const leave = () => {
      pointer = null
      wake()
    }
    footer.addEventListener("pointermove", move)
    footer.addEventListener("pointerleave", leave)

    // ── the reveal ──
    const spacer = document.querySelector<HTMLElement>("[data-footer-spacer]")
    const content = footer.querySelector<HTMLElement>("[data-fcontent]")
    const mark = footer.querySelector<HTMLElement>("[data-fmark]")
    const triggers: ScrollTrigger[] = []
    let tween: gsap.core.Tween | undefined
    if (spacer && !reduce) {
      const lenis = getLenis()
      const baseWheel = lenis?.options.wheelMultiplier ?? 1
      let snapped = false
      const st = ScrollTrigger.create({
        trigger: spacer,
        start: "top bottom",
        end: "bottom bottom",
        // visible from the first pixel uncovered until the very end (the range reads as inactive exactly at its end, so it can't be keyed on isActive)
        onLeaveBack: () => {
          footer.style.visibility = "hidden"
          if (lenis) lenis.options.wheelMultiplier = baseWheel
        },
        onUpdate: (self) => {
          const p = self.progress
          footer.style.visibility = p > 0 ? "visible" : "hidden"
          if (p > 0) wake()
          if (lenis) {
            // a little resistance while it is only partly uncovered
            lenis.options.wheelMultiplier = p > 0.01 && p < 0.66 ? baseWheel * 0.5 : baseWheel
            // …and once two thirds is showing, it carries on and uncovers the rest
            if (self.direction === 1 && p >= 0.66 && p < 0.99 && !snapped) {
              snapped = true
              lenis.scrollTo(ScrollTrigger.maxScroll(window), { duration: 1.4, easing: (t: number) => 1 - Math.pow(1 - t, 4) })
            }
            if (p < 0.5) snapped = false
          }
        },
      })
      triggers.push(st)
      tween = gsap.fromTo(
        content,
        { yPercent: -16 },
        { yPercent: 0, ease: "none", scrollTrigger: { trigger: spacer, start: "top bottom", end: "bottom bottom", scrub: true } }
      )
      gsap.fromTo(mark, { scale: 0.93 }, { scale: 1, ease: "none", transformOrigin: "left top", scrollTrigger: { trigger: spacer, start: "top bottom", end: "bottom bottom", scrub: true } })
    } else {
      footer.style.visibility = "visible"
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      footer.removeEventListener("pointermove", move)
      footer.removeEventListener("pointerleave", leave)
      triggers.forEach((t) => t.kill())
      tween?.scrollTrigger?.kill()
      const lenis = getLenis()
      if (lenis) lenis.options.wheelMultiplier = 1
    }
  }, [])

  return (
    <footer ref={root} aria-label="Site footer" className="invisible fixed inset-x-0 bottom-0 z-0 h-svh overflow-hidden bg-[oklch(0.125_0.025_285)] text-[oklch(0.94_0.02_85)]">
      <canvas ref={canvas} aria-hidden className="absolute inset-0 size-full" />

      <div data-fcontent className="pointer-events-none relative z-10 flex h-full flex-col justify-between p-[clamp(1.25rem,2.6vw,2.6rem)]">
        <div className="flex flex-col gap-10 max-lg:pt-[4.5rem] lg:flex-row lg:justify-between">
          {/* the wordmark */}
          <h2 data-fmark aria-label="CareerBridge" className="font-display text-[clamp(4.4rem,16.5vw,19rem)] leading-[0.82] tracking-[-0.03em] text-[oklch(0.94_0.02_85)] uppercase italic">
            Career
            <br />
            Bridge
          </h2>

          {/* who and where */}
          <div className="pointer-events-auto w-full max-w-[34rem] lg:mt-3 lg:w-[38%]">
            <p className={LABEL}>Project</p>
            <p className="font-display mt-4 text-[clamp(1.35rem,2.1vw,2.2rem)] leading-[1.05] uppercase">SIH26044 · Ministry of Ayush</p>

            <div className="mt-[clamp(2rem,6.5vh,5rem)] grid grid-cols-2 gap-x-6">
              <div>
                <p className={LABEL}>Explore</p>
                <ul className="mt-4 space-y-1">
                  {LINKS.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className={LINK}>
                        <Roll>{l.label}</Roll>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className={LABEL}>Join as</p>
                <ul className="mt-4 space-y-1">
                  {JOIN.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className={LINK}>
                        <Roll>{l.label}</Roll>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
          <div className="pointer-events-auto space-y-1 text-[13px] text-[oklch(0.94_0.02_85/0.7)]">
            <p>Copyright © CareerBridge 2026</p>
            <p className="text-[oklch(0.94_0.02_85/0.45)]">Built with Django &amp; Next.js</p>
          </div>
          <div className="pointer-events-auto sm:w-[38%]">
            <p className={LABEL}>Get started</p>
            <Link href="/register" className="font-display mt-2 inline-block border-b-2 border-current text-[clamp(1.8rem,4.3vw,4.6rem)] leading-none tracking-[0.005em] uppercase transition-colors hover:text-white">
              Create free account
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
