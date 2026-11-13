"use client"

import * as React from "react"
import { cn } from "cn"

/**
 * Career stickers around the hero's edges, cut out of the vintage sticker sheets as transparent WebPs:
 * /public/stickers/career/ (20) and /public/stickers/job-hunt/ (30, incl. the Job Hunt badge and the sparkles).
 * Each one pops in on load, then floats on its own slow loop; hover makes it wiggle; LandingMotion drifts them at
 * different depths on scroll. They stay clear of the headline. With reduced motion they simply sit there.
 *
 * They can be picked up and moved: grab one, drag it anywhere in the hero (it follows the pointer exactly from
 * where you grabbed it, lifts a little and comes to the front), let go and it stays there.
 */

const src = (name: string) => (name.includes("/") ? `/stickers/${name}.webp` : `/stickers/job-hunt/${name}.webp`)

/* where each sticker sits: phones/tablets (a row above the words, a row below), desktop (down both sides).
   The rocket, offer letter and statue are desktop-only (no room beside the words on a phone); on short phones
   a few more step aside so the words keep their room. */
const SHORT = "max-lg:[@media(max-height:760px)]"
const STICKERS: { name: string; alt: string; pos: string; size: string; r: number; depth: number; dur: number }[] = [
  // left side (desktop) / top row (phones)
  { name: "job-hunt", alt: "Job hunt", pos: "left-[3%] top-[11%] lg:left-[3%] lg:top-[12%]", size: "w-[min(30vw,140px,14svh)] lg:w-[max(110px,min(11vw,170px,24svh))]", r: -8, depth: 0.5, dur: 5.6 },
  { name: "career/astronaut-laptop", alt: "Astronaut on a laptop", pos: `left-[36%] top-[13%] lg:left-[18%] lg:top-[5%]`, size: "w-[min(27vw,124px,12svh)] lg:w-[max(92px,min(9vw,140px,19svh))]", r: 6, depth: 0.8, dur: 6.4 },
  { name: "career/rocket", alt: "Rocket", pos: "max-lg:hidden lg:left-[13%] lg:top-[37%]", size: "lg:w-[max(84px,min(8vw,124px,17svh))]", r: -10, depth: 0.35, dur: 6 },
  { name: "career/level-up-controller", alt: "Level up", pos: `left-[3%] top-[72%] lg:left-[2%] lg:top-[64%] ${SHORT}:top-[78%]`, size: "w-[min(30vw,140px,13svh)] lg:w-[max(104px,min(10vw,160px,22svh))]", r: -6, depth: 0.45, dur: 6.6 },
  { name: "career/statue-shades", alt: "Statue in pixel sunglasses", pos: "max-lg:hidden lg:left-[16%] lg:top-[72%]", size: "lg:w-[max(80px,min(7.5vw,118px,17svh))]", r: 7, depth: 0.75, dur: 7 },
  // right side (desktop) / top + bottom rows (phones)
  { name: "career/apply-computer", alt: "Apply", pos: "right-[3%] top-[10%] lg:right-[4%] lg:top-[11%]", size: "w-[min(27vw,128px,13svh)] lg:w-[max(100px,min(10vw,158px,22svh))]", r: 8, depth: 0.7, dur: 5.2 },
  { name: "career/offer-letter", alt: "Offer letter", pos: "max-lg:hidden lg:right-[15%] lg:top-[37%]", size: "lg:w-[max(90px,min(9vw,140px,19svh))]", r: 9, depth: 0.55, dur: 5.8 },
  { name: "career/briefcase-badge", alt: "Briefcase with an ID badge", pos: `left-[36%] top-[78%] lg:left-auto lg:right-[3%] lg:top-[59%]`, size: "w-[min(26vw,118px,12svh)] lg:w-[max(92px,min(9vw,142px,20svh))]", r: 6, depth: 0.6, dur: 5.4 },
  { name: "career/grad-cap", alt: "Graduation cap", pos: `right-[3%] top-[71%] lg:right-[18%] lg:top-[73%] ${SHORT}:top-[77%]`, size: "w-[min(28vw,130px,12svh)] lg:w-[max(96px,min(9vw,140px,19svh))]", r: -8, depth: 0.4, dur: 4.8 },
  // the rest of the set: only on big screens (1280px+ wide and 820px+ tall), in the open spaces around the words
  { name: "career/checklist", alt: "Checklist", pos: "hidden [@media(min-width:1280px)_and_(min-height:820px)]:block lg:left-[3%] lg:top-[38%]", size: "lg:w-[max(70px,min(7vw,104px,14svh))]", r: -7, depth: 0.5, dur: 6.2 },
  { name: "career/books-stack", alt: "Stack of DSA books", pos: "hidden [@media(min-width:1280px)_and_(min-height:820px)]:block lg:right-[3%] lg:top-[36%]", size: "lg:w-[max(70px,min(7vw,104px,14svh))]", r: 6, depth: 0.45, dur: 5.7 },
  { name: "career/megaphone", alt: "Megaphone", pos: "hidden [@media(min-width:1280px)_and_(min-height:820px)]:block lg:left-[33%] lg:top-[9%]", size: "lg:w-[max(70px,min(7vw,104px,14svh))]", r: -6, depth: 0.65, dur: 5.3 },
  { name: "career/calendar-clock", alt: "Calendar and clock", pos: "hidden [@media(min-width:1280px)_and_(min-height:820px)]:block lg:right-[33%] lg:top-[9%]", size: "lg:w-[max(70px,min(7vw,104px,14svh))]", r: 6, depth: 0.6, dur: 6.1 },
  { name: "career/laptop-code", alt: "Laptop with code", pos: "hidden [@media(min-width:1280px)_and_(min-height:820px)]:block lg:left-[22%] lg:top-[54%]", size: "lg:w-[max(64px,min(6vw,88px,12svh))]", r: -5, depth: 0.5, dur: 5.9 },
  { name: "career/laptop-search", alt: "Laptop with a magnifier", pos: "hidden [@media(min-width:1280px)_and_(min-height:820px)]:block lg:right-[22%] lg:top-[54%]", size: "lg:w-[max(64px,min(6vw,88px,12svh))]", r: 5, depth: 0.5, dur: 6.3 },
  { name: "career/summit-flag", alt: "Summit flag", pos: "hidden [@media(min-width:1280px)_and_(min-height:820px)]:block lg:left-[33%] lg:top-[80%]", size: "lg:w-[max(70px,min(7vw,104px,14svh))]", r: -4, depth: 0.4, dur: 5.5 },
  { name: "career/coffee-books", alt: "Coffee on books", pos: "hidden [@media(min-width:1280px)_and_(min-height:820px)]:block lg:left-[25%] lg:top-[86%]", size: "lg:w-[max(70px,min(7vw,104px,14svh))]", r: 5, depth: 0.35, dur: 6.8 },
  { name: "career/globe-plane", alt: "Globe with a plane", pos: "hidden [@media(min-width:1280px)_and_(min-height:820px)]:block lg:right-[37%] lg:top-[80%]", size: "lg:w-[max(70px,min(7vw,104px,14svh))]", r: 4, depth: 0.4, dur: 5.6 },
  { name: "career/binoculars-map", alt: "Binoculars and a map", pos: "hidden [@media(min-width:1280px)_and_(min-height:820px)]:block lg:right-[28%] lg:top-[86%]", size: "lg:w-[max(70px,min(7vw,104px,14svh))]", r: -5, depth: 0.35, dur: 6.4 },
  { name: "career/camera-photos", alt: "Camera with photos", pos: "hidden [@media(min-width:1280px)_and_(min-height:820px)]:block lg:right-[3%] lg:top-[78%]", size: "lg:w-[max(70px,min(7vw,104px,14svh))]", r: 7, depth: 0.45, dur: 5 },
]
// phones & tablets: a second, smaller set in the gaps between the big rows and the words, and along the very bottom
// (the scroll arrow keeps the middle). On short phones the bottom row drops lower and a touch smaller so the words keep their room.
const SMALL = "w-[min(15vw,64px)] md:w-[min(10vw,84px)] max-lg:[@media(max-height:760px)]:w-[min(11vw,46px)]"
const LOW = `max-lg:[@media(max-height:760px)]:top-[92%]`
const SMALL_STICKERS: typeof STICKERS = [
  { name: "career/megaphone", alt: "Megaphone", pos: `left-[6%] top-[27%] lg:hidden`, size: SMALL, r: -8, depth: 0.6, dur: 5.3 },
  { name: "career/calendar-clock", alt: "Calendar and clock", pos: `right-[6%] top-[27%] lg:hidden`, size: SMALL, r: 7, depth: 0.5, dur: 6.1 },
  { name: "career/checklist", alt: "Checklist", pos: `left-[5%] top-[88%] lg:hidden ${LOW}`, size: SMALL, r: -6, depth: 0.4, dur: 6.2 },
  { name: "career/books-stack", alt: "Stack of DSA books", pos: `right-[5%] top-[88%] lg:hidden ${LOW}`, size: SMALL, r: 6, depth: 0.4, dur: 5.7 },
  { name: "career/laptop-search", alt: "Laptop with a magnifier", pos: `left-[6%] top-[40%] lg:hidden hidden md:block`, size: SMALL, r: 5, depth: 0.5, dur: 6.3 },
  { name: "career/camera-photos", alt: "Camera with photos", pos: `right-[6%] top-[40%] lg:hidden hidden md:block`, size: SMALL, r: -6, depth: 0.45, dur: 5 },
]
const ALL_STICKERS = [...STICKERS, ...SMALL_STICKERS]
const SPARKLES = [
  { name: "sparkle-pink-1", pos: "max-lg:hidden lg:left-[25%] lg:top-[33%] lg:w-8", delay: "0s" },
  { name: "sparkle-yellow-1", pos: "right-[30%] top-[8%] w-5 lg:right-[26%] lg:top-[30%] lg:w-7", delay: "0.9s" },
  { name: "sparkle-yellow-2", pos: "left-[13%] top-[66%] w-5 lg:left-[18%] lg:top-[62%] lg:w-7", delay: "1.6s" },
  { name: "sparkle-pink-2", pos: "right-[17%] top-[64%] w-6 lg:right-[8%] lg:top-[47%] lg:w-8", delay: "0.4s" },
]

