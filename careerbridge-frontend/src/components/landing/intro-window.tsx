"use client"

import * as React from "react"
import { preload } from "react-dom"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

import { getLenis } from "@/lib/lenis-instance"

import { IntroFreedom } from "./intro-freedom"
import { NightSky } from "./night-sky"
import { createScene } from "./intro-scene"

/**
 * The opening scene, before the hero: the chaotic "other career sites" office (public/intro/chaos-office.webp) with a
 * steel window set dead in the middle of it. Scrolling flies the camera through the window into a calm dawn sky,
 * climbs until the sky turns to night, and the hero ("Find your first step") rises in underneath. Film grain sits
 * over the room. Motion cloned from wiro.ae (see .reanimate/intro/spec.md); the artwork is our own.
 *
 * The section is 420svh tall with a sticky stage: the zoom through the window takes 1.6 screens of scroll (as on
 * wiro.ae), the climb into the night is slower than theirs, and the hero rises over the last screen. The room is drawn
 * by intro-scene.ts with a window-shaped hole in it, so the sky behind is one full-screen layer.
 * With reduced motion the scene is not shown at all: the page starts at the hero.
 */

const OFFICE = "/intro/chaos-office.webp"
const ARROW = "/intro/scroll-arrow.webp"


/* the copy: white serif over the scene, with the words that matter coloured. Red and a red-violet for what other
   career sites do; violet for this side */
const THEM = "pointer-events-none isolate absolute z-[5] text-white/90 [text-shadow:0_1px_14px_rgb(8_5_20/0.8)]"
/* the display serif comes in one weight; a thin stroke in the text's own colour makes it read bold over the photo */
const HEAVY = "[-webkit-text-stroke:0.012em_currentColor] [paint-order:stroke_fill]"
const US = "pointer-events-none invisible absolute z-[5] text-white/85 opacity-0 [text-shadow:0_1px_14px_rgb(4_6_15/0.7)]"
const LABEL = "flex items-center gap-3 text-[11px] font-semibold tracking-[0.22em] text-white/55 uppercase sm:text-[12px]"
const STATEMENT = "font-display mt-2.5 text-[clamp(1.3rem,2.55vw,2.85rem)] leading-[1.08] tracking-[-0.01em] whitespace-nowrap italic"
const LINE = "block"
const RED = "text-[oklch(0.55_0.21_26)]" // blood red
const STING = "text-[oklch(0.7_0.17_298)]" // the site's violet, against the red
const VIOLET = "text-[oklch(0.78_0.13_300)]"
/* a pool of shade behind a block of copy: the office darkens softly there, so the words sit on calm dark instead of
   the busy photo. No blur (a backdrop blur over the zooming room is redrawn every frame and stutters on phones) */
const Shade = () => (
  <span aria-hidden className="pointer-events-none absolute -inset-x-[50%] -inset-y-[150%] -z-10 bg-[radial-gradient(closest-side,rgb(8_5_20/0.92),rgb(8_5_20/0.8)_40%,rgb(8_5_20/0.4)_70%,transparent)]" />
)
const VioletDash = () => <span aria-hidden className="h-px w-6 bg-[oklch(0.78_0.13_300)]" />

/* the window's steel: graphite with a violet cast, to sit with the office's steel bridge and glass wall */
const BAR = "bg-[linear-gradient(90deg,#16141f,#3d3950_45%,#1c1a27)]"
const BAR_H = "bg-[linear-gradient(180deg,#3d3950,#1c1a27_60%,#100e17)]"

