"use client"

import * as React from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

/**
 * One figure in the numbers row: a big number with its label underneath.
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

export function StatFigure({ n, suffix, label }: { n: number; suffix: string; label: string }) {
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
    const cap = el.querySelector("[data-label]")
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

  return (
    <div ref={root} className="flex flex-col items-center text-center">
      <div data-fig className="font-display flex w-fit items-start text-[clamp(4.2rem,21vw,8rem)] lg:text-[clamp(5rem,9.4vw,11.5rem)] leading-none tracking-[-0.04em] text-white italic lg:text-[oklch(0.25_0.12_283)]">
        <span role="img" aria-label={`${n}${suffix}`} className="inline-flex">
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
          <span data-suffix aria-hidden className="mt-[0.1em] ml-[0.04em] inline-block text-[0.3em] leading-none not-italic text-[oklch(0.88_0.08_300)] lg:text-[oklch(0.5_0.17_285)]">
            {suffix}
          </span>
        )}
      </div>
      <p data-label className="mt-3 max-w-[11rem] text-[0.98rem] leading-snug text-white/75 lg:mt-6 lg:max-w-none lg:text-[clamp(1.05rem,1.2vw,1.2rem)] tracking-[0.005em] lg:text-muted-foreground">
        {label}
      </p>
    </div>
  )
}
