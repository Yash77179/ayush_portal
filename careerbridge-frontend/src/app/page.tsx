import Link from "next/link"
import { cn } from "cn"

import { ArrowRightIcon } from "@/components/icons"
import { FogEdge } from "@/components/landing/fog-edge"
import { HeroLetters } from "@/components/landing/hero-letters"
import { IntroWindow } from "@/components/landing/intro-window"
import { JobMoments } from "@/components/landing/job-moments"
import { NightSky } from "@/components/landing/night-sky"
import { LandingMotion }from "@/components/landing/landing-motion"
import { MeetBridge } from "@/components/landing/meet-bridge"
import { Roll, RollLink } from "@/components/landing/roll-link"
import { RolesScroll } from "@/components/landing/roles-scroll"
import { SiteFooter } from "@/components/landing/site-footer"
import { StatFigure } from "@/components/landing/stat-figure"
import { StoryStage } from "@/components/landing/story-stage"
import { StickyNav } from "@/components/landing/sticky-nav"
import { WarpGrid } from "@/components/landing/warp-grid"

const COMPANIES = [
  { name: "Zoho", logo: "zoho" },
  { name: "Razorpay", logo: "razorpay" },
  { name: "Postman", logo: "postman" },
  { name: "Swiggy", logo: "swiggy" },
  { name: "Infosys", logo: "infosys" },
  { name: "Paytm", logo: "paytm" },
  { name: "Atlassian", logo: "atlassian" },
  { name: "Zomato", logo: "zomato" },
  { name: "TCS", logo: "tcs" },
  { name: "Figma", logo: "figma" },
  { name: "Wipro", logo: "wipro" },
  { name: "Notion", logo: "notion" },
  { name: "Stripe", logo: "stripe" },
  { name: "Google", logo: "google" },
]

const STATEMENT: { w: string; em?: boolean }[] = (
  "CareerBridge is where *students,* *universities* and *companies* finally meet. Skills are matched in the open, every application is tracked to its last step, and placements are *measured,* not guessed."
)
  .split(" ")
  .map((w) => (w.startsWith("*") ? { w: w.replace(/\*/g, ""), em: true } : { w }))

const STATS = [
  { n: 3, suffix: "", label: "role-based dashboards" },
  { n: 100, suffix: "%", label: "explainable matching" },
  { n: 90, suffix: "+", label: "skills recognised in a resume" },
  { n: 476, suffix: "", label: "universities ready to pick" },
]

