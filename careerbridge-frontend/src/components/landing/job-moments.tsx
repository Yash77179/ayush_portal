"use client"

import * as React from "react"
import Link from "next/link"
import { Anton } from "next/font/google"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

import { MODE_LABEL } from "@/lib/internship-data"
import { ArrowRightIcon } from "@/components/icons"
import { PlateArt } from "@/components/landing/plate-art"
import { RollLink } from "@/components/landing/roll-link"
import { TickProgress } from "@/components/kit"
import { LOOKS, SHOWCASE, short, type ShowcaseJob } from "@/components/landing/latest-jobs"

const anton = Anton({ subsets: ["latin"], weight: "400" })

/**
 * "Open roles": the motion cloned from jjettas.com's Signature Moments (see .reanimate/jj/spec.md), in our look.
 *
 * A field with a slanted top edge (straightening as it arrives) slides up over the statement above it. Once it covers the screen it pins: a giant
 * faint title sits along the top, field numbers along the bottom, and a row of internship cards, alternately high and
 * low, travels sideways as you scroll. Each card turns in from edge-on as it arrives from the right, and floats gently.
 * 70svh of scroll per card (about half the reference's pace, so the row keeps moving). At the end the field slides off like a sheet, uncovering the next
 * section waiting underneath. Light and dark versions follow the site theme. With reduced motion the
 * cards sit in a plain row you can scroll sideways.
 */

const JOBS = SHOWCASE.slice(0, 7)
const FLOAT = [6.4, 7.5, 8.6] // seconds: the reference's three float periods

