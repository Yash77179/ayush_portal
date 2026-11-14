import Link from "next/link"

import { ArrowRightIcon } from "@/components/icons"
import { PlateArt, type ArtKind } from "@/components/landing/plate-art"
import { OvalLink } from "@/components/landing/oval-link"
import { Roll } from "@/components/landing/roll-link"
import { CompanyPicture, StudentPicture, UniversityPicture } from "@/components/landing/role-pictures"

/**
 * "Who it's for": a pinned screen with a big title and its pitch at the top, and under it a row of wide cards (one
 * per side of the portal) that slides sideways as you scroll, one pixel across for each pixel down. The same on every
 * screen size: on desktop the cards lay the picture beside the words, on phones above them.
 * Motion and layout cloned from zzdp.nl's "Onze waarden" (see .reanimate/values); the content and art are ours.
 *
 * Each card's picture (role-pictures.tsx) is the side's soft wave plate with one big number on it. landing-motion
 * drives the slide and the progress line.
 * With reduced motion the row simply scrolls sideways under your finger.
 */

/* ── the cards ─────────────────────────────────────────────────────────────── */
type Side = {
  n: string
  title: string
  text: string
  /** a shorter line for phones */
  short: string
  cta: string
  href: string
  art: ArtKind
  hue: number
  Pic: () => React.ReactNode
  /** the vintage career sticker on its "Join as …" button (/public/stickers/career/) */
  sticker: string
  tilt: number
}

const SIDES: Side[] = [
  {
    n: "01",
    title: "Students",
    text: "Build a skill profile once and every listing shows how well you fit. Your resume is read for you, and each application keeps a live status, from applied to offer.",
    short: "One skill profile, a match score on every listing, and a live status on every application.",
    cta: "Join as a student",
    href: "/register?role=student",
    art: "waves",
    hue: 262,
    Pic: StudentPicture,
    sticker: "coffee-books",
    tilt: -8,
  },
  {
    n: "02",
    title: "Companies",
    text: "Post an opening in minutes and see candidates ranked by skill fit. Move people through your pipeline and see where every hire stands at a glance.",
    short: "Post in minutes, see candidates ranked by fit, and move them through your pipeline.",
    cta: "Join as a recruiter",
    href: "/register?role=company",
    art: "silk",
    hue: 300,
    Pic: CompanyPicture,
    sticker: "briefcase-badge",
    tilt: 6,
  },
  {
    n: "03",
    title: "Universities",
    text: "See how your students are doing: skills across a batch, applications in flight and placements as they land, with reports you can export.",
    short: "Skills across a batch, applications in flight, and placements as they land.",
    cta: "Join as a university",
    href: "/register?role=university",
    art: "spiro",
    hue: 200,
    Pic: UniversityPicture,
    sticker: "grad-cap",
    tilt: -5,
  },
]

function SideCard({ side }: { side: Side }) {
  const { Pic } = side
  return (
    // h-panel: its picture's layers drift relative to where the card is on screen (landing-motion)
    <article data-build="roles-card" className="h-panel flex h-full w-[76vw] max-w-[30rem] shrink-0 flex-col gap-3 border border-[oklch(0.2_0.05_280/0.12)] p-3 lg:w-[66vw] lg:max-w-none lg:flex-row lg:gap-[1.7vw] lg:p-[0.9vw]">
      <Pic />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-1.5 lg:px-0 lg:pt-[0.6vw]">
        <h3 className="flex items-baseline gap-3 text-[clamp(1.6rem,3.1vw,3rem)] leading-[0.95] tracking-[-0.01em] uppercase lg:gap-4">
          <span className="font-display text-[0.5em] text-[oklch(0.5_0.18_285)] italic">{side.n}</span>
          <span className="font-display italic">{side.title}</span>
        </h3>
        <p className="mt-1.5 text-[13px] leading-[1.4] text-[oklch(0.22_0.06_280/0.75)] sm:hidden">{side.short}</p>
        <p className="mt-[1.4vw] max-w-[24rem] text-[clamp(15px,1.15vw,17px)] leading-[1.5] text-[oklch(0.22_0.06_280/0.75)] max-sm:hidden">{side.text}</p>
        <Link href={side.href} className="group/side mt-auto flex items-center gap-3 self-start pt-2 outline-none lg:gap-4">
          {/* the sticker on a little round plate: it straightens and lifts when you point at it */}
          <span className="relative size-[3.4rem] shrink-0 sm:size-[4.4rem] transition-transform duration-300 group-hover/side:-translate-y-1 group-focus-visible/side:-translate-y-1 lg:size-[clamp(5.5rem,7.6vw,8rem)]">
            <span aria-hidden className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-full border border-[oklch(0.2_0.05_280/0.22)]" />
            <span className="absolute inset-0 overflow-hidden rounded-full border border-[oklch(0.2_0.05_280/0.85)]" style={{ background: `oklch(0.985 0.012 ${side.hue})` }}>
              <PlateArt kind={side.art} hue={side.hue} id={`join-${side.art}`} centered />
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element -- small, already-optimised sticker art */}
            <img
              src={`/stickers/career/${side.sticker}.webp`}
              alt=""
              draggable={false}
              decoding="async"
              className="absolute inset-[4%] size-[92%] object-contain drop-shadow-[0_6px_8px_oklch(0.2_0.08_285/0.35)] transition-[rotate,scale] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] rotate-(--tilt) group-hover/side:scale-[1.08] group-hover/side:rotate-0 group-focus-visible/side:rotate-0 group-active/side:scale-95"
              style={{ "--tilt": `${side.tilt}deg` } as React.CSSProperties}
            />
          </span>
          <span className="inline-flex items-center gap-2 text-[11.5px] font-semibold tracking-[0.1em] whitespace-nowrap uppercase sm:text-[12.5px] sm:tracking-[0.16em] group-focus-visible/side:underline lg:text-[13px]">
            <Roll>{side.cta}</Roll>
            <ArrowRightIcon className="size-4 transition-transform duration-300 ease-(--ease-out) group-hover/side:translate-x-1" />
          </span>
        </Link>
      </div>
    </article>
  )
}

