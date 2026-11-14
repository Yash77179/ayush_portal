"use client"

import * as React from "react"
import Lenis from "lenis"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

import { setLenis } from "@/lib/lenis-instance"
import { goToSection } from "@/lib/landing-scroll"
import { SMOOTH_SCROLL } from "@/lib/smooth-scroll-config"

/**
 * One place for all landing-page motion: Lenis smooth scrolling driven by GSAP's ticker,
 * ScrollTrigger-scrubbed parallax, masked line reveals, word-by-word "reading" text,
 * stacked cards and counters. Markup stays declarative — sections opt in via data attributes:
 *
 *   data-intro="line|fade|tile"   entrance on load
 *   data-parallax="0.2"           drifts at a different speed from the page
 *   data-mask                     children .mask-line > span slide up when scrolled into view
 *   data-read                     words (.read-word) fill in as you scroll through the paragraph
 *   data-hscroll                  pinned section: vertical scroll drives a horizontal track (desktop)
 *   data-hpar="0.3"               layer inside it that drifts at its own speed
 *   data-stack                    sticky cards that scale back as the next one arrives
 *   data-curtain                  stays pinned and recedes (scale/fade) while the next section slides over it
 *   data-count="1200"             number counts up when seen
 *   data-leave                    a band that slides off like a sheet, uncovering what waits underneath it
 *                                 (the next section is pulled up under it by --under, and holds still while it goes)
 *   data-draw                     an svg path draws itself
 */
