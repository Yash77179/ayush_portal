"use client"

import * as React from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

import { useRouter } from "next/navigation"

import { ArrowRightIcon } from "@/components/icons"
import { MeetPill } from "@/components/landing/meet-bridge"
import { PlateArt, type ArtKind } from "@/components/landing/plate-art"
import { useAuth } from "@/contexts/auth-context"
import { queueBridge } from "@/lib/assistant"

/**
 * What follows the numbers. The numbers sheet curls up off the screen like the underside of a sphere
 * (its bottom corners round off and its edge becomes a dome as it rises), uncovering a stage that then
 * stays pinned and perfectly still. On it, scroll plays one short sequence:
 *
 *   headline eases in  →  holds  →  blurs away
 *   cards slide in from both edges and gather into one tilted deck
 *   a paragraph appears on each side of the deck
 *   then the front card's sparkle takes over: a dark star grows out of it, past the card, over the whole
 *   screen; a sphere of glittering dots turns inside it while Bridge (the AI assistant) is introduced around
 *   it — big words, one line, one link — then the dots burst outward and the dark runs on into the footer
 *
 * Everything is a transform or an opacity tied to scroll (the same easing as the rest of the page), and
 * only the two headline lines are blurred, so it stays light. Phones and tablets get the same sequence, laid out
 * for a tall screen (smaller cards, the paragraphs above and below the deck, Bridge's words stacked above the
 * sphere). With reduced motion it is a plain static block instead.
 */

const CARDS: { tag: string; title: string; art?: ArtKind; hue: number; end: { x: number; y: number; r: number } }[] = [
  { tag: "Students", title: "Your skills, mapped", art: "waves", hue: 262, end: { x: -34, y: 14, r: -7 } },
  { tag: "Matching", title: "86% match", art: "ripples", hue: 300, end: { x: 30, y: -10, r: 5 } },
  { tag: "Applications", title: "Shortlisted", art: "contours", hue: 240, end: { x: -14, y: -18, r: -3 } },
  { tag: "Companies", title: "38 applicants", art: "silk", hue: 320, end: { x: 20, y: 16, r: 6 } },
  { tag: "Universities", title: "92% placed", hue: 290, end: { x: 0, y: 0, r: 0 } }, // the sparkle card (see SPARK)
]


/* ── The sparkle and the star that grows out of it: one four-point shape, in a 100×100 box ── */
const STAR_D = "M50 0C53.5 33 67 46.5 100 50C67 53.5 53.5 67 50 100C46.5 67 33 53.5 0 50C33 46.5 46.5 33 50 0Z"
const SPARK = 92 // px: the sparkle on the card and the one that takes over from it are the same size, on the same spot

/* ── The takeover, all painted into one full-screen canvas: the dark star, the sphere of dots inside it, and the
   circle of light that opens out of the sparkle at the end. Painting one shape per frame is cheap; scaling a DOM/SVG
   star up 90× (what this used to do) made the browser repaint an ~8000px layer every frame — the jank on slower
   machines. The dots are precomputed (no trig per dot per frame), grouped by colour, and fewer on low-end devices. ── */
