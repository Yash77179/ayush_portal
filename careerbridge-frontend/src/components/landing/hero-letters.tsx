"use client"

import * as React from "react"
import { Anton } from "next/font/google"

import { getLenis } from "@/lib/lenis-instance"

const anton = Anton({ subsets: ["latin"], weight: "400" })

/**
 * The hero's background: two rows of giant letters flowing past each other (after jjettas.com's bg marquee).
 *
 * The top row is filled with a soft starlight-to-violet gradient and flows left; the bottom row is an outline and flows
 * right. They drift on their own (one word every ~22 s) and pick up speed while you scroll, then ease back, so the
 * letters feel carried by the page. Both rows fit the screen (nothing cut by its edges), fade out at the sides, and
 * only run while the hero is on screen. With reduced motion they hold still.
 */
const ROWS = [
  { word: "CAREER", dir: -1, top: "4%", style: "fill" as const },
  { word: "BRIDGE", dir: 1, top: "51%", style: "outline" as const },
]

export function HeroLetters() {
  const root = React.useRef<HTMLDivElement>(null)
  const tracks = React.useRef<(HTMLDivElement | null)[]>([])

  React.useEffect(() => {
    const el = root.current
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const pos = ROWS.map(() => 0)
    let boost = 0
    let raf = 0
    let last = performance.now()
    let live = false

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      // scroll speed (px/frame from Lenis) adds to the drift, and eases back when you stop
      const v = Math.abs(getLenis()?.velocity ?? 0)
      boost += (Math.min(v * 0.9, 14) - boost) * Math.min(1, dt * 4)
      tracks.current.forEach((t, i) => {
        if (!t) return
        const half = t.scrollWidth / 2 // the word is repeated, so after half the track it loops
        const speed = (half / 2) / 22 // one word every 22 s
        pos[i] = (pos[i] + ROWS[i].dir * speed * dt * (1 + boost)) % half
        const x = ROWS[i].dir < 0 ? pos[i] : pos[i] - half
        t.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`
      })
    }
    const io = new IntersectionObserver(([e]) => {
      const now = e.isIntersecting
      if (now === live) return
      live = now
      cancelAnimationFrame(raf)
      if (live) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    })
    io.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [])

  return (
    <div
      ref={root}
      aria-hidden
      className={`${anton.className} pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none [mask-image:linear-gradient(90deg,transparent,#000_14%,#000_86%,transparent)]`}
    >
      {ROWS.map((r, ri) => (
        <div key={r.word} className="absolute inset-x-0 flex h-[45%] items-center" style={{ top: r.top }}>
          <div
            ref={(n) => {
              tracks.current[ri] = n
            }}
            className="flex w-max will-change-transform"
            style={{ transform: r.dir > 0 ? "translate3d(-50%,0,0)" : undefined }}
          >
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={
                  r.style === "fill"
                    ? "block bg-[linear-gradient(180deg,oklch(1_0_0/0.13),oklch(0.75_0.12_295/0.08)_60%,oklch(0.6_0.16_290/0.03))] bg-clip-text pr-[0.14em] text-[min(54svh,44vw)] leading-[0.82] text-transparent"
                    : "block pr-[0.14em] text-[min(54svh,44vw)] leading-[0.82] text-transparent [-webkit-text-stroke:1.5px_oklch(0.85_0.08_295/0.22)]"
                }
              >
                {r.word}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
