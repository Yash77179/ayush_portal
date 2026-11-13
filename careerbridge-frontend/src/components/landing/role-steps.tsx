"use client"

import * as React from "react"

import { PlateArt, type ArtKind } from "@/components/landing/plate-art"

/**
 * "How it works" for one role, inside the horizontal journey: four step cards.
 *
 * Each card is a soft tinted plate in the role's colour with its own line figure, a big italic numeral, the step's
 * name and one line on what happens. The cards stand in a row at gently staggered heights; as each one comes in from
 * the right it rises a little and fades into place, and it settles back if you scroll the other way. Calm on
 * purpose: the journey's road and wheel do the travelling. Desktop only, like the journey.
 */

export type Step = { title: string; em: string; text: string }

const ARTS: ArtKind[] = ["waves", "ripples", "contours", "spiro"]
const OFFSET = ["0%", "7%", "2%", "9%"] // a gentle stagger, so the row isn't a flat strip

export function RoleSteps({ role, hue, steps }: { role: string; hue: number; steps: Step[] }) {
  const cards = React.useRef<(HTMLDivElement | null)[]>([])
  const host = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const el = host.current
    if (!el) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const ease = (t: number) => 1 - Math.pow(1 - t, 3)
    const last = cards.current.map(() => -1)
    let raf = 0
    const frame = () => {
      raf = requestAnimationFrame(frame)
      const vw = window.innerWidth
      cards.current.forEach((c, i) => {
        if (!c) return
        const r = c.getBoundingClientRect()
        // 0 as the card's left edge reaches the right side of the screen, 1 once it is 35% of the way in
        const p = reduce ? 1 : Math.max(0, Math.min(1, (vw - r.left) / (vw * 0.35)))
        if (Math.abs(p - last[i]) < 0.002) return
        last[i] = p
        const e = ease(p)
        c.style.opacity = (0.15 + 0.85 * e).toFixed(3)
        c.style.transform = `translate3d(0, ${Math.round((1 - e) * 56)}px, 0)`
      })
    }
    const io = new IntersectionObserver(([en]) => {
      cancelAnimationFrame(raf)
      if (en.isIntersecting) raf = requestAnimationFrame(frame)
    })
    io.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [])

  const ink = `oklch(0.48 0.16 ${hue})`
  return (
    <div ref={host} className="h-panel relative lg:h-full lg:w-[118vw]">
      {/* the scene's heading */}
      <div className="absolute top-[11%] left-[5vw] z-10">
        <p className="text-[13px] font-semibold tracking-[0.22em] text-[oklch(0.22_0.06_280/0.55)] uppercase">How it works</p>
        <p className="font-display mt-2 text-[clamp(2rem,3.4vw,3.2rem)] leading-none italic">
          for <span style={{ color: ink }}>{role}</span>
        </p>
      </div>

      {/* the four cards */}
      <div className="absolute top-[25%] bottom-[22%] left-[5vw] right-[5vw] flex items-start gap-[1.6vw]">
        {steps.map((s, i) => (
          <div key={s.title} className="h-[86%] flex-1" style={{ marginTop: OFFSET[i] }}>
            <div
              ref={(n) => {
                cards.current[i] = n
              }}
              className="relative flex h-full flex-col overflow-hidden rounded-[28px] p-6 text-[oklch(0.2_0.05_280)] shadow-[0_0_0_1px_oklch(0.25_0.06_285/0.06),0_18px_40px_-28px_oklch(0.3_0.1_285/0.35)]"
              style={{ background: `linear-gradient(165deg, oklch(0.99 0.012 ${hue}), oklch(0.93 0.05 ${hue + i * 8}))`, opacity: 0.15 }}
            >
              <div className="pointer-events-none absolute inset-0 opacity-70">
                <PlateArt kind={ARTS[i % ARTS.length]} hue={hue + i * 8} id={`rs-${role}-${i}`} />
              </div>

              <div className="relative flex items-center justify-between">
                <span className="font-display text-[clamp(3.2rem,5vw,5rem)] leading-[0.85] italic" style={{ color: ink }}>
                  0{i + 1}
                </span>
                <span className="rounded-full bg-white/80 px-3 py-1 text-[11.5px] font-medium tracking-[0.12em] uppercase ring-1 ring-black/5 backdrop-blur-sm">
                  Step {i + 1} of {steps.length}
                </span>
              </div>

              <div className="relative mt-auto">
                <p className="text-[clamp(1.35rem,1.8vw,1.8rem)] leading-[1.08] font-medium tracking-[-0.025em]">
                  {s.title}{" "}
                  <em className="font-display text-[1.12em] font-normal" style={{ color: ink }}>
                    {s.em}
                  </em>
                </p>
                <p className="mt-2.5 text-[14px] leading-snug text-[oklch(0.22_0.06_280/0.65)]">{s.text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