export default function HomePage() {
  return (
    <div className="min-h-svh overflow-x-clip">
      <LandingMotion />
      <StickyNav />

      {/* the whole page: it lifts away at the end to uncover the footer behind it */}
      <div className="relative z-10 bg-background [overflow:clip]">

      {/* ───────────────────────── Intro: fly through the window of job-hunt chaos, up into the night (scroll-driven) ───────────────────────── */}
      <IntroWindow />

      {/* ───────────────────────── Hero: a field of violet micro-slats (React Bits), a centred line ───────────────────────── */}
      {/* the hero holds still (sticky) for a moment once it has risen into place, then scrolls on */}
      <div className="relative motion-safe:-mt-[100svh]">
      <section data-hero className="relative isolate flex min-h-svh flex-col items-center overflow-hidden bg-[#04060f] text-white motion-safe:sticky motion-safe:top-0">
        {/* the same night sky as the intro (held still on screen while the hero rises, see intro-window.tsx) */}
        <div data-hero-sky aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-svh will-change-transform">
          <NightSky />
        </div>
        {/* giant letters drifting past each other behind the title (see HeroLetters) */}
        <HeroLetters />

        {/* (the site nav sits on top of the hero: see StickyNav) */}
        <div aria-hidden className="h-[4.75rem] shrink-0" />

        {/* centre: the line */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pt-4 pb-24 text-center">
          <h1 className="font-display text-[clamp(3.6rem,10.5vw,9.5rem)] leading-[0.92] tracking-[-0.02em] uppercase italic">
            <span data-intro="line" className="mask-line pr-[0.18em] -mr-[0.18em]">
              <span>Find your</span>
            </span>
            <span data-intro="line" className="mask-line pr-[0.18em] -mr-[0.18em]">
              <span>first step</span>
            </span>
          </h1>
          <p data-intro="fade" className="font-display mt-9 max-w-2xl text-[clamp(0.95rem,1.35vw,1.2rem)] tracking-[0.04em] uppercase text-white/85">
            The internship &amp; placement portal for students, universities and companies.
          </p>
          <Link
            href="/internships"
            data-intro="fade"
            className="group/cta font-display relative mt-10 inline-flex h-14 items-center justify-center px-12 text-[1.15rem] tracking-[0.06em] uppercase outline-none"
          >
            <svg aria-hidden viewBox="0 0 320 56" preserveAspectRatio="none" className="absolute inset-0 size-full transition-transform duration-500 ease-(--ease-out) group-hover/cta:scale-[1.06]" fill="none" stroke="currentColor" strokeOpacity="0.7">
              <ellipse cx="160" cy="28" rx="158" ry="26" />
            </svg>
            <span className="relative">
              <Roll>Browse internships</Roll>
            </span>
          </Link>
        </div>

        {/* bottom: a small caption, and the way down */}
        <p className="font-display absolute bottom-16 left-10 hidden text-[0.8rem] tracking-[0.12em] uppercase text-white/65 sm:block">Students · Universities · Companies</p>
        <a href="#internships" aria-label="Scroll down" className="group/scroll absolute bottom-7 left-1/2 z-10 flex size-12 -translate-x-1/2 items-center justify-center rounded-full border border-current/40 transition-[background-color,transform] duration-300 hover:scale-110 hover:bg-current/10">
          <svg viewBox="0 0 24 24" className="size-5 transition-transform duration-300 group-hover/scroll:translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M6 13l6 6 6-6" />
          </svg>
        </a>
      </section>

      {/* a beat of scroll for the title to hold still before the page moves on */}
      <div aria-hidden className="h-[45svh] motion-reduce:hidden" />
      </div>

      {/* ───────────────────────── Marquee: real logos ───────────────────────── */}
      <section aria-label="Teams students apply to" className="marquee overflow-hidden pt-16 pb-6">
        <p className="mb-9 text-center text-[13px] font-medium tracking-[0.2em] text-muted-foreground uppercase">Teams students apply to</p>
        <div className="marquee-track flex items-center gap-24 whitespace-nowrap">
          {[...COMPANIES, ...COMPANIES].map((c, i) => (
            <span key={i} className="group/co flex cursor-default items-center gap-4 opacity-60 grayscale transition-[opacity,filter] duration-300 hover:opacity-100 hover:grayscale-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/logos/${c.logo}.svg`} alt="" width={44} height={44} className="h-11 w-11 object-contain transition-transform duration-300 group-hover/co:scale-110" draggable={false} />
              <span className="text-[1.9rem] font-medium tracking-[-0.03em]">{c.name}</span>
            </span>
          ))}
        </div>
      </section>

      {/* ───────────────────────── Statement ───────────────────────── */}
      <section data-curtain data-read-scope className="relative z-0 h-[280svh]">
      <div className="sticky top-0 isolate flex h-svh items-center overflow-hidden bg-background">
        <div aria-hidden className="absolute inset-0 -z-10 text-[oklch(0.4_0.14_280)]">
          <WarpGrid />
        </div>
        <div className="curtain-inner mx-auto w-full max-w-[1180px] px-6 sm:px-10">
          <p className="mb-10 flex items-center gap-4 text-[13px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
            <span aria-hidden className="h-px w-10 bg-foreground/30" />
            What we do
          </p>
          <p data-read className="font-display text-[clamp(2.4rem,5.6vw,5rem)] leading-[1.06] tracking-[-0.02em]">
            {STATEMENT.map(({ w, em }, i) => (
              <span key={i}>
                <span className={cn("read-word", em && "italic text-[oklch(0.42_0.16_278)]")}>{w}</span>{" "}
              </span>
            ))}
          </p>
        </div>
      </div>
      </section>

      {/* ───────────────────────── Open roles: a slanted field slides over the statement, then the cards travel sideways ───────────────────────── */}
      <JobMoments />

      {/* ───────────────────────── Roles: horizontal journey (stays pinned while what follows rises over it) ───────────────────────── */}
      <RolesScroll />

      {/* Everything after it climbs over the pinned journey, fog first: on desktop it is pulled up by the same
          distance the journey stays pinned for (220svh — keep in step with HOLD in roles-scroll / landing-motion) */}
      <div className="relative z-10 lg:-mt-[220svh]">
      <FogEdge />
      <div className="bg-background">
      {/* ───────────────────────── Numbers ───────────────────────── */}
      {/* The numbers hold the screen (pinned) while they count to your scroll, then this sheet curls up into a dome as it leaves (see StoryStage) */}
      {/* phones & tablets: a full-screen violet band, like the internships one; desktop: the pinned count on the page */}
      <section data-curl data-nav-tone="oklch(0.5 0.17 281)" data-nav-tone-below="1024" className="relative z-20 max-lg:-mt-[100svh] max-lg:shadow-[0_-24px_50px_-28px_oklch(0.2_0.1_280/0.45),0_60px_90px_-60px_oklch(0.2_0.1_285/0.5)] bg-background shadow-[0_60px_90px_-60px_oklch(0.2_0.1_285/0.5)] [overflow:clip] max-lg:bg-[linear-gradient(180deg,oklch(0.5_0.17_281),oklch(0.58_0.16_287)_55%,oklch(0.68_0.14_293))] max-lg:text-white lg:h-[240svh]">
        {/* the band's depth (phones): hairline arcs from two corners and a pool of light, as on the internships band */}
        <svg aria-hidden className="pointer-events-none absolute inset-0 size-full text-white lg:hidden" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1">
          <ellipse cx="400" cy="40" rx="300" ry="260" />
          <ellipse cx="400" cy="40" rx="200" ry="170" />
          <ellipse cx="0" cy="780" rx="280" ry="220" />
          <ellipse cx="0" cy="780" rx="180" ry="140" />
        </svg>
        <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 h-[70%] w-[140%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,oklch(0.8_0.12_300/0.3),transparent)] lg:hidden" />

        <div className="relative mx-auto flex min-h-svh max-w-[1400px] flex-col justify-center px-6 py-20 sm:px-10 lg:sticky lg:top-0 lg:h-svh lg:flex-row lg:items-center lg:py-0">
          <p className="mb-12 flex items-center gap-4 text-[12px] font-medium tracking-[0.22em] text-white/75 uppercase lg:hidden">
            <span aria-hidden className="h-px w-8 bg-white/50" />
            By the numbers
          </p>
          <ul className="grid w-full grid-cols-2 gap-x-3 gap-y-16 lg:grid-cols-4 lg:gap-y-14">
            {STATS.map((s) => (
              <li key={s.label} className="flex flex-col items-center">
                <StatFigure n={s.n} suffix={s.suffix} label={s.label} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────────────────────── Story: a still stage that headline, cards and words play on ───────────────────────── */}
      <StoryStage />

      {/* ───────────────────────── Bridge: the AI assistant ───────────────────────── */}
      {/* Bridge is introduced inside the story's dark star; this small section is only for reduced motion */}
      <div className="hidden motion-reduce:block">
        <MeetBridge />
      </div>

      </div>
      </div>

      </div>

      {/* the footer is fixed behind the page; this empty block is the scroll distance that uncovers it */}
      <div aria-hidden data-footer-spacer className="h-svh" />
      <SiteFooter />
    </div>
  )
}