const INK = "#07060f"
const DOT_RGB = ["255,255,255", "196,150,255", "232,121,249"]
const LEVELS = 6 // brightness steps per colour: dots are batched into 3 × 6 shapes, so a frame is 18 fills, not thousands
const DOT_FILL = DOT_RGB.map((rgb) => Array.from({ length: LEVELS }, (_, l) => `rgba(${rgb},${((l + 0.5) / LEVELS).toFixed(3)})`))
type Dots = {
  n: number
  sinPh: Float32Array; cosPh: Float32Array; cosTh: Float32Array; sinTh: Float32Array
  s3: Float32Array; c3: Float32Array; s4: Float32Array; c4: Float32Array
  drift: Float32Array; groupEnd: number[] // dots are sorted by colour: [end of white, end of lilac, end of pink]
}
function makeDots(count: number): Dots {
  const golden = Math.PI * (3 - Math.sqrt(5))
  const raw = Array.from({ length: count }, (_, i) => {
    const ph = Math.acos(1 - (i / (count - 1)) * 2)
    const th = golden * i
    const r = Math.random()
    return { ph, th, color: r < 0.22 ? 0 : r < 0.5 ? 1 : 2, drift: 0.6 + Math.random() * 0.9 }
  }).sort((p, q) => p.color - q.color)
  const f = () => new Float32Array(count)
  const d: Dots = { n: count, sinPh: f(), cosPh: f(), cosTh: f(), sinTh: f(), s3: f(), c3: f(), s4: f(), c4: f(), drift: f(), groupEnd: [0, 0, 0] }
  raw.forEach((p, i) => {
    d.sinPh[i] = Math.sin(p.ph); d.cosPh[i] = Math.cos(p.ph)
    d.cosTh[i] = Math.cos(p.th); d.sinTh[i] = Math.sin(p.th)
    d.s3[i] = Math.sin(p.th * 3); d.c3[i] = Math.cos(p.th * 3)
    d.s4[i] = Math.sin(p.ph * 4); d.c4[i] = Math.cos(p.ph * 4)
    d.drift[i] = p.drift
    d.groupEnd[p.color] = i + 1
  })
  d.groupEnd[1] = Math.max(d.groupEnd[1], d.groupEnd[0]); d.groupEnd[2] = count
  return d
}

