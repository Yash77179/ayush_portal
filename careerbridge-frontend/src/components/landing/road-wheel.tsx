"use client"

import * as React from "react"

/**
 * A → B, under the horizontal journey (after neutomni.com's process section).
 *
 * A road runs along the lower part of the pinned stage. At the start it is bumpy (a row of arcs that travel with the
 * scenes as they slide by); as you go through the journey it flattens into a straight line. A wheel rolls along it
 * from A (where you are) to B (where you're going): it starts as a square and gains sides as it goes, ending as a
 * true circle, turning as it rolls. A dashed guide runs through its axle.
 *
 * Drawn on one canvas; it reads the journey's progress from the track's own transform, so it needs no timeline of its
 * own, and only draws while the stage is on screen. Desktop only (the journey is vertical on smaller screens).
 */

const SIDES = [4, 4, 5, 6, 7, 8, 10, 12, 16, 24, 48, 96]
const INK = "oklch(0.2 0.05 280 / 0.6)"
const FAINT = "oklch(0.2 0.05 280 / 0.22)"

export function RoadWheel() {
  const root = React.useRef<HTMLDivElement>(null)
  const cv = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    const el = root.current
    const canvas = cv.current
    if (!el || !canvas) return
    const track = el.parentElement?.querySelector<HTMLElement>(".h-track")
    if (!track) return
    const ctx = canvas.getContext("2d")!
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let w = 0
    let h = 0
    let dpr = 1
    const size = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = el.offsetWidth
      h = el.offsetHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    const ro = new ResizeObserver(size)
    ro.observe(el)
    size()

    const ease = (t: number) => t * t * (3 - 2 * t)
    let lastKey = ""

    const draw = () => {
      if (!w) return
      // progress through the journey, from the track's own position
      const m = new DOMMatrixReadOnly(getComputedStyle(track).transform)
      const scrolled = -m.m41
      const dist = Math.max(1, track.scrollWidth - w)
      const p = Math.max(0, Math.min(1, scrolled / dist))
      const key = `${w}x${h}:${scrolled.toFixed(1)}`
      if (key === lastKey) return
      lastKey = key
      // the caption says its line at the start, then steps aside as the scenes slide in under it
      el.style.setProperty("--cap", String(Math.max(0, 1 - p / 0.06)))

      const road = h * 0.84
      const r = Math.max(26, h * 0.052)
      const flat = ease(Math.min(1, p / 0.85)) // the road is smooth by the time the wheel is nearly there
      const amp = (1 - flat) * h * 0.024
      const period = Math.max(120, w * 0.085)
      // the road's height at a screen x: a row of arcs (∩) that move with the scenes
      const bump = (x: number) => {
        const u = (((x + scrolled) % period) + period) % period / period
        return road - amp * Math.sin(Math.PI * u)
      }
      const x0 = w * 0.07
      const x1 = w * 0.93
      const wx = x0 + (x1 - x0) * p

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.lineCap = "round"
      ctx.lineJoin = "round"

      // the road
      ctx.strokeStyle = INK
      ctx.lineWidth = 1.2
      ctx.beginPath()
      for (let x = 0; x <= w; x += 3) {
        const y = bump(x)
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // the wheel: more sides the further it has come, resting on the road under it, turning as it rolls
      const n = SIDES[Math.min(SIDES.length - 1, Math.floor(ease(p) * SIDES.length))]
      const cy = bump(wx) - r
      const turn = (scrolled + wx) / r
      ctx.beginPath()
      for (let k = 0; k <= n; k++) {
        const a = turn + (k / n) * Math.PI * 2
        const px = wx + Math.cos(a) * r
        const py = cy + Math.sin(a) * r
        if (k === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
      // its axle, and the dashed guide through it
      ctx.fillStyle = INK
      ctx.beginPath()
      ctx.arc(wx, cy, 2.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = FAINT
      ctx.setLineDash([4, 6])
      ctx.beginPath()
      ctx.moveTo(x0, cy)
      ctx.lineTo(x1, cy)
      ctx.stroke()
      ctx.setLineDash([])
      // the travelled part of the guide, solid
      ctx.strokeStyle = INK
      ctx.beginPath()
      ctx.moveTo(x0, road + 14)
      ctx.lineTo(wx, road + 14)
      ctx.stroke()
      for (const x of [x0, x1]) {
        ctx.beginPath()
        ctx.moveTo(x, road + 9)
        ctx.lineTo(x, road + 19)
        ctx.stroke()
      }
    }

    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      draw()
    }
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf)
      if (e.isIntersecting) {
        lastKey = ""
        if (reduce) draw()
        else raf = requestAnimationFrame(loop)
      }
    })
    io.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
    }
  }, [])

  return (
    <div ref={root} aria-hidden className="pointer-events-none absolute inset-0 z-[5] hidden lg:block">
      <canvas ref={cv} className="absolute inset-0 size-full" />
      {/* the two ends of the road */}
      <div className="absolute top-[calc(84%+1.6rem)] left-[7%] -translate-x-1/2 text-center text-[oklch(0.2_0.05_280)]">
        <p className="font-display text-[1.6rem] leading-none italic">A</p>
        <p className="mt-1 text-[11px] font-semibold tracking-[0.18em] whitespace-nowrap uppercase opacity-55">Where you are</p>
      </div>
      <div className="absolute top-[calc(84%+1.6rem)] left-[93%] -translate-x-1/2 text-center text-[oklch(0.2_0.05_280)]">
        <p className="font-display text-[1.6rem] leading-none italic">B</p>
        <p className="mt-1 text-[11px] font-semibold tracking-[0.18em] whitespace-nowrap uppercase opacity-55">Where you&rsquo;re going</p>
      </div>
      <p className="absolute top-[calc(84%-5.6rem)] left-[7%] max-w-[15rem] text-[13px] leading-snug text-[oklch(0.2_0.05_280/0.6)]" style={{ opacity: "var(--cap, 1)" }}>
        The road can get <em className="font-display text-[1.1em]">bumpy.</em> We keep you <em className="font-display text-[1.1em]">rolling</em> regardless.
      </p>
    </div>
  )
}
