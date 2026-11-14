"use client"

import * as React from "react"
import gsap from "gsap"

/**
 * What waits beyond the intro's window: a student floating free, eyes closed (public/intro/freedom-anim.webp, an
 * animated WebP with its own subtle breathing loop), and a chain of fine stardust streaming along one path round him:
 * up from below, across his waist, and away over his shoulder.
 *
 * The dust is ~500 tiny specks (1–2 screen px, square, so it reads as grain, not as bubbles) drawn on a canvas. Each
 * drifts along the path inside a narrow band, twinkles a little, and thins out at both ends. Speck sizes are kept in
 * screen pixels, so they stay fine whatever the scroll is scaling the whole thing to. The art lives in a 300 × 300 box.
 */

// the one path: in from the lower left, round behind his legs, across in front of his waist, up past his shoulder
const PATH = "M 28 292 C 40 236, 252 246, 238 196 C 226 154, 70 170, 74 128 C 78 92, 214 98, 206 58 C 200 30, 160 14, 146 -6"
const COUNT = 520
const SAMPLES = 700

export function IntroFreedom() {
  const box = React.useRef<HTMLDivElement>(null)
  const cv = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    const el = box.current
    const canvas = cv.current
    if (!el || !canvas) return
    const ctx = canvas.getContext("2d")!

    // sample the path once: points and their normals, in box units
    const svgPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
    svgPath.setAttribute("d", PATH)
    const len = svgPath.getTotalLength()
    const px = new Float32Array(SAMPLES + 1)
    const py = new Float32Array(SAMPLES + 1)
    for (let i = 0; i <= SAMPLES; i++) {
      const p = svgPath.getPointAtLength((i / SAMPLES) * len)
      px[i] = p.x
      py[i] = p.y
    }
    const nx = new Float32Array(SAMPLES + 1)
    const ny = new Float32Array(SAMPLES + 1)
    for (let i = 0; i <= SAMPLES; i++) {
      const a = Math.max(0, i - 1)
      const b = Math.min(SAMPLES, i + 1)
      const dx = px[b] - px[a]
      const dy = py[b] - py[a]
      const l = Math.hypot(dx, dy) || 1
      nx[i] = -dy / l
      ny[i] = dx / l
    }

    // the specks
    const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2 // ~N(0, 0.4)
    const u = new Float32Array(COUNT) // where along the path, 0..1
    const v = new Float32Array(COUNT) // speed, path lengths per second
    const off = new Float32Array(COUNT) // across the band, box units
    const size = new Float32Array(COUNT) // screen px
    const lum = new Float32Array(COUNT) // base brightness
    const tw = new Float32Array(COUNT) // twinkle phase
    for (let i = 0; i < COUNT; i++) {
      u[i] = Math.random()
      v[i] = 0.045 + Math.random() * 0.035
      const stray = Math.random() < 0.12
      off[i] = gauss() * (stray ? 16 : 5.5)
      size[i] = Math.random() < 0.82 ? 1 : Math.random() < 0.85 ? 1.5 : 2
      lum[i] = 0.35 + Math.random() * 0.6
      tw[i] = Math.random() * Math.PI * 2
    }

    let w = 0
    let h = 0
    let dpr = 1
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = el.offsetWidth
      h = el.offsetHeight
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()

    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!w) return
      // how much the scroll is scaling us right now, so specks can stay 1–2 px on screen (read from GSAP's own
      // record of the scale, not from the layout, which would force the browser to lay out the page every frame)
      const holder = el.closest<HTMLElement>("[data-free]")
      const shown = (holder ? Number(gsap.getProperty(holder, "scale")) : 1) || 1
      const k = w / 300 // box units → css px
      const t = now / 1000
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "#f3ecff"
      for (let i = 0; i < COUNT; i++) {
        let p = u[i] + v[i] * dt
        if (p > 1) p -= 1
        u[i] = p
        const s = Math.min(SAMPLES, Math.floor(p * SAMPLES))
        // thinner at the ends of the path, fuller in the middle
        const ends = Math.min(1, p / 0.08) * Math.min(1, (1 - p) / 0.12)
        const band = 0.45 + 0.55 * Math.sin(Math.PI * p)
        const x = (px[s] + nx[s] * off[i] * band) * k
        const y = (py[s] + ny[s] * off[i] * band) * k
        const a = lum[i] * ends * (0.65 + 0.35 * Math.sin(t * 3 + tw[i]))
        if (a < 0.03) continue
        const sz = (size[i] / shown) * dpr // device px on our canvas, so it shows as size[i] screen px
        ctx.globalAlpha = a
        ctx.fillRect(x * dpr - sz / 2, y * dpr - sz / 2, sz, sz)
      }
      ctx.globalAlpha = 1
    }
    // only while on screen
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf)
      if (e.isIntersecting) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
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
    <div ref={box} className="relative size-full">
      {/* a faint violet aura behind him: a soft gradient, no blur filter (a blur under a scaling layer is redrawn on
          every frame of the scroll, which is what made phones stutter here) */}
      <div className="absolute inset-[14%_18%] rounded-full bg-[radial-gradient(closest-side,oklch(0.78_0.16_300/0.3),oklch(0.78_0.16_300/0.12)_55%,transparent)]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/intro/freedom-anim.webp"
        alt=""
        draggable={false}
        className="absolute top-[6%] left-1/2 h-[88%] w-auto -translate-x-1/2"
      />
      <canvas ref={cv} aria-hidden className="pointer-events-none absolute inset-0 size-full" />
    </div>
  )
}
