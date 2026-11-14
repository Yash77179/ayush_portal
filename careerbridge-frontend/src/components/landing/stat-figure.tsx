"use client"

import * as React from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

/**
 * One cell in the numbers row: a big number, a small word tucked at its top right, and two lines under it.
 * The cell itself (.stat-cell, globals.css) floods with violet and grain when you point at it; the text turns white.
 *
 * On desktop the numbers section is pinned and the count is tied to your scroll (smoothed, like the
 * rest of the page): each digit is a reel that glides through one turn of 0–9 and settles on its
 * number, left to right, while you scroll through the held screen. Nothing can be skipped past, and it
 * runs backwards when you scroll back. On smaller screens, where nothing is pinned, all four play once,
 * together, as soon as the row is on screen, and always run to the end. With reduced motion it just
 * shows the number.
 */

const ROWS = 20 // one full turn of 0–9, then the digit it lands on
const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

export function StatFigure({ n, suffix, unit, label }: { n: number; suffix: string; unit: string; label: string[] }) {
  const root = React.useRef<HTMLDivElement>(null)
  const digits = String(n).split("").map(Number)

  useIsoLayoutEffect(() => {
    const el = root.current
    if (!el) return
    gsap.registerPlugin(ScrollTrigger)
    const reels = Array.from(el.querySelectorAll<HTMLElement>("[data-reel]"))
    const toY = (d: number) => -(((10 + d) / ROWS) * 100)
    const fig = el.querySelector("[data-fig]")
    const sfx = el.querySelector("[data-suffix]")
    const cap = el.querySelectorAll("[data-label], [data-unit]")
    const mm = gsap.matchMedia()

    // reduced motion: the finished number, no movement
    mm.add("(prefers-reduced-motion: reduce)", () => {
      reels.forEach((r, i) => gsap.set(r, { yPercent: toY(digits[i]) }))
      gsap.set([fig, sfx, cap], { opacity: 1 })
    })

    // desktop: pinned section, count tied to scroll
    mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
      const sheet = el.closest<HTMLElement>("[data-curl]")
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: sheet ?? el, start: "top 38%", end: "bottom bottom", scrub: 0.9 },
      })
      tl.fromTo(fig, { opacity: 0, y: 28, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.16, ease: "power2.out" }, 0)
      reels.forEach((r, i) => {
        tl.fromTo(r, { yPercent: 0 }, { yPercent: toY(digits[i]), duration: 0.55, ease: "power2.inOut" }, 0.06 + i * 0.05)
      })
      if (sfx) tl.fromTo(sfx, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "power2.out" }, 0.52)
      tl.fromTo(cap, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.14, ease: "power2.out" }, 0.14)
      tl.to({}, { duration: 0.001 }, 1) // the finished number is held for the rest of the pin
    })

    // smaller screens: nothing is pinned, so play once when it arrives
    mm.add("(max-width: 1023px) and (prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({ paused: true })
      tl.fromTo(fig, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, 0)
      reels.forEach((r, i) => {
        tl.fromTo(r, { yPercent: 0 }, { yPercent: toY(digits[i]), duration: 1.9, ease: "power3.inOut" }, 0.05 + i * 0.1)
      })
      if (sfx) tl.fromTo(sfx, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: "power2.out" }, 1)
      tl.fromTo(cap, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, 0.5)
      // all four start together once the grid is on screen, then always play through to the end (no scrubbing,
      // no reset when you scroll back a little)
      ScrollTrigger.create({ trigger: el.closest("ul") ?? el, start: "top 75%", once: true, onEnter: () => tl.play(0) })
    })

    return () => mm.revert()
  }, [n])

  // phones have no hover: a tap lights this cell (and puts out the one lit before)
  const light = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return // (a mouse has hover)
    const cell = root.current?.closest<HTMLElement>(".stat-cell")
    if (!cell) return
    const was = cell.hasAttribute("data-on")
    cell.parentElement?.querySelectorAll("[data-on]").forEach((c) => c.removeAttribute("data-on"))
    if (!was) cell.setAttribute("data-on", "")
  }

  const INK = "text-[oklch(0.25_0.12_283)] group-hover/stat:text-white group-data-[on]/stat:text-white"
  return (
    // phones: a row (the number, then its word and two lines beside it); desktop: a tall cell, the word tucked at the
    // number's top right and the lines underneath
    <div
      ref={root}
      onPointerUp={light}
      className="@container relative flex h-full cursor-default items-center gap-5 px-5 py-6 text-left select-none sm:px-8 lg:flex-col lg:items-start lg:gap-0 lg:px-[1.6vw] lg:pt-[9svh] lg:pb-[2.4svh]"
    >
      {/* the fill: violet, with grain laid over it */}
      <span aria-hidden className="stat-fill pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300" />
      <div className="relative w-[44%] shrink-0 lg:w-auto">
        <div data-fig className={`font-display flex w-fit items-start text-[clamp(3.4rem,17vw,5.5rem)] leading-none tracking-[-0.04em] italic transition-colors duration-300 lg:text-[min(clamp(4rem,9.4vw,11.5rem),38cqw)] ${INK}`}>
          <span role="img" aria-label={`${n}${suffix} ${unit}`} className="inline-flex">
            {digits.map((_, i) => (
              <span key={i} aria-hidden className="relative -mx-[0.045em] inline-block h-[1.04em] overflow-hidden px-[0.04em] text-center">
                <span data-reel className="flex flex-col will-change-transform">
                  {Array.from({ length: ROWS }, (_, k) => (
                    <span key={k} className="block h-[1.04em] leading-[1.04]">
                      {k % 10}
                    </span>
                  ))}
                </span>
              </span>
            ))}
          </span>
          {suffix && (
            <span data-suffix aria-hidden className="mt-[0.1em] ml-[0.04em] inline-block text-[0.3em] leading-none not-italic text-[oklch(0.5_0.17_285)] transition-colors duration-300 group-hover/stat:text-white/90 group-data-[on]/stat:text-white/90">
              {suffix}
            </span>
          )}
        </div>
        <p data-unit aria-hidden className="absolute top-[2.4cqw] left-full ml-[5.4cqw] hidden text-[clamp(0.8rem,5.2cqw,1.1rem)] font-medium whitespace-nowrap text-[oklch(0.22_0.06_280/0.85)] transition-colors duration-300 group-hover/stat:text-white group-data-[on]/stat:text-white lg:block">
          {unit}
        </p>
      </div>
      <div className="relative min-w-0">
        <p data-unit className="font-display text-[1.35rem] leading-tight italic text-[oklch(0.22_0.06_280)] transition-colors duration-300 group-data-[on]/stat:text-white lg:hidden">{unit}</p>
        <p data-label className="mt-1 text-[0.9rem] leading-snug text-[oklch(0.22_0.06_280/0.65)] transition-colors duration-300 group-hover/stat:text-white/85 group-data-[on]/stat:text-white/85 lg:mt-[3svh] lg:text-[clamp(0.98rem,1.1vw,1.1rem)] lg:leading-[1.45]">
          {label.map((l) => (
            <span key={l} className="block">
              {l}
            </span>
          ))}
        </p>
      </div>
    </div>
  )
}