function RoleCard({ j, i }: { j: ShowcaseJob; i: number }) {
  const look = LOOKS[i % LOOKS.length]
  const left = j.days_left
  const urgent = left > 0 && left <= 7
  return (
    <Link
      href="/internships"
      className="group/r relative block w-[clamp(270px,22vw,330px)] rounded-[30px] outline-none [--rc:oklch(0.62_0.17_var(--h))]"
      style={{ "--h": look.hue } as React.CSSProperties}
    >

      <div className="relative overflow-hidden rounded-[30px] bg-white p-2 text-[oklch(0.2_0.05_280)] shadow-[0_0_0_1px_oklch(0.25_0.06_285/0.07),0_12px_28px_-18px_oklch(0.3_0.1_285/0.28)] transition-transform duration-500 ease-(--ease-out) group-hover/r:-translate-y-1.5 group-focus-visible/r:ring-2 group-focus-visible/r:ring-(--rc) dark:bg-[oklch(0.19_0.03_285)] dark:text-white dark:shadow-[0_0_0_1px_oklch(1_0_0/0.07),0_14px_30px_-18px_rgb(0_0_0/0.6)]">
        {/* the plate: the card's colour, its line figure, the logo, the mode and the pay */}
        <div
          className="relative aspect-[16/12] overflow-hidden rounded-[23px] p-4 [--pa:oklch(0.99_0.012_var(--h))] [--pb:oklch(0.86_0.09_var(--h))] dark:[--pa:oklch(0.4_0.13_var(--h))] dark:[--pb:oklch(0.24_0.07_var(--h))]"
          style={{ background: "radial-gradient(120% 90% at 85% 0%, var(--pa), var(--pb))" }}
        >
          <div className="absolute inset-0 transition-transform duration-[1.2s] ease-(--ease-out) group-hover/r:scale-110 dark:opacity-70 dark:mix-blend-screen">
            <PlateArt kind={look.art} hue={look.hue} id={`or-${i}`} />
          </div>
          {/* a sheen that crosses the plate on hover */}
          <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(105deg,transparent_35%,oklch(1_0_0/0.45)_50%,transparent_65%)] transition-transform duration-[1.1s] ease-(--ease-out) group-hover/r:translate-x-full" />

          <div className="relative flex items-center justify-between">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-white shadow-[0_8px_18px_-8px_oklch(0.2_0.08_285/0.5)] ring-1 ring-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/logos/${j.logo}.svg`} alt={`${j.company} logo`} className="size-[56%] object-contain" loading="lazy" />
            </span>
            <span className="rounded-full bg-white/70 px-3 py-1.5 text-[12px] font-medium ring-1 ring-black/5 backdrop-blur-md dark:bg-black/30 dark:text-white/90 dark:ring-white/10">
              {MODE_LABEL[j.work_mode] ?? j.work_mode}
            </span>
          </div>

          <div className="absolute bottom-3.5 left-4">
            <p className="text-[11px] font-medium tracking-[0.18em] uppercase opacity-60">Stipend</p>
            <p className="font-display mt-0.5 text-[3.3rem] leading-[0.9] tracking-[-0.03em] italic [text-shadow:0_0_26px_oklch(1_0_0/0.9)] dark:[text-shadow:0_2px_22px_rgb(0_0_0/0.45)]">
              <span className="mr-0.5 align-top text-[1.5rem] not-italic">₹</span>
              {short(j.stipend)}
              <span className="ml-1 text-[0.95rem] tracking-normal not-italic opacity-60">/mo</span>
            </p>
          </div>
        </div>

        {/* the role */}
        <div className="px-3 pt-4">
          <p className="flex items-center gap-2 text-[12px] font-medium tracking-[0.14em] uppercase opacity-55">
            {j.company}
            <span aria-hidden className="size-1 rounded-full bg-current" />
            {j.duration_months} months
          </p>
          <h3 className="mt-1.5 text-[19.5px] leading-[1.2] font-medium tracking-[-0.025em] text-balance">{j.title}</h3>
          <p className="mt-1 text-[14px] opacity-60">{j.location}</p>
        </div>

        {/* days left: the same tick bar as the internships page (30 days = full), coral when a week or less is left */}
        <div className="px-3 pt-4">
          <TickProgress
            value={Math.max(0, Math.min(100, (left / 30) * 100))}
            color={urgent ? "oklch(0.72 0.09 28)" : "color-mix(in oklab, currentColor 38%, transparent)"}
            ticks={24}
            className="h-5"
          />
        </div>

        <div className="flex items-center justify-between px-3 pt-2 pb-3">
          <p className={`text-[13.5px] ${urgent ? "text-[oklch(0.58_0.1_28)] dark:text-[oklch(0.8_0.09_30)]" : "opacity-55"}`}>
            {left > 0 ? `${left} day${left === 1 ? "" : "s"} left to apply` : "Deadline passed"}
          </p>
          <span className="flex size-10 items-center justify-center rounded-full bg-[oklch(0.2_0.05_280)] text-white transition-[transform,background-color] duration-500 ease-(--ease-out) group-hover/r:-rotate-45 group-hover/r:bg-(--rc) dark:bg-white dark:text-[oklch(0.2_0.04_285)] dark:group-hover/r:bg-(--rc) dark:group-hover/r:text-white">
            <ArrowRightIcon className="size-[18px]" />
          </span>
        </div>
      </div>
    </Link>
  )
}

export function JobMoments() {
  const root = React.useRef<HTMLElement>(null)

  React.useEffect(() => {
    const section = root.current
    if (!section) return
    gsap.registerPlugin(ScrollTrigger)
    const mm = gsap.matchMedia()
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(section)
      const track = q("[data-track]")[0] as HTMLElement
      const pane = q("[data-pane]")[0] as HTMLElement
      // the first card is already coming in as the field covers the screen; the run ends with the last card left of centre
      const travel = () => track.scrollWidth - pane.offsetWidth * 0.25
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: section, start: "top top", end: "bottom bottom", scrub: 0.6, invalidateOnRefresh: true },
      })
      // (whole pixels only: text on a layer at a fractional offset is resampled, and looks soft)
      tl.fromTo(track, { x: () => pane.offsetWidth * 0.5 }, { x: () => pane.offsetWidth * 0.5 - travel(), duration: 1, modifiers: { x: (x: string) => `${Math.round(parseFloat(x))}px` } }, 0)

      // the field comes up with a slanted top edge (lower on the left), which straightens as it reaches the top
      const slant = ScrollTrigger.create({
        trigger: section,
        start: "top bottom",
        end: "top top",
        onUpdate: ({ progress }) => pane.style.setProperty("--slant", `${((1 - progress) * window.innerHeight * 0.24).toFixed(1)}px`),
        onLeave: () => pane.style.setProperty("--slant", "0px"),
      })
      // ...and it leaves with a slanted bottom edge, tilted the other way (higher on the left), which tips quickly as
      // it starts to slide off and holds while the next section is uncovered
      const slantOut = ScrollTrigger.create({
        trigger: section,
        start: "bottom bottom",
        end: "bottom top",
        onUpdate: ({ progress }) =>
          pane.style.setProperty("--slant-out", `${(Math.min(1, progress / 0.5) * window.innerHeight * 0.1).toFixed(1)}px`),
        onLeaveBack: () => pane.style.setProperty("--slant-out", "0px"),
      })

      // each card swings in from the right in 3D (turned away, tipped, low and back in depth) and settles flat by the
      // time it is a third of the way in; as it leaves on the left it leans back a little and recedes
      const cards = q("[data-card]") as HTMLElement[]
      const turns = cards.flatMap((card, i) => {
        const tip = i % 2 ? -1 : 1
        return [
          gsap.fromTo(
            card,
            { rotateY: -62, rotateZ: 7 * tip, y: 70, scale: 0.82, opacity: 0, transformPerspective: 1100 },
            { rotateY: 0, rotateZ: 0, y: 0, scale: 1, opacity: 1, ease: "power3.out", immediateRender: true, scrollTrigger: { trigger: card, containerAnimation: tl, start: "left 108%", end: "left 62%", scrub: true } }
          ),
          gsap.fromTo(
            card.firstElementChild,
            { rotateY: 0, scale: 1, opacity: 1, transformPerspective: 1100 },
            { rotateY: 24, scale: 0.92, opacity: 0.55, ease: "power1.in", scrollTrigger: { trigger: card, containerAnimation: tl, start: "right 30%", end: "right -5%", scrub: true } }
          ),
        ]
      })

      // the row leans into the scroll (skews with its speed) and straightens when you stop
      const lean = gsap.quickTo(track, "skewX", { duration: 0.6, ease: "power3.out" })
      const leanTrigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => lean(gsap.utils.clamp(-6, 6, self.getVelocity() / -320)),
        onLeave: () => lean(0),
        onLeaveBack: () => lean(0),
      })

      // on hover each card tilts toward the pointer
      const tilts = cards.map((card) => {
        const face = card.querySelector<HTMLElement>("[data-face]")
        if (!face) return () => {}
        const rx = gsap.quickTo(face, "rotateX", { duration: 0.5, ease: "power3.out" })
        const ry = gsap.quickTo(face, "rotateY", { duration: 0.5, ease: "power3.out" })
        gsap.set(face, { transformPerspective: 900 })
        const move = (e: PointerEvent) => {
          if (e.pointerType !== "mouse") return
          const r = face.getBoundingClientRect()
          rx(((e.clientY - r.top) / r.height - 0.5) * -10)
          ry(((e.clientX - r.left) / r.width - 0.5) * 12)
        }
        const leave = () => (rx(0), ry(0))
        face.addEventListener("pointermove", move)
        face.addEventListener("pointerleave", leave)
        return () => {
          face.removeEventListener("pointermove", move)
          face.removeEventListener("pointerleave", leave)
        }
      })
      return () => {
        leanTrigger.kill()
        tilts.forEach((off) => off())
        slant.kill()
        slantOut.kill()
        pane.style.removeProperty("--slant")
        pane.style.removeProperty("--slant-out")
        turns.forEach((t) => {
          t.scrollTrigger?.kill()
          t.kill()
        })
      }
    })
    return () => mm.revert()
  }, [])

  const n = JOBS.length
  return (
    <section
      id="internships"
      ref={root}
      aria-labelledby="open-roles"
      className="relative isolate z-10 -mt-[100svh] text-[oklch(0.22_0.05_280)] motion-safe:h-(--h) dark:text-white"
      style={{ "--h": `calc(${n} * 70svh)` } as React.CSSProperties}
    >

      {/* data-leave: when the cards are done this screen slides off like a sheet, uncovering the next section, which
          waits underneath it (pulled up by --under, see LandingMotion / RolesScroll) */}
      <div
        data-pane
        data-leave
        className="relative h-svh overflow-hidden bg-[radial-gradient(55%_50%_at_10%_90%,oklch(0.93_0.04_330/0.5),transparent_70%),radial-gradient(50%_45%_at_92%_75%,oklch(0.93_0.04_240/0.5),transparent_70%),radial-gradient(80%_60%_at_50%_0%,oklch(0.92_0.05_292/0.55),transparent_75%),linear-gradient(180deg,oklch(0.945_0.026_292),oklch(0.955_0.02_294)_50%,oklch(0.935_0.03_290))] motion-safe:sticky motion-safe:top-0 motion-safe:[clip-path:polygon(0_var(--slant,0px),100%_0,100%_100%,0_calc(100%-var(--slant-out,0px)))] dark:bg-[linear-gradient(180deg,#1b1330,#110c20_45%,#0b0815)]"
      >
        {/* the field: faint vertical lines, fading toward the bottom */}
        <div aria-hidden className="absolute inset-0 [mask-image:linear-gradient(#000,transparent_85%)] [background-image:linear-gradient(90deg,oklch(0.35_0.12_290/0.05)_1px,transparent_1px)] [background-size:calc(100%/6)_100%] dark:[background-image:linear-gradient(90deg,rgb(255_255_255/0.045)_1px,transparent_1px)]" />

        {/* the giant title, fading down into the field */}
        <h2
          id="open-roles"
          className={`${anton.className} pointer-events-none absolute inset-x-0 top-[1.5svh] origin-top scale-y-[1.3] bg-clip-text text-center text-[clamp(4rem,23.5vw,24rem)] leading-[0.84] tracking-[-0.03em] whitespace-nowrap text-transparent uppercase [background-image:linear-gradient(180deg,oklch(0.55_0.2_290/0.36),oklch(0.62_0.17_298/0.14)_55%,transparent_95%)] dark:[background-image:linear-gradient(180deg,oklch(0.5_0.2_290/0.9),oklch(0.4_0.16_288/0.45)_50%,transparent_95%)]`}
        >
          Open roles
        </h2>

        {/* the moving track: cards high and low */}
        <div data-track className="absolute inset-y-0 left-0 flex w-max motion-reduce:relative motion-reduce:w-full motion-reduce:overflow-x-auto">
          {JOBS.map((j, i) => (
            <div key={j.id} className="relative w-[clamp(320px,34vw,520px)] shrink-0">
              <div data-card className={`absolute left-1/2 -translate-x-1/2 ${i % 2 ? "top-[39svh]" : "top-[23svh]"}`}>
                <div>
                  <div className="animate-[cb-card-float_var(--d)_ease-in-out_infinite]" style={{ "--d": `${FLOAT[i % 3]}s`, animationDelay: `${-i * 1.27}s` } as React.CSSProperties}>
                    <div data-face>
                      <RoleCard j={j} i={i} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* the way to every role */}
        <div className="absolute right-[clamp(1.5rem,4vw,4rem)] bottom-[4svh] z-10 max-sm:hidden">
          <RollLink href="/internships">Browse all internships</RollLink>
        </div>
      </div>
    </section>
  )
}