/**
 * Wraps a sticker so it can be picked up and moved around the hero. Pressing lifts it off the page (it grows, its
 * shadow falls away beneath it); dragging tilts it in 3D toward the way you're moving, like paper held by a corner;
 * letting go drops it — it falls, squashes a touch on landing and settles. Offsets are written straight to the
 * element (no re-renders); the tilt eases on its own small animation loop that stops when it's still.
 */
let topZ = 10
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
type Tilt = { x: number; y: number; tx: number; ty: number; raf: number }
/** One frame of the tilt: ease toward the target, let the target relax to flat, stop when it's still. */
function tiltStep(el: HTMLDivElement | null, t: Tilt) {
  t.raf = 0
  if (!el) return
  t.x += (t.tx - t.x) * 0.18
  t.y += (t.ty - t.y) * 0.18
  t.tx *= 0.9
  t.ty *= 0.9
  el.style.transform = `perspective(700px) rotateX(${t.x.toFixed(2)}deg) rotateY(${t.y.toFixed(2)}deg)`
  if (Math.abs(t.x) + Math.abs(t.y) + Math.abs(t.tx) + Math.abs(t.ty) > 0.05) t.raf = requestAnimationFrame(() => tiltStep(el, t))
  else el.style.transform = ""
}
function Draggable({ children, label }: { children: React.ReactNode; label: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const pos = React.useRef({ x: 0, y: 0 })
  const tilt = React.useRef<Tilt>({ x: 0, y: 0, tx: 0, ty: 0, raf: 0 })
  const drag = React.useRef<{
    id: number; sx: number; sy: number; ox: number; oy: number
    min: { x: number; y: number }; max: { x: number; y: number }
    lx: number; ly: number; lt: number
  } | null>(null)

  const still = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

  const spin = () => tiltStep(ref.current, tilt.current)
  React.useEffect(() => () => cancelAnimationFrame(tilt.current.raf), [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    const hero = el?.closest("section")
    if (!el || !hero || e.button > 0) return
    e.preventDefault()
    el.setPointerCapture(e.pointerId)
    el.getAnimations().forEach((an) => an.cancel()) // grabbed mid-fall: take it from where it is
    const r = el.getBoundingClientRect()
    const b = hero.getBoundingClientRect()
    const { x, y } = pos.current
    drag.current = {
      id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: x, oy: y,
      min: { x: x + (b.left - r.left), y: y + (b.top - r.top) },
      max: { x: x + (b.right - r.right), y: y + (b.bottom - r.bottom) },
      lx: e.clientX, ly: e.clientY, lt: e.timeStamp,
    }
    const layer = el.closest<HTMLElement>("[data-sticker]")
    if (layer) layer.style.zIndex = String(++topZ)
    el.dataset.dragging = ""
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = ref.current
    if (!d || !el || e.pointerId !== d.id) return
    const x = clamp(d.ox + e.clientX - d.sx, d.min.x, d.max.x)
    const y = clamp(d.oy + e.clientY - d.sy, d.min.y, d.max.y)
    pos.current = { x, y }
    el.style.translate = `${x}px ${y}px`
    if (still()) return
    // lean toward the motion: faster drags tilt further (capped), like a sheet held by a corner
    const dt = Math.max(e.timeStamp - d.lt, 8)
    const vx = (e.clientX - d.lx) / dt
    const vy = (e.clientY - d.ly) / dt
    d.lx = e.clientX
    d.ly = e.clientY
    d.lt = e.timeStamp
    const t = tilt.current
    t.ty = clamp(vx * 22, -24, 24)
    t.tx = clamp(-vy * 22, -24, 24)
    if (!t.raf) t.raf = requestAnimationFrame(spin)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!drag.current || !el || e.pointerId !== drag.current.id) return
    drag.current = null
    delete el.dataset.dragging
    if (still()) return
    // the drop: it falls from its lifted size, squashes a little as it lands, and settles
    el.animate(
      [
        { scale: "1.16", offset: 0 },
        { scale: "0.93", offset: 0.55, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" },
        { scale: "1.03", offset: 0.8 },
        { scale: "1", offset: 1 },
      ],
      { duration: 460, easing: "cubic-bezier(0.55, 0, 1, 0.45)" }
    )
  }

  return (
    <div
      ref={ref}
      aria-label={`${label} (drag to move)`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="group pointer-events-auto cursor-grab touch-none transition-[scale] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] [transform-style:preserve-3d] data-dragging:scale-[1.16] data-dragging:cursor-grabbing motion-reduce:transition-none"
    >
      {children}
    </div>
  )
}

export function HeroStickers() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[15] select-none">{/* above the hero's text block (z-10) so every sticker can be grabbed; only the stickers themselves take the pointer */}
      {ALL_STICKERS.map(({ name, alt, pos, size, r, depth, dur }, i) => (
        <div key={`${name}-${i}`} data-sticker data-parallax={depth} className={cn("absolute", pos, size)}>
          <Draggable label={alt}>
          {/* pop in, one after another */}
          <div className="animate-[cb-sticker-pop_700ms_cubic-bezier(0.34,1.56,0.64,1)_both] motion-reduce:animate-none" style={{ animationDelay: `${450 + i * 90}ms` }}>
            {/* then float, each on its own rhythm */}
            <div
              className="animate-[cb-sticker-float_var(--dur)_ease-in-out_infinite] will-change-transform motion-reduce:animate-none"
              style={{ "--dur": `${dur}s`, animationDelay: `${-i * 0.7}s`, rotate: `${r}deg` } as React.CSSProperties}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- small, already-optimised sticker art */}
              <img
                src={src(name)}
                alt={alt}
                draggable={false}
                decoding="async"
                className="pointer-events-none block h-auto w-full drop-shadow-[0_6px_10px_oklch(0.12_0.08_285/0.45)] transition-[transform,filter] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-105 group-hover:rotate-[6deg] group-data-dragging:-translate-y-2 group-data-dragging:rotate-[-3deg] group-data-dragging:drop-shadow-[0_30px_26px_oklch(0.1_0.08_285/0.42)]"
              />
            </div>
          </div>
          </Draggable>
        </div>
      ))}

      {SPARKLES.map(({ name, pos }) => (
        // eslint-disable-next-line @next/next/no-img-element -- tiny decorative sparkle
        <img
          key={name}
          src={src(name)}
          alt=""
          draggable={false}
          className={cn("absolute h-auto", pos)}
        />
      ))}
    </div>
  )
}
