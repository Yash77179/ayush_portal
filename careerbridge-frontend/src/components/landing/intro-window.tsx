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
        .fromTo(q("[data-free-rise]"), { yPercent: 0 }, { yPercent: -142, duration: 0.82, ease: "power3.in" }, 0)
        .set(q("[data-free-rise]"), { autoAlpha: 0 }, 0.83)
        // the mountains grow a little with the view, and from the start are sinking away below him
        .fromTo(q("[data-peaks]"), { scale: 0.62 }, { scale: 1.06, duration: 0.5, ease: "sine.inOut" }, 0)
        .fromTo(q("[data-peaks-sink]"), { yPercent: 0 }, { yPercent: 100, duration: 0.8, ease: "power3.in" }, 0)
        .fromTo(q("[data-night]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: "sine.inOut" }, 0.46)
        .set({}, {}, 1)

      if (window.scrollY < section.offsetTop + section.offsetHeight - window.innerHeight) nav(true)

      const hero = document.querySelector<HTMLElement>("[data-hero]")
      // The hero shares the intro's night sky. Its copy of the sky is held still on screen while the hero moves
      // (counter-translated), so the two line up exactly and there is no edge where the hero meets the intro.
      const heroSky = hero?.querySelector<HTMLElement>("[data-hero-sky]")
      const hold = hero && heroSky
        ? ScrollTrigger.create({
            trigger: hero,
            start: "top bottom",
            end: "bottom top",
            onUpdate: () => {
              heroSky.style.transform = `translate3d(0, ${-hero.getBoundingClientRect().top}px, 0)`
            },
            onRefresh: () => {
              heroSky.style.transform = `translate3d(0, ${-hero.getBoundingClientRect().top}px, 0)`
            },
          })
        : null

      return () => {
        io.disconnect()
        scene.destroy()
        hold?.kill()
        if (heroSky) heroSky.style.transform = ""
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
          <div data-peaks className="absolute inset-0 origin-[50%_var(--cy)]">
            <div data-peaks-sink className="absolute inset-x-[-100%] bottom-[8%] sm:inset-x-[-6%] sm:bottom-[-16%] [mask-image:linear-gradient(#000_70%,transparent)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/intro/mountains.webp" alt="" draggable={false} className="block h-auto w-full" />
            </div>
          </div>

          {/* beyond the window: a student floating free, a stream of light drifting round him (intro-freedom.tsx).
              Just beyond the glass; as you pass through he soars up past you and out of view */}
          <div data-free className="absolute inset-0 flex origin-[50%_var(--cy)] items-center justify-center">
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

        
      </div>
    </section>
  )
}