export function IntroWindow() {
  preload(OFFICE, { as: "image", fetchPriority: "high" })
  const root = React.useRef<HTMLElement>(null)

  React.useEffect(() => {
    const section = root.current
    if (!section) return
    gsap.registerPlugin(ScrollTrigger)
    const mm = gsap.matchMedia()

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(section)
      const pane = q("[data-pane]")[0] as HTMLElement
      const stage = q("[data-stage]")[0] as HTMLElement
      // the room: the photo zoomed with depth, the arrow, its shading and film grain, in one WebGL pass (intro-scene.ts)
      const scene = createScene({
        stage,
        pane,
        photo: q("[data-office]")[0] as HTMLCanvasElement,
        photoSrc: OFFICE,
        arrowSrc: ARROW,
        // until the photo is on the canvas the stage is covered, so a refresh never shows the bare window and sky
        onReady: () => gsap.to(q("[data-veil]"), { autoAlpha: 0, duration: 0.5, ease: "power1.out" }),
      })
      const view = { s: 1 } // current zoom, from the scroll
      const light = { v: 0 } // how far the window has opened
      // the scene animates (grain, breathing, the arrow's bob) only while the room is on screen
      let onScreen = false
      let roomGone = false
      const sync = () => (onScreen && !roomGone ? scene.start() : scene.stop())
      const io = new IntersectionObserver(([e]) => {
        onScreen = e.isIntersecting
        sync()
      })
      io.observe(section)

      // how far the office must grow for the window's pane to cover the screen with room to spare
      const zoom = () => {
        const vw = stage.offsetWidth
        const vh = stage.offsetHeight
        const cy = vh / 2 // the window is centred on the stage
        const sx = vw / 2 / (pane.offsetWidth / 2)
        const sy = Math.max(cy, vh - cy) / (pane.offsetHeight / 2)
        return Math.max(sx, sy) * 1.3
      }

      const wide = window.innerWidth >= 1024 // desktop, or phones and tablets (the mountains move differently)
      // how far he must rise to be fully above the top of the screen, whatever its shape: he is scaled to 0.66 by
      // then (about the stage's centre), so the distance is divided by that (142% on a desktop, more on a phone)
      const riseTo = () => {
        const el = q("[data-free-rise]")[0] as HTMLElement
        const h = el.offsetHeight || 1
        const out = stage.offsetHeight / 2 + (h * 0.66) / 2 + 24
        return -Math.max(142, (out / 0.66 / h) * 100)
      }
      // how far the mountains must sink to be fully below the screen (in their own heights)
      const sinkTo = () => {
        const el = q("[data-peaks-sink]")[0] as HTMLElement
        const r = el.getBoundingClientRect()
        const h = r.height || 1
        return Math.max(110, ((stage.offsetHeight - (r.top - stage.getBoundingClientRect().top)) / h) * 100 + 20)
      }
      const nav = (dark: boolean) => window.dispatchEvent(new CustomEvent("cb:nav-dark", { detail: dark }))

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6, // a little catch-up on top of the smooth scrolling, so the zoom glides instead of tugging
          invalidateOnRefresh: true,
          onToggle: (self) => nav(self.isActive), // the nav steps aside during the scene, like wiro's
          onUpdate: (self) => {
            const gone = self.progress * 1 > 0.53 // the room has faded out (timeline units, see below)
            if (gone !== roomGone) {
              roomGone = gone
              sync()
            }
          },
        },
      })
      tl
        // 1. through the window (0 → 0.5): slow at first, then rushing in
        .fromTo(q("[data-wall]"), { scale: 1 }, { scale: zoom, duration: 0.5, ease: "power2.in" }, 0)
        .fromTo(view, { s: 1 }, { s: zoom, duration: 0.5, ease: "power2.in", onUpdate: () => scene.setZoom(view.s) }, 0)
        .to(q("[data-wall], [data-office]"), { autoAlpha: 0, duration: 0.08 }, 0.44)
        // the window opens as you come up to it, so nothing stands between you and the sky
        // (the moment of the scene: they part soon after you set off, swing wide at an even pace, and light pours out
        // into the room as they do; fully open well before you reach them)
        .to(q("[data-sash='left']"), { rotateY: -112, duration: 0.27, ease: "power1.inOut" }, 0.05)
        .to(q("[data-sash='right']"), { rotateY: 112, duration: 0.27, ease: "power1.inOut" }, 0.05)
        .fromTo(light, { v: 0 }, { v: 1, duration: 0.27, ease: "power1.inOut", onUpdate: () => scene.setLight(light.v) }, 0.05)
        // 2. the climb: dusk turns to night and the stars come out; then the hero rises over it
        // (timeline units: 1 = 320svh of scroll. The section is 420svh, so 320svh of scroll = 1 unit; the hero
        // starts rising over the scene at 0.6875, while he is still floating out.)
        // Everything beyond the window moves from the first pixel of scroll, continuously, on curves that start
        // barely moving and build. There is no point where something waits for something else, so scrolling back up
        // plays the same single motion in reverse.
        // he comes a little nearer (never too close)...
        .fromTo(q("[data-free]"), { scale: 0.34 }, { scale: 0.66, duration: 0.5, ease: "sine.inOut" }, 0)
        // ...and from the start he is rising, imperceptibly at first, then up and out of the top of the screen
        .fromTo(q("[data-free-rise]"), { yPercent: 0 }, { yPercent: riseTo, duration: 0.82, ease: "power3.in" }, 0)
        .set(q("[data-free-rise]"), { autoAlpha: 0 }, 0.83)
        // the mountains grow a little with the view, and from the start are sinking away below him
        .fromTo(q("[data-peaks]"), { scale: 0.62 }, { scale: wide ? 1.06 : 0.96, duration: 0.5, ease: "sine.inOut" }, 0)
        // (phones and tablets: they sink all the way off the bottom of the screen before the hero comes up, so its
        // edge never cuts them; on desktop they sink away below him)
        .fromTo(q("[data-peaks-sink]"), { yPercent: 0 }, wide ? { yPercent: 100, duration: 0.8, ease: "power3.in" } : { yPercent: sinkTo, duration: 0.66, ease: "power2.in" }, 0)
        .fromTo(q("[data-night]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: "sine.inOut" }, 0.46)
        // the copy. Over the office: what other career sites do to you. It drifts aside from the first pixel of scroll
        // (outwards on desktop, up on phones) and is gone before the window opens wide, so nothing sits over the zoom.
        .fromTo(q("[data-them='left']"), { x: 0, autoAlpha: 1 }, { x: () => -window.innerWidth * 0.08, autoAlpha: 0, duration: 0.22, ease: "power1.in" }, 0)
        .fromTo(q("[data-them='right']"), { x: 0, autoAlpha: 1 }, { x: () => window.innerWidth * 0.08, autoAlpha: 0, duration: 0.22, ease: "power1.in" }, 0)
        .fromTo(q("[data-them='top']"), { y: 0, autoAlpha: 1 }, { y: -36, autoAlpha: 0, duration: 0.2, ease: "power1.in" }, 0)
        // ...and once you're through, beside him (below him on phones and tablets): what it's like on this side. It rises
        // in as the sky turns to night, drifts up with him, and has gone before the hero arrives.
        // it rises in as you come up to the window (before you're through), drifts up the whole time, slowly, and on
        // desktop stays until just before the hero comes up; on phones it leaves ahead of him as he rises into the top
        // once the window is fully behind you (the room has faded out by 0.52), each block glides in from its own side of
        // the screen and eases to a stop: long and soft, no bounce. It drifts up with him, then glides back out the
        // way it came, sinking a little as it goes.
        .fromTo(q("[data-us='left']"), { x: () => -window.innerWidth * 0.22, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.13, ease: "power3.out" }, 0.53)
        .fromTo(q("[data-us='right']"), { x: () => window.innerWidth * 0.22, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.13, ease: "power3.out" }, 0.55)
        .fromTo(q("[data-us='phone']"), { x: () => -window.innerWidth * 0.5, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.09, ease: "power3.out" }, 0.52)
        .fromTo(q("[data-us]"), { yPercent: 0 }, { yPercent: wide ? -40 : -60, duration: wide ? 0.17 : 0.1, ease: "none" }, 0.53)
        .to(q("[data-us='left']"), { x: () => -window.innerWidth * 0.18, y: 36, autoAlpha: 0, duration: 0.07, ease: "power2.in" }, 0.63)
        .to(q("[data-us='right']"), { x: () => window.innerWidth * 0.18, y: 36, autoAlpha: 0, duration: 0.07, ease: "power2.in" }, 0.63)
        .to(q("[data-us='phone']"), { x: () => window.innerWidth * 0.4, y: 28, autoAlpha: 0, duration: 0.05, ease: "power2.in" }, 0.57)
        .set({}, {}, 1)

      if (window.scrollY < section.offsetTop + section.offsetHeight - window.innerHeight) nav(true)


      return () => {
        io.disconnect()
        scene.destroy()
        nav(false)
      }
    })
    return () => mm.revert()
  }, [])

  const skip = () => {
    const hero = document.querySelector<HTMLElement>("[data-hero]")
    if (!hero) return
    const lenis = getLenis()
    if (lenis) lenis.scrollTo(hero, { duration: 1.8 })
    else hero.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <section ref={root} aria-label="Intro" className="relative h-[420svh] bg-[#0a132a] motion-reduce:hidden">
      <div
        data-stage
        className="sticky top-0 h-svh overflow-hidden [--cy:50svh] [--wh:min(88vw,calc(56svh-72px))] sm:[--wh:min(clamp(340px,40vw,640px),calc(56svh-72px))] [--ww:calc(var(--wh)/2)] [--t:clamp(10px,1.1vw,17px)] [--bar:clamp(4px,0.42vw,7px)]"
      >
        {/* ── the sky behind the window: a plain dusk, with night and stars laid over it as you climb ── */}
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,oklch(0.36_0.09_278),oklch(0.5_0.1_288)_50%,oklch(0.7_0.09_330))]">
          <div data-night className="invisible absolute inset-0 opacity-0">
            <NightSky />
          </div>

          {/* the mountains far below him (public/intro/mountains.webp): they grow with the zoom like the rest of the view,
              and once you're through they sink slowly away, so he seems to keep rising, high above them */}
          <div data-peaks className="absolute inset-0 origin-[50%_var(--cy)]" style={{ transform: "scale(0.62)" }}>
            <div data-peaks-sink className="absolute inset-x-[-100%] bottom-[8%] [mask-image:linear-gradient(#000_45%,transparent_96%)] sm:inset-x-[-45%] sm:bottom-[6%] lg:inset-x-[-6%] lg:bottom-[-16%] lg:[mask-image:linear-gradient(#000_70%,transparent)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/intro/mountains.webp" alt="" draggable={false} className="block h-auto w-full" />
            </div>
          </div>

          {/* beyond the window: a student floating free, a stream of light drifting round him (intro-freedom.tsx).
              Just beyond the glass; as you pass through he soars up past you and out of view */}
          <div data-free className="absolute inset-0 flex origin-[50%_var(--cy)] items-center justify-center" style={{ transform: "scale(0.34)" }}>
            <div data-free-rise className="aspect-square h-[min(86svh,120vw)] shrink-0">
              <IntroFreedom />
            </div>
          </div>
        </div>

        {/* ── the office, with a window-shaped hole in the middle of it ── */}
        {/* drawn by intro-scene.ts: the photo (with depth), the arrow, shading and film grain */}
        <canvas data-office aria-hidden className="absolute inset-0 size-full" />
        <div data-wall className="pointer-events-none absolute inset-0 origin-[50%_var(--cy)] will-change-transform">

          {/* the window: a steel casement with a deep reveal, 2 × 4 lights, a latch, glass glare and a sill */}
          <div data-pane className="absolute top-1/2 left-1/2 h-(--wh) w-(--ww) -translate-1/2">
            {/* the "skip intro" sticker, stuck on the top of the frame: it travels with the window as you go through */}
            <button
              data-skip
              type="button"
              onClick={skip}
              aria-label="Skip intro"
              className="group/skip pointer-events-auto absolute bottom-[calc(100%+var(--t)*0.35)] left-1/2 z-10 w-[calc(var(--ww)*0.32)] max-w-[88px] min-w-[60px] -translate-x-1/2 rotate-[-4deg] cursor-pointer rounded-md transition-transform duration-300 ease-(--ease-out) hover:rotate-[-1deg] hover:scale-[1.06] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:scale-[0.97]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/intro/skip-intro.webp"
                alt=""
                draggable={false}
                className="block h-auto w-full drop-shadow-[0_6px_10px_rgb(8_5_20/0.55)] transition-[filter] duration-300 group-hover/skip:drop-shadow-[0_10px_16px_rgb(8_5_20/0.6)]"
              />
            </button>
            {/* casing */}
            <div
              className="absolute -inset-(--t) border-(length:--t) border-solid [border-image:linear-gradient(160deg,#4a4560,#22202e_45%,#14121c_70%,#2d2a3c)_1] shadow-[0_0_0_1px_#0b0a10,0_24px_40px_-18px_rgb(0_0_0/0.7)]"
            />
            {/* rivets on the casing's corners */}
            {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map((p) => (
              <span
                key={p}
                className={`absolute ${p} size-[calc(var(--t)*0.42)] rounded-full bg-[radial-gradient(circle_at_35%_30%,#8d88a3,#2a2638_70%)] shadow-[0_1px_1px_rgb(0_0_0/0.6)]`}
                style={{ margin: "calc(var(--t) * -0.71)" }}
              />
            ))}
            {/* the reveal: the glass sits back in the wall, so its edges are in shadow */}
            <div className="absolute inset-0 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.6),inset_0_calc(var(--t)*0.9)_calc(var(--t)*1.2)_-4px_rgb(0_0_0/0.55),inset_calc(var(--t)*0.6)_0_calc(var(--t))_-6px_rgb(0_0_0/0.35),inset_calc(var(--t)*-0.6)_0_calc(var(--t))_-6px_rgb(0_0_0/0.35)]" />
            {/* two casement sashes (glass, glazing bars, glare); they swing open outwards as you come up to the window */}
            <div className="absolute inset-0 [perspective:calc(var(--ww)*3)]">
              {(["left", "right"] as const).map((side) => (
                <div
                  key={side}
                  data-sash={side}
                  className={`absolute inset-y-0 w-1/2 [transform-style:preserve-3d] ${side === "left" ? "left-0 origin-left" : "right-0 origin-right"}`}
                >
                  {/* glass: a faint tint and a glare streak */}
                  <div className={`absolute inset-0 ${side === "left" ? "bg-[linear-gradient(118deg,transparent_25%,rgb(255_255_255/0.18)_32%,transparent_44%),linear-gradient(180deg,oklch(0.8_0.06_290/0.14),transparent_45%)]" : "bg-[linear-gradient(118deg,transparent_40%,rgb(255_255_255/0.1)_46%,transparent_54%),linear-gradient(180deg,oklch(0.8_0.06_290/0.14),transparent_45%)]"}`} />
                  {/* the sash's own frame */}
                  <div className="absolute inset-0 shadow-[inset_0_0_0_var(--bar)_#24212f,inset_0_0_0_calc(var(--bar)+1px)_rgb(255_255_255/0.08)]" />
                  {[25, 50, 75].map((y) => (
                    <div key={y} className={`absolute inset-x-0 h-(--bar) -translate-y-1/2 ${BAR_H} shadow-[0_2px_3px_rgb(0_0_0/0.35)]`} style={{ top: `${y}%` }} />
                  ))}
                  {/* the meeting stile, and the latch on the left sash */}
                  <div className={`absolute inset-y-0 w-(--bar) ${BAR} ${side === "left" ? "right-0" : "left-0"}`} />
                  {side === "left" && (
                    <div className="absolute top-[54%] right-0 h-[calc(var(--bar)*5)] w-[calc(var(--bar)*1.9)] translate-x-1/2 rounded-full bg-[linear-gradient(90deg,#6d6782,#c9c3dd_45%,#4a4560)] shadow-[0_2px_4px_rgb(0_0_0/0.5)]" />
                  )}
                </div>
              ))}
            </div>
            {/* sill, on two small brackets */}
            <div className="absolute -inset-x-[calc(var(--t)*2.2)] -bottom-[calc(var(--t)*2.1)] h-[calc(var(--t)*1.1)] rounded-[2px] bg-[linear-gradient(180deg,#5a5470,#2a2638_55%,#17151f)] shadow-[0_10px_18px_-6px_rgb(0_0_0/0.7)]" />
            {[22, 78].map((x) => (
              <span
                key={x}
                className="absolute -bottom-[calc(var(--t)*3.1)] h-[calc(var(--t)*1.1)] w-[calc(var(--t)*0.9)] -translate-x-1/2 bg-[linear-gradient(180deg,#2a2638,#121018)] [clip-path:polygon(0_0,100%_0,0_100%)]"
                style={{ left: `${x}%` }}
              />
            ))}
          </div>
        </div>

        {/* ── the copy over the office: what other career sites do to you (blood red = theirs). Two lines a side ── */}
        {/* desktop & tablet: one block either side of the window, leaning in towards it */}
        <div data-them="left" className={`${THEM} top-1/2 left-[5vw] hidden -translate-y-1/2 sm:block`}>
          <Shade />
          <p className={`${STATEMENT} ${HEAVY} mt-0`}>
            <span className={LINE}>Bury you under <span className={RED}>a thousand</span></span>
            <span className={LINE}><span className={RED}>listings</span>, all <span className={STING}>the same.</span></span>
          </p>
        </div>
        <div data-them="right" className={`${THEM} top-1/2 right-[5vw] hidden -translate-y-1/2 text-right sm:block`}>
          <Shade />
          <p className={`${STATEMENT} ${HEAVY} mt-0`}>
            <span className={LINE}><span className={STING}>Silence.</span> No status,</span>
            <span className={LINE}>no reason, <span className={RED}>no reply.</span></span>
          </p>
        </div>
        {/* phones: both, above the window */}
        <div data-them="top" className={`${THEM} inset-x-5 top-[max(5svh,28px)] text-center sm:hidden`}>
          <Shade />
          <p className={`font-display text-[1.16rem] leading-[1.15] whitespace-nowrap italic ${HEAVY}`}>
            <span className={LINE}>Bury you under <span className={RED}>a thousand listings</span>,</span>
            <span className={LINE}>then leave you in <span className={STING}>silence.</span></span>
          </p>
        </div>

        {/* ── the copy past the window, beside him: this side (violet = ours). It slides in from the screen's sides ── */}
        <div data-us="left" className={`${US} top-1/2 left-[6vw] hidden -translate-y-1/2 lg:block`}>
          <p className={LABEL}><VioletDash />Here, on this side</p>
          <p className={STATEMENT}>
            <span className={LINE}>Your skills <span className={VIOLET}>seen</span>,</span>
            <span className={LINE}>not <span className={VIOLET}>buried.</span></span>
          </p>
        </div>
        <div data-us="right" className={`${US} top-1/2 right-[6vw] hidden -translate-y-1/2 text-right lg:block`}>
          <p className={`${LABEL} justify-end`}>And every application<VioletDash /></p>
          <p className={STATEMENT}>
            <span className={LINE}><span className={VIOLET}>Tracked</span> to the end.</span>
            <span className={LINE}>No more <span className={VIOLET}>silence.</span></span>
          </p>
        </div>
        <div data-us="phone" className={`${US} inset-x-6 top-[9svh] text-center lg:hidden`}>
          <p className={`${LABEL} justify-center`}><VioletDash />Here, on this side<VioletDash /></p>
          <p className="font-display mt-2 text-[1.25rem] leading-[1.15] whitespace-nowrap italic sm:text-[1.55rem]">
            <span className={LINE}>Your skills <span className={VIOLET}>seen</span>, not buried.</span>
            <span className={LINE}>Every application <span className={VIOLET}>tracked.</span></span>
          </p>
        </div>

        {/* covers the stage from the first paint until the office photo is drawn, then fades away (see onReady) */}
        <div data-veil aria-hidden className="pointer-events-none absolute inset-0 z-30 bg-[#0a132a]" />
      </div>
    </section>
  )
}