const ACCENT = "font-display italic text-[oklch(0.45_0.18_282)]"

/* ── the section ─────────────────────────────────────────────────────────── */
export function RolesScroll() {
  return (
    <section
      id="roles"
      data-hscroll
      // pulled up under the internships band (--under = its height), so it is already there when that band leaves.
      // Its height is set by landing-motion: the band leaving, the slide, and the hold while what follows rises over it
      className="relative [margin-top:calc(-1*var(--under,0px))] bg-[oklch(0.975_0.01_288)] text-[oklch(0.2_0.05_280)]"
    >
      {/* the pinned screen. The heading stays put; the row of cards under it slides sideways */}
      <div className="h-stick sticky top-0 flex h-svh flex-col gap-5 overflow-hidden pt-[max(9svh,6.75rem)] pb-[4svh] lg:block lg:p-0">
        {/* the room: two soft pools of violet light */}
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_50%_at_92%_8%,oklch(0.9_0.07_300/0.7),transparent_70%),radial-gradient(55%_45%_at_0%_100%,oklch(0.9_0.06_250/0.6),transparent_70%)]" />

        {/* heading: the title, then (beside it on desktop) its pitch and the way in */}
        <div className="relative mx-5 grid shrink-0 grid-cols-1 gap-4 sm:mx-10 lg:absolute lg:mx-0 lg:inset-x-[3.1vw] lg:top-[13svh] lg:grid-cols-2 lg:gap-[3.1vw]">
          <h2 data-mask data-build="roles-title" className="font-display text-[clamp(3.1rem,14vw,5.2rem)] leading-[0.88] tracking-[-0.015em] uppercase italic lg:text-[clamp(3.4rem,7.4vw,7.6rem)]">
            <span className="mask-line pr-[0.12em]"><span>One portal,</span></span>
            <span className="mask-line pr-[0.12em]"><span>three <span className="text-[oklch(0.45_0.18_282)]">sides</span></span></span>
          </h2>
          <div className="lg:pt-[0.6vw]">
            <p data-build="roles-pitch" className="max-w-[40rem] text-[16.5px] leading-[1.42] text-[oklch(0.22_0.06_280/0.85)] sm:text-[18px] lg:text-[clamp(18px,1.65vw,24px)] lg:leading-[1.35]">
              <span className={ACCENT}>Students</span> looking for a first step, <span className={ACCENT}>companies</span> looking for people who fit,
              and <span className={ACCENT}>universities</span> keeping track of both.{" "}
              Everyone works in the same place, on the same live record, from first application to placement.
            </p>
            <div data-build="roles-cta" className="mt-[2.4svh] -ml-3 hidden lg:block">
              <OvalLink href="/register">Create free account</OvalLink>
            </div>
          </div>
        </div>

        {/* the label over the row, a line that fills as the row goes by, and which card you are on */}
        <div data-build="roles-label" className="relative mx-5 flex shrink-0 items-center gap-4 sm:mx-10 lg:absolute lg:mx-0 text-[12px] font-semibold tracking-[0.22em] text-[oklch(0.22_0.06_280/0.6)] uppercase sm:inset-x-10 lg:inset-x-[3.1vw] lg:top-[44.5svh] lg:text-[13px]">
          <span className="whitespace-nowrap">Who it&rsquo;s for</span>
          <span aria-hidden className="relative h-[2px] flex-1 rounded-full bg-[oklch(0.2_0.05_280/0.12)]">
            <span data-hprog className="absolute inset-0 origin-left scale-x-0 bg-[oklch(0.45_0.18_282)]" />
          </span>
          <span aria-hidden className="font-display text-[1.25em] tracking-[0.04em] whitespace-nowrap normal-case italic">
            <span data-hcount className="text-[oklch(0.2_0.05_280)]">01</span> / 0{SIDES.length}
          </span>
        </div>

        {/* the row: landing-motion slides the track across (with reduced motion you scroll it sideways yourself) */}
        <div className="relative min-h-0 flex-1 motion-reduce:overflow-x-auto lg:absolute lg:inset-x-0 lg:top-[49.7svh] lg:h-[40.3svh]">
          <div className="h-track flex h-full w-max gap-4 px-5 will-change-transform sm:px-10 lg:gap-[4vw] lg:px-[3.1vw]">
            {SIDES.map((s) => (
              <SideCard key={s.title} side={s} />
            ))}
          </div>
        </div>

        {/* the scene dims to a dusky blue-grey as the fog comes up over it (FogEdge drives its opacity directly) */}
        <div aria-hidden data-fog-dim className="pointer-events-none absolute inset-0 z-30 hidden bg-[oklch(0.27_0.05_265)] will-change-[opacity] lg:block" style={{ opacity: 0 }} />
      </div>
    </section>
  )
}