const STAR_PATH = typeof Path2D === "undefined" ? null : new Path2D(STAR_D)
type Scene = { inkA: number; ink: number; fill: number; ring: number; burst: number; land: number; bg: string; words: number }
/** Is anything moving on its own (the dots turn), so the canvas needs a new frame even without scrolling? */
const animating = (sc: Scene) => sc.ring > 0.001 && sc.burst < 0.999 && sc.land < 0.999
function paint(ctx: CanvasRenderingContext2D, d: Dots, w: number, h: number, t: number, sc: Scene) {
  ctx.clearRect(0, 0, w, h)
  const cx = w / 2
  const cy = h / 2
  const covers = sc.ink >= 60 || sc.fill >= 0.999 // the star (or the fill) already hides the whole screen
  const starAt = () => {
    const k = (SPARK * sc.ink) / 100
    ctx.translate(cx - 50 * k, cy - 50 * k)
    ctx.scale(k, k)
  }

  // the dark star
  if (sc.inkA > 0.001) {
    ctx.globalAlpha = sc.inkA
    ctx.fillStyle = INK
    // once it covers the screen, the black is a plain layer under the canvas ([data-ink-solid]), not repainted per frame
    if (!covers && STAR_PATH) {
      const base = ctx.getTransform()
      starAt()
      ctx.fill(STAR_PATH)
      ctx.setTransform(base)
      if (sc.fill > 0.001) {
        ctx.globalAlpha = sc.fill
        ctx.fillRect(0, 0, w, h)
      }
    }
  }

  // the sphere of dots, inside the star
  if (sc.ring > 0.001 && sc.burst < 0.999) {
    ctx.save()
    if (!covers && STAR_PATH) {
      const base = ctx.getTransform()
      starAt()
      ctx.clip(STAR_PATH)
      ctx.setTransform(base)
    }
    const R0 = Math.min(w, h) * 0.3 * (0.55 + 0.45 * sc.ring)
    const fade = sc.ring * (1 - sc.burst)
    const b2 = sc.burst * sc.burst
    const spin = t * 0.00018
    const cs = Math.cos(spin), ss = Math.sin(spin)
    const a1 = t * 0.0011, a2 = t * 0.0008
    const ca1 = Math.cos(a1), sa1 = Math.sin(a1), ca2 = Math.cos(a2), sa2 = Math.sin(a2)
    ctx.globalAlpha = fade
    let i = 0
    for (let g = 0; g < 3; g++) {
      const buckets = Array.from({ length: LEVELS }, () => new Path2D())
      for (const end = d.groupEnd[g]; i < end; i++) {
        // lumpy surface: sin(3θ + a1) · sin(4φ − a2), by angle addition (no trig here)
        const lump = 1 + 0.07 * (d.s3[i] * ca1 + d.c3[i] * sa1) * (d.s4[i] * ca2 - d.c4[i] * sa2)
        const r = R0 * lump * (1 + b2 * (1.6 + d.drift[i] * 2.2))
        const cth = d.cosTh[i] * cs - d.sinTh[i] * ss
        const sth = d.sinTh[i] * cs + d.cosTh[i] * ss
        const sx = d.sinPh[i] * cth
        const sz = d.sinPh[i] * sth
        const sy = d.cosPh[i]
        const y2 = sy * 0.92 - sz * 0.38
        const z2 = sy * 0.38 + sz * 0.92
        const depth = (z2 + 1) * 0.5
        const edge = 1 - (z2 < 0 ? -z2 : z2)
        const rim = edge * edge * Math.sqrt(edge) // ≈ edge^2.5: the rim glows like a bubble, the face stays dark
        let a = (0.1 + 1.1 * rim) * (0.4 + 0.6 * depth)
        if (a > 1) a = 1
        if (a * fade < 0.03) continue
        const size = 1.1 + depth * 1.6
        buckets[Math.min(LEVELS - 1, (a * LEVELS) | 0)].rect(cx + sx * r - size / 2, cy + y2 * r - size / 2, size, size)
      }
      for (let l = 0; l < LEVELS; l++) {
        ctx.fillStyle = DOT_FILL[g][l]
        ctx.fill(buckets[l])
      }
    }
    ctx.restore()
  }

  // the circle of light that opens out of the sparkle: you land on the page
  if (sc.land > 0.001) {
    ctx.globalAlpha = 1
    ctx.fillStyle = sc.bg
    if (sc.land >= 0.999) ctx.fillRect(0, 0, w, h)
    else {
      ctx.beginPath()
      ctx.arc(cx, cy, sc.land * Math.hypot(w, h) * 0.52, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

/* ── The backdrop: fine flowing lines, nothing else. Thin, low-contrast and perfectly still. ── */
const f1 = (v: number) => v.toFixed(1)
const SILK = Array.from({ length: 26 }, (_, i) => {
  const pts: string[] = []
  for (let x = -40; x <= 1640; x += 40) pts.push(`${f1(x)} ${f1(930 - i * 36 - (46 + i * 3.4) * Math.sin(x / 270 + i * 0.12))}`)
  return { d: "M" + pts.join("L"), o: 0.1 + (i % 4) * 0.035, accent: i === 17 }
})

export function StoryStage() {
  const root = React.useRef<HTMLElement>(null)
  const router = useRouter()
  const { user } = useAuth()
  const [bridgeOn, setBridgeOn] = React.useState(false)
  const bridgeRef = React.useRef(setBridgeOn)
  const talk = () => {
    queueBridge({})
    router.push(user ? "/dashboard" : "/login")
  }

  React.useEffect(() => {
    const el = root.current
    if (!el) return
    gsap.registerPlugin(ScrollTrigger)
    // phones: the address bar sliding in and out resizes the viewport — don't re-measure every pin for that (it jumps)
    ScrollTrigger.config({ ignoreMobileResize: true })
    const stage = el.querySelector<HTMLElement>("[data-stage]")
    const mm = gsap.matchMedia()

    // ── the sheet above curls up into a dome as it leaves (desktop: on phones that's a big repaint on every scroll
    //    frame, and the dome cut into the numbers — there the sheet simply scrolls away) ──
    const sheet = document.querySelector<HTMLElement>("[data-curl]")
    mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
      if (!sheet) return
      const curl = ScrollTrigger.create({
        trigger: sheet,
        start: "bottom bottom",
        end: "bottom 22%",
        onUpdate: (self) => {
          const p = self.progress
          // horizontal radius swells to a half-ellipse; vertical radius follows more slowly, so it reads as a dome forming
          sheet.style.borderBottomLeftRadius = sheet.style.borderBottomRightRadius = `${(50 * Math.pow(p, 0.8)).toFixed(2)}% ${(window.innerHeight * 0.46 * Math.pow(p, 1.5)).toFixed(1)}px`
        },
        onLeaveBack: () => {
          sheet.style.borderBottomLeftRadius = sheet.style.borderBottomRightRadius = "0"
        },
      })
      return () => {
        curl.kill()
        sheet.style.borderBottomLeftRadius = sheet.style.borderBottomRightRadius = ""
      }
    })

    mm.add({ motion: "(prefers-reduced-motion: no-preference)", wide: "(min-width: 1024px)", touch: "(pointer: coarse)" }, (mctx) => {
      const { motion, wide, touch } = mctx.conditions as { motion: boolean; wide: boolean; touch: boolean }
      if (!motion) return
      const q = (s: string) => el.querySelector(s)
      const lines = gsap.utils.toArray<HTMLElement>("[data-line]", el)
      const cards = gsap.utils.toArray<HTMLElement>("[data-card]", el)
      const sides = gsap.utils.toArray<HTMLElement>("[data-side]", el)
      const head = q("[data-head]")

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        // a finger flick shouldn't leave the scene trailing behind it: tighter smoothing on touch
        scrollTrigger: { trigger: el, start: "top top", end: "bottom bottom", scrub: touch ? 0.35 : 0.9, invalidateOnRefresh: true },
      })

      // 1 · the headline comes up out of the stillness, line by line.
      // (Start states are set outright: a staggered fromTo only applies them once each line's turn comes, which let line two show early.)
      gsap.set(lines, { opacity: 0, y: 30, filter: "blur(16px)" })
      lines.forEach((ln, i) => tl.to(ln, { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.8, ease: "power2.out" }, i * 0.45))
      // 2 · it holds, then blurs away
      tl.to(head, { opacity: 0, scale: 1.04, y: -24, duration: 1.7, ease: "power2.in" }, 3.4)
      tl.to(lines, { filter: "blur(20px)", duration: 1.7, ease: "power2.in" }, 3.4)

      // 3 · cards arrive from both edges and gather into one deck
      // (GSAP owns the centring: leaving it to a CSS translate let it drop the horizontal half on some widths)
      gsap.set(cards, { xPercent: -50, yPercent: -50 })
      cards.forEach((card, i) => {
        const side = i % 2 === 0 ? -1 : 1
        const fin = CARDS[i].end
        tl.fromTo(
          card,
          {
            x: () => side * (window.innerWidth * 0.5 + card.offsetWidth * 0.75 + card.offsetHeight * 0.45 + i * window.innerWidth * 0.03),
            y: () => (i % 2 === 0 ? 1 : -1) * window.innerHeight * (0.1 + i * 0.04),
            rotate: side * (24 + i * 3),
            opacity: 1,
          },
          { x: fin.x, y: fin.y, rotate: fin.r, duration: 3.2, ease: "power2.inOut" },
          3.7 + i * 0.4
        )
      })

      // 4 · a paragraph slides in from each edge of the screen, once the deck has landed
      sides.forEach((sd, i) => {
        const dir = i === 0 ? -1 : 1
        const from = wide ? { x: () => dir * window.innerWidth * 0.42 } : { y: () => (i === 0 ? -1 : 1) * 40 }
        tl.fromTo(sd, { ...from, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 1.8, ease: "power3.out" }, 7.9 + i * 0.3)
      })
      // 5 · the sparkle takes over: everything else slips away
      const spark = q("[data-spark]") as HTMLElement | null
      const cardSpark = q("[data-card-spark]") as HTMLElement | null
      const canvas = q("[data-takeover]") as HTMLCanvasElement | null
      tl.to(sides, { opacity: 0, ...(wide ? { x: (i: number) => (i === 0 ? -60 : 60) } : { y: (i: number) => (i === 0 ? -30 : 30) }), duration: 1, ease: "power2.in" }, 10.4)
      tl.to(cards.slice(0, -1), { opacity: 0, scale: 0.92, duration: 1.2, ease: "power2.in" }, 10.4)
      tl.set(spark, { opacity: 1 }, 10.6)
      tl.set(cardSpark, { opacity: 0 }, 10.6)

      // the canvas: sized to the screen, at a modest resolution (lower on low-end devices)
      const nav = navigator as Navigator & { deviceMemory?: number }
      const lowEnd = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4
      const ctx2d = canvas?.getContext("2d") ?? null
      const dots = makeDots(window.innerWidth < 768 ? 1400 : lowEnd ? 1800 : 3000)
      const sc: Scene = { inkA: 0, ink: 1, fill: 0, ring: 0, burst: 0, land: 0, bg: "#fff", words: 0 }
      // the canvas paints in its own box's size: on phones the address bar changes the window's height but not the
      // stage's (it is 100svh), so sizing from the window made the star drift against the sparkle as you scrolled
      const box = { w: 1, h: 1 }
      const fit = () => {
        if (!canvas) return
        const w = canvas.clientWidth
        const h = canvas.clientHeight
        if (!w || !h || (w === box.w && h === box.h)) return // only when it really changed (and never clear it otherwise)
        box.w = w
        box.h = h
        canvas.width = w // 1x: tiny dots and a soft star look the same, at a fraction of the pixels
        canvas.height = h
        wake()
      }
      let raf = 0
      let lastPaint = 0
      let dirty = true
      const loop = (t: number) => {
        raf = 0
        if (!ctx2d) return
        // on low-end devices the slowly turning sphere is redrawn at 30fps (scroll changes still paint right away)
        if (lowEnd && !dirty && t - lastPaint < 31) {
          raf = requestAnimationFrame(loop)
          return
        }
        dirty = false
        lastPaint = t
        paint(ctx2d, dots, box.w, box.h, t, sc)
        if (animating(sc)) raf = requestAnimationFrame(loop) // keeps turning only while the dots are on screen
      }
      // While the dark has the screen: the nav goes light-on-dark with its blur off (re-blurring a strip over a
      // canvas that changes every frame is what dragged slower GPUs), and what's fully covered stops being drawn.
      const hidden = [q("[data-backdrop]"), ...cards] as (HTMLElement | null)[]
      const solid = q("[data-ink-solid]") as HTMLElement | null
      let navDark = false
      let covered = false
      let pillOn = false
      const sync = () => {
        if (sc.words > 0.5 !== pillOn) {
          pillOn = sc.words > 0.5
          bridgeRef.current(pillOn)
        }
        const dark = sc.inkA > 0.5 && (sc.ink > 6 || sc.fill > 0) && sc.land < 0.5
        if (dark !== navDark) {
          navDark = dark
          window.dispatchEvent(new CustomEvent("cb:nav-dark", { detail: dark }))
        }
        const cover = sc.inkA > 0.99 && (sc.ink >= 60 || sc.fill >= 0.999)
        if (cover !== covered) {
          covered = cover
          for (const n of hidden) if (n) n.style.visibility = cover ? "hidden" : ""
          if (solid) solid.style.visibility = cover ? "visible" : "hidden"
        }
      }
      function wake() {
        dirty = true
        sync()
        if (!raf) raf = requestAnimationFrame(loop)
      }
      const ro = new ResizeObserver(fit)
      if (canvas) ro.observe(canvas)
      fit()

      // 6 · the dark star grows out of the sparkle, steadily, for as long as you keep scrolling: it starts exactly the
      //     sparkle's size (hidden behind it), and every bit of scroll grows it by the same factor — so it never stalls
      const INK_MAX = 90
      const grow = { v: 0 }
      tl.fromTo(sc, { inkA: 0 }, { inkA: 1, duration: 0.05, onUpdate: wake, immediateRender: false }, 10.6)
      tl.fromTo(
        grow,
        { v: 0 },
        {
          v: 1,
          duration: 3.6,
          ease: "none",
          immediateRender: false,
          onUpdate: () => {
            sc.ink = Math.exp(grow.v * Math.log(INK_MAX))
            wake()
          },
        },
        10.6
      )
      tl.fromTo(sc, { fill: 0 }, { fill: 1, duration: 0.5, ease: "none", onUpdate: wake, immediateRender: false }, 13.8)

      // 7 · the sphere of dots appears inside the star, turns, then bursts outward and fades
      tl.fromTo(sc, { ring: 0 }, { ring: 1, duration: 2.2, ease: "power2.out", onUpdate: wake, immediateRender: false }, 12.9)

      // 8 · Bridge is introduced around the sphere: the big words rise out of their lines, then the pill (dot → pill),
      //     one line and the link
      const words = gsap.utils.toArray<HTMLElement>("[data-bword] > span", el)
      const note = q("[data-bnote]")
      gsap.set(words, { yPercent: 110 })
      gsap.set(note, { autoAlpha: 0, y: 18 })
      tl.to(words, { yPercent: 0, duration: 1.3, ease: "power3.out", stagger: 0.28 }, 13.5)
      tl.fromTo(sc, { words: 0 }, { words: 1, duration: 0.1, onUpdate: wake, immediateRender: false }, 14.1)
      tl.to(note, { autoAlpha: 1, y: 0, duration: 1, ease: "power2.out" }, 14.3)

      // 9 · the dots burst outward behind the words; the sparkle goes out; the dark stays and runs on into the footer
      tl.fromTo(sc, { burst: 0 }, { burst: 1, duration: 1.6, ease: "power1.in", onUpdate: wake, immediateRender: false }, 16.0)

      tl.to(spark, { scale: 0, opacity: 0, rotate: 90, duration: 1, ease: "power2.in" }, 16.6)
      tl.to({}, { duration: 0.01 }, 17.8) // hold the finished frame (words on the dark) to the end of the scroll

      return () => {
        cancelAnimationFrame(raf)
        ro.disconnect()
        window.dispatchEvent(new CustomEvent("cb:nav-dark", { detail: false }))
        bridgeRef.current(false)
        for (const n of hidden) if (n) n.style.visibility = ""
        if (solid) solid.style.visibility = "hidden"
      }
    })

    // static: no pin, no sequence — headline, paragraphs, done
    mm.add("(prefers-reduced-motion: reduce)", () => {
      if (stage) stage.style.removeProperty("height")
      el.querySelectorAll<HTMLElement>("[data-line],[data-head],[data-side]").forEach((n) => gsap.set(n, { clearProps: "all" }))
    })

    return () => mm.revert()
  }, [])

  return (
    <section ref={root} aria-label="Why CareerBridge" className="relative z-10 motion-safe:-mt-[42svh] motion-safe:h-[560svh] lg:motion-safe:h-[800svh]">
      <div data-stage className="relative overflow-hidden bg-[oklch(0.925_0.04_290)] px-6 py-24 motion-safe:sticky motion-safe:top-0 motion-safe:h-svh motion-safe:px-0 motion-safe:py-0">
        {/* the backdrop: it never moves — fine lines on a pale lilac */}
        <svg aria-hidden data-backdrop className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <defs>
            <linearGradient id="story-sky" x1="0" y1="0" x2="0.35" y2="1">
              <stop offset="0" stopColor="oklch(0.965 0.02 290)" />
              <stop offset="1" stopColor="oklch(0.9 0.05 292)" />
            </linearGradient>
          </defs>
          <rect width="1600" height="900" fill="url(#story-sky)" />
          {/* flowing curves */}
          <g stroke="oklch(0.42 0.12 285)" strokeWidth="1">
            {SILK.map((l, i) => (
              <path key={i} d={l.d} strokeOpacity={l.o} stroke={l.accent ? "oklch(0.55 0.17 290)" : undefined} strokeWidth={l.accent ? 1.6 : 1} />
            ))}
          </g>
        </svg>

        {/* headline */}
        <div data-head className="relative z-10 flex flex-col items-center px-6 text-center motion-safe:absolute motion-safe:inset-0 motion-safe:justify-center">
          <p data-line className="font-display text-[clamp(1.4rem,3vw,3.1rem)] leading-none tracking-[-0.01em] text-[oklch(0.22_0.05_280)] uppercase italic">
            Not another job board.
          </p>
          <p data-line className="font-display mt-3 text-[clamp(2.9rem,12vw,8.6rem)] leading-[0.92] tracking-[-0.02em] text-balance text-[oklch(0.5_0.19_290)] uppercase italic lg:text-[clamp(3rem,8vw,8.6rem)]">
            For first steps.
          </p>
        </div>

        {/* the deck */}
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden motion-safe:block">
          {CARDS.map((c, i) => (
            <div
              key={c.tag}
              data-card
              className="absolute top-1/2 left-1/2 aspect-[4/5] w-[min(64vw,19rem,36svh)] rounded-[26px] bg-white p-2 sm:w-[min(42vw,22rem,36svh)] lg:w-[min(23vw,27rem,56svh)] lg:rounded-[30px] opacity-0 shadow-[0_30px_60px_-30px_oklch(0.2_0.1_285/0.55),0_2px_6px_oklch(0.2_0.1_285/0.1)] will-change-transform"
              style={{ zIndex: i + 1 }}
            >
              {c.art ? (
                <div className="relative size-full overflow-hidden rounded-[19px] p-5 lg:rounded-[23px] lg:p-6" style={{ background: `linear-gradient(160deg, oklch(0.998 0.003 ${c.hue}), oklch(0.95 0.045 ${c.hue}))` }}>
                  <PlateArt kind={c.art} hue={c.hue} id={`sg-${i}`} />
                  <span className="relative text-[11px] font-semibold tracking-[0.24em] text-[oklch(0.22_0.05_280/0.6)] uppercase">{c.tag}</span>
                  <p className="font-display absolute right-5 bottom-5 left-5 text-[clamp(1.9rem,3.2vw,3.4rem)] leading-[0.95] tracking-[-0.02em] text-[oklch(0.22_0.05_280)] italic lg:right-6 lg:bottom-6 lg:left-6">{c.title}</p>
                </div>
              ) : (
                <div className="relative size-full overflow-hidden rounded-[19px] bg-[radial-gradient(90%_60%_at_45%_22%,oklch(0.86_0.09_295),transparent_70%),linear-gradient(170deg,oklch(0.6_0.2_288),oklch(0.42_0.22_283))] p-5 text-white lg:rounded-[23px] lg:p-6">
                  <span className="relative inline-flex rounded-full bg-black/20 px-3 py-1.5 text-[11px] font-semibold tracking-[0.24em] uppercase backdrop-blur-sm">{c.tag}</span>
                  <svg data-card-spark viewBox="0 0 100 100" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: SPARK, height: SPARK }}>
                    <path d={STAR_D} fill="white" />
                  </svg>
                  <p className="font-display absolute right-5 bottom-5 left-5 text-[clamp(1.9rem,3.2vw,3.4rem)] leading-[0.95] tracking-[-0.02em] italic lg:right-6 lg:bottom-6 lg:left-6">{c.title}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* the takeover: the dark star grows out of the sparkle, the dots turn inside it, then it all melts into the page */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-20 hidden motion-safe:block">
          <div data-ink-solid className="invisible absolute inset-0 bg-[#07060f]" />
          <canvas data-takeover className="absolute inset-0 size-full" />
          <svg data-spark viewBox="0 0 100 100" className="absolute top-1/2 left-1/2 opacity-0 drop-shadow-[0_0_24px_oklch(0.85_0.12_300/0.6)]" style={{ width: SPARK, height: SPARK, marginLeft: -SPARK / 2, marginTop: -SPARK / 2 }}>
            <path d={STAR_D} fill="white" />
          </svg>
        </div>

        {/* Bridge, introduced around the sphere (with reduced motion it has its own small section instead) */}
        <div className="pointer-events-none absolute inset-0 z-30 hidden text-white motion-safe:block">
          <h2 id="meet-bridge" className="text-[clamp(2.7rem,11vw,8.4rem)] leading-[0.92] font-medium tracking-[-0.045em] lg:text-[clamp(3.4rem,7.6vw,8.4rem)]">
            <span data-bword className="mask-line absolute top-[9svh] left-[6vw] pb-[0.1em] lg:top-[13vh] lg:left-[5vw]">
              <span>Your career,</span>
            </span>
            <span className="absolute top-[calc(9svh+1.05em)] right-[6vw] text-right lg:top-auto lg:right-[5vw] lg:bottom-[9vh]">
              <span data-bword className="mask-line pr-[0.14em] -mr-[0.14em] pb-[0.06em]">
                <span className="font-display tracking-[-0.01em] text-[oklch(0.82_0.11_300)] italic">one question</span>
              </span>
              <span data-bword className="mask-line">
                <span>away.</span>
              </span>
            </span>
          </h2>
          <div data-bnote className="absolute right-[6vw] bottom-[6svh] left-[6vw] max-w-[24rem] lg:right-auto lg:bottom-[11vh] lg:left-[5vw]">
            <MeetPill seen={bridgeOn} className="border-white/20 bg-white/[0.08] text-white/80" />
            <p className="mt-4 text-[15px] leading-relaxed text-white/70 lg:mt-5 lg:text-[clamp(1rem,1.15vw,1.15rem)]">
              Bridge, the assistant inside CareerBridge, knows your profile and every open listing — ask it anything, by text or out loud.
            </p>
            <button
              type="button"
              onClick={talk}
              className="group pointer-events-auto mt-5 inline-flex items-center gap-2 text-[15px] font-medium text-white underline decoration-white/30 underline-offset-[6px] transition-[text-decoration-color] hover:decoration-white/80"
            >
              {user ? "Talk to Bridge" : "Sign in to talk to Bridge"}
              <ArrowRightIcon className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        {/* a paragraph on each side of the deck */}
        <p data-side className="relative z-10 mx-auto mt-10 max-w-md text-center text-[1.05rem] leading-relaxed font-medium text-[oklch(0.22_0.05_280)] motion-safe:absolute motion-safe:inset-x-6 motion-safe:top-[13svh] motion-safe:mt-0 motion-safe:text-[1rem] motion-safe:opacity-0 sm:motion-safe:text-[1.1rem] lg:motion-safe:inset-x-auto lg:motion-safe:top-1/2 lg:motion-safe:left-[6vw] lg:motion-safe:max-w-[22vw] lg:motion-safe:-translate-y-1/2 lg:motion-safe:text-left lg:motion-safe:text-[clamp(1.05rem,1.35vw,1.45rem)]">
          CareerBridge began with a simple question: why is the first internship the hardest one to find?
        </p>
        <p data-side className="relative z-10 mx-auto mt-6 max-w-md text-center text-[1.05rem] leading-relaxed font-medium text-[oklch(0.22_0.05_280)] motion-safe:absolute motion-safe:inset-x-6 motion-safe:bottom-[7svh] motion-safe:mt-0 motion-safe:text-[1rem] motion-safe:opacity-0 sm:motion-safe:text-[1.1rem] lg:motion-safe:inset-x-auto lg:motion-safe:top-1/2 lg:motion-safe:right-[6vw] lg:motion-safe:bottom-auto lg:motion-safe:max-w-[22vw] lg:motion-safe:-translate-y-1/2 lg:motion-safe:text-left lg:motion-safe:text-[clamp(1.05rem,1.35vw,1.45rem)]">
          So everything is in the open — skills matched with the gaps spelled out, every application tracked to its last step, placements measured, not guessed.
        </p>
      </div>
    </section>
  )
}