export function LandingMotion() {
  // --under: the height of the band that leaves (data-leave). The section after it is pulled up by this much, so it
  // already sits underneath, in place, before the band goes.
  React.useEffect(() => {
    const band = document.querySelector<HTMLElement>("[data-leave]")
    if (!band) return
    const root = document.documentElement
    let last = -1
    const set = () => {
      const h = Math.round(band.offsetHeight)
      if (h === last) return
      last = h
      root.style.setProperty("--under", `${h}px`)
      ScrollTrigger.refresh()
    }
    const ro = new ResizeObserver(set)
    ro.observe(band)
    set()
    return () => {
      ro.disconnect()
      root.style.removeProperty("--under")
    }
  }, [])

  React.useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    // the phone's address bar showing or hiding changes the screen height mid-scroll: don't re-measure every
    // scroll animation for it (that caused jumps)
    ScrollTrigger.config({ ignoreMobileResize: true })
    const root = document.documentElement

    // in-page links (#internships, #roles…) glide to where their section can be seen, not just its top edge
    const onLink = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href^='#']") as HTMLAnchorElement | null
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return
      const id = a.getAttribute("href")!.slice(1)
      if (id && goToSection(id)) e.preventDefault()
    }
    document.addEventListener("click", onLink)
    const mm = gsap.matchMedia()

    mm.add(
      { motion: "(prefers-reduced-motion: no-preference)", wide: "(min-width: 1024px)" },
      (ctx) => {
        const { wide } = ctx.conditions as { motion: boolean; wide: boolean }

        // ── Smooth scrolling (Lenis) wired to GSAP's clock ──
        // syncTouch: on phones and tablets the finger drives Lenis too, so the scroll and every scroll-linked animation
        // move on one clock. (Left to the browser, touch scrolling runs ahead on its own thread and the animations,
        // updated a frame or more later, trail behind it: that was the stutter on phones.)
        // anchors are handled below, so in-page links land where each section can actually be seen.
        const lenis = new Lenis({ ...SMOOTH_SCROLL, anchors: false, syncTouch: true, syncTouchLerp: 0.085, touchInertiaExponent: 1.6 })
        setLenis(lenis)
        lenis.on("scroll", ScrollTrigger.update)
        const tick = (t: number) => lenis.raf(t * 1000)
        gsap.ticker.add(tick)
        gsap.ticker.lagSmoothing(0)

        // ── Entrance ──
        // with the opening scene in front of the hero, the entrance plays when the hero comes up, not on load
        const behindIntro = !!document.querySelector("[data-hero]") && !!document.querySelector("[aria-label='Intro']")
        const intro = gsap.timeline({
          defaults: { ease: "power4.out" },
          scrollTrigger: behindIntro ? { trigger: "[data-hero]", start: "top 75%", once: true } : undefined,
        })
        intro
          .from("[data-intro='line'] > span", { yPercent: 118, duration: 1.15, stagger: 0.12 }, 0.1)
          .from("[data-intro='fade']", { y: 26, autoAlpha: 0, duration: 0.9, stagger: 0.1 }, 0.45)
          .from("[data-intro='tile']", { scale: 0.55, autoAlpha: 0, rotate: -16, duration: 1.1, stagger: 0.14, ease: "back.out(1.5)" }, 0.55)
        root.classList.add("motion-ready")

        // ── Parallax: each layer drifts at its own pace ──
        gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
          const speed = parseFloat(el.dataset.parallax || "0.2") * (wide ? 1 : 0.5)
          gsap.fromTo(
            el,
            { yPercent: -speed * 60 },
            { yPercent: speed * 60, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } }
          )
        })

        // ── Masked line reveals ──
        gsap.utils.toArray<HTMLElement>("[data-mask]").forEach((el) => {
          gsap.from(el.querySelectorAll(".mask-line > span"), {
            yPercent: 115,
            duration: 1.1,
            ease: "power4.out",
            stagger: 0.1,
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          })
        })

        // ── "Reading" text: words light up as you scroll through them ──
        gsap.utils.toArray<HTMLElement>("[data-read]").forEach((el) => {
          const scope = (el.closest("[data-read-scope]") as HTMLElement | null) ?? el
          const pinned = scope !== el
          gsap.fromTo(
            el.querySelectorAll(".read-word"),
            { opacity: 0.14 },
            {
              opacity: 1,
              ease: "none",
              stagger: 0.2,
              scrollTrigger: pinned
                ? { trigger: scope, start: "top 20%", end: "bottom 215%", scrub: 0.5 }
                : { trigger: el, start: "top 80%", end: "bottom 45%", scrub: 0.5 },
            }
          )
        })

        const cleanups: Array<() => void> = []

        // ── Horizontal scroll: the page pins, the track slides sideways, layers drift at their own speed ──
        // (every screen size: on phones the numbers band rises over it at the end, on desktop the fog does)
        {
          gsap.utils.toArray<HTMLElement>("[data-hscroll]").forEach((section) => {
            const track = section.querySelector<HTMLElement>(".h-track")
            if (!track) return
            const steps = Array.from(section.querySelectorAll<HTMLElement>(".h-step"))
            const dist = () => Math.max(0, track.scrollWidth - window.innerWidth)
            // CSS-sticky pin (no JS pin, so no flicker). The track moves one pixel across for each pixel of scroll
            // (as zzdp.nl's values row does); the lead and the hold below give the calm hand-offs at each end
            const travel = () => Math.max(1, dist())
            // Once the track has finished the stage stays pinned for HOLD more scroll while the next section
            // (pulled up by the same 220svh in page.tsx) rises over it, fog first.
            // (phones: the numbers band is pulled up 100svh in page.tsx, so it holds one screen there)
            const hold = () => window.innerHeight * (wide ? 2.2 : 1)
            // it sits under the band above until that has gone: the journey only starts moving after that much scroll
            // …and then a short pause once it's uncovered, so the scene sinks in before it starts to travel
            const lead = () => {
              const under = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--under")) || 0
              return under ? under + window.innerHeight * 0.22 : 0
            }
            const setHeight = () => {
              section.style.height = `${lead() + travel() + window.innerHeight + hold()}px`
            }
            setHeight()

            // Measure once (and on refresh), never per scroll tick: reading offsetLeft/offsetWidth while
            // transforms are changing forces layout, which is what made scrolling here feel heavy.
            let vw = window.innerWidth
            let layers: { el: HTMLElement; mid: number; k: number }[] = []
            let scenes: { left: number; width: number }[] = []
            // the progress line over the row, and the "01 / 03" counter beside it
            const prog = section.querySelector<HTMLElement>("[data-hprog]")
            const count = section.querySelector<HTMLElement>("[data-hcount]")
            const cards = track.children.length
            let span = 1
            const measure = () => {
              vw = window.innerWidth
              span = Math.max(1, dist())
              layers = []
              section.querySelectorAll<HTMLElement>(".h-panel").forEach((pn) => {
                const mid = pn.offsetLeft + pn.offsetWidth / 2
                pn.querySelectorAll<HTMLElement>("[data-hpar]").forEach((el) => layers.push({ el, mid, k: parseFloat(el.dataset.hpar || "0.3") * 340 }))
              })
              scenes = Array.from(section.querySelectorAll<HTMLElement>("[data-seg]")).map((pn) => ({ left: pn.offsetLeft, width: pn.offsetWidth }))
            }
            measure()
            const onRefresh = () => {
              setHeight()
              measure()
            }
            ScrollTrigger.addEventListener("refreshInit", onRefresh)
            cleanups.push(() => ScrollTrigger.removeEventListener("refreshInit", onRefresh))

            const tl = gsap.timeline({
              defaults: { ease: "none" },
              scrollTrigger: {
                trigger: section,
                scrub: 0.4,
                start: () => `top+=${lead()} top`,
                end: () => `+=${travel()}`,
                invalidateOnRefresh: true,
                onUpdate: () => {
                  const x = -(gsap.getProperty(track, "x") as number)
                  const p = Math.max(0, Math.min(1, x / span))
                  if (prog) prog.style.transform = `scaleX(${p.toFixed(4)})`
                  if (count) {
                    const n = `0${Math.round(p * (cards - 1)) + 1}`
                    if (count.textContent !== n) count.textContent = n
                  }
                  // parallax: each layer drifts by how far its panel is from the middle of the screen — one cheap transform each
                  for (const l of layers) l.el.style.transform = `translate3d(${(((l.mid - x - vw / 2) / vw) * l.k).toFixed(1)}px,0,0)`
                  // progress: how far through each scene we are, and which step is lit (written only when it changes)
                  for (let i = 0; i < steps.length; i++) {
                    const sc = scenes[i]
                    if (!sc) continue
                    const f = Math.max(0, Math.min(1, (x + vw * 0.5 - sc.left) / sc.width))
                    const step = steps[i]
                    const state = f >= 0.995 ? "done" : f > 0.004 ? "active" : "idle"
                    if (step.dataset.state !== state) step.dataset.state = state
                    if (Math.abs(f - Number(step.dataset.p || 0)) > 0.002) {
                      step.dataset.p = f.toFixed(3)
                      step.style.setProperty("--p", f.toFixed(3))
                    }
                  }
                },
              },
            })
            tl.to(track, { x: () => -dist(), duration: 1, ease: "none" }, 0)
          })
        }

        // ── Stacked cards ──
        gsap.utils.toArray<HTMLElement>("[data-stack]").forEach((wrap) => {
          const cards = gsap.utils.toArray<HTMLElement>(".stack-card", wrap)
          cards.forEach((card, i) => {
            const next = cards[i + 1]
            if (!next) return
            gsap.to(card.querySelector(".stack-inner"), {
              scale: 0.93,
              yPercent: -3,
              ease: "none",
              scrollTrigger: { trigger: next, start: "top 85%", end: "top 24%", scrub: true },
            })
          })
        })

        // ── Curtain: nothing to animate — the section simply stays pinned and the next one slides over it ──

        // ── Counters ──
        gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
          const target = parseFloat(el.dataset.count || "0")
          const suffix = el.dataset.suffix || ""
          const state = { v: 0 }
          gsap.to(state, {
            v: target,
            duration: 2.6,
            ease: "power3.out",
            onUpdate: () => (el.textContent = Math.round(state.v).toLocaleString("en-IN") + suffix),
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          })
        })

        // ── Hand-drawn strokes ──
        gsap.utils.toArray<SVGPathElement>("[data-draw]").forEach((path) => {
          const len = path.getTotalLength()
          gsap.set(path, { strokeDasharray: len, strokeDashoffset: len })
          gsap.to(path, { strokeDashoffset: 0, duration: 1.4, ease: "power2.inOut", scrollTrigger: { trigger: path, start: "top 85%", once: true } })
        })

        const refresh = () => ScrollTrigger.refresh()
        document.fonts?.ready.then(refresh)
        window.addEventListener("load", refresh)

        return () => {
          cleanups.forEach((fn) => fn())
          document.querySelectorAll<HTMLElement>("[data-hscroll]").forEach((n) => (n.style.height = ""))
          window.removeEventListener("load", refresh)
          gsap.ticker.remove(tick)
          setLenis(null)
          lenis.destroy()
          root.classList.remove("motion-ready")
        }
      }
    )

    // Reduced motion: everything is simply visible.
    mm.add("(prefers-reduced-motion: reduce)", () => {
      root.classList.add("motion-ready", "reduced-motion")
      return () => root.classList.remove("motion-ready", "reduced-motion")
    })

    return () => {
      document.removeEventListener("click", onLink)
      mm.revert()
    }
  }, [])

  return null
}
