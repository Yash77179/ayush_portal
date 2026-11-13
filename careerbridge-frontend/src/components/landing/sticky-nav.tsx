"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"

import { BrandMark } from "@/components/brand-mark"
import { Roll } from "@/components/landing/roll-link"

/**
 * The site's nav, from the very top (the hero has no bar of its own). No bar, no border: a progressive blur sits across the
 * top of the screen — strongest at the very edge, melting away a little way down — and the same few links as
 * the home screen float on it, with the logo in the middle. It fades in and out, it never slides.
 */

/** Stacked backdrop blurs, each masked to end higher up than the last, so the blur ramps instead of stopping. */
const BLUR = [
  { px: 2, end: 100 },
  { px: 5, end: 80 },
  { px: 10, end: 60 },
  { px: 18, end: 40 },
]

const TEXT = "font-display text-[clamp(1rem,1.25vw,1.2rem)] tracking-[0.02em] uppercase outline-none transition-colors"
const TEXT_LIGHT = "text-foreground/85 hover:text-foreground focus-visible:text-foreground"
const TEXT_DARK = "text-[oklch(0.94_0.02_85/0.85)] hover:text-white focus-visible:text-white"

export function StickyNav() {
  const [scrolled, setShow] = React.useState(false) // past the hero
  const [overFooter, setOverFooter] = React.useState(false) // over the dark footer
  const [overDark, setOverDark] = React.useState(false) // over the story's dark takeover (it tells us: cb:nav-dark)
  // a coloured section under the nav (data-nav-tone="<colour>") tints the nav's wash to match, with light text
  const [tone, setTone] = React.useState<string | null>(null)
  const overHero = !scrolled
  const dark = overHero || overFooter || overDark || !!tone // light-on-dark over the violet hero, the dark star and the footer
  // the story's dark star scene is full-screen and immersive: the nav steps aside for it, and comes back at the footer
  const show = !overDark || overFooter
  // no blur over the moving backdrops (the hero's slats, the dark star): re-blurring a strip of a WebGL canvas every
  // frame is costly, and the dark wash alone reads there
  const blur = !overDark && !overHero

  React.useEffect(() => {
    let frame = 0
    const sampleTone = () => {
      frame = 0
      // what's under the nav's strip? (a point just below its links, in the middle of the screen)
      const under = document.elementsFromPoint(window.innerWidth / 2, 56).find((e) => !e.closest("header"))
      const zone = under?.closest<HTMLElement>("[data-nav-tone]")
      const below = Number(zone?.dataset.navToneBelow || 0)
      setTone(zone && (!below || window.innerWidth < below) ? (zone.dataset.navTone ?? null) : null)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(sampleTone)
      const vh = window.innerHeight
      const max = document.documentElement.scrollHeight - vh
      // past the hero: its bottom is above the top 18% of the screen (the hero may sit below the opening scene)
      const hero = document.querySelector("[data-hero]")
      setShow(hero ? hero.getBoundingClientRect().bottom < vh * 0.18 : window.scrollY > vh * 0.82)
      // once the footer behind the page is mostly uncovered, the nav switches to light-on-dark instead of vanishing
      setOverFooter(window.scrollY > max - vh * 0.55)
    }
    const onDark = (e: Event) => setOverDark(!!(e as CustomEvent<boolean>).detail)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("cb:nav-dark", onDark)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("cb:nav-dark", onDark)
    }
  }, [])

  const tab = show ? 0 : -1
  const text = cn(TEXT, dark ? TEXT_DARK : TEXT_LIGHT)

  return (
    <header
      aria-hidden={!show}
      className={cn("pointer-events-none fixed inset-x-0 top-0 z-50 h-[7.25rem] transition-[opacity,visibility] duration-500 ease-(--ease-out)", show ? "visible opacity-100" : "invisible opacity-0")}
    >
      {/* the progressive blur, with a faint wash of the page colour so the links stay readable on any section */}
      <div aria-hidden className="absolute inset-0">
        {/* (no blur over the dark takeover: the dark wash alone reads, and it spares the GPU a re-blur every frame) */}
        {blur && BLUR.map(({ px, end }, i) => (
          <span
            key={px}
            className={cn("absolute inset-0", i !== 1 && "max-md:hidden")} // phones: one layer is plenty, and far lighter
            style={{
              backdropFilter: `blur(${px}px)`,
              WebkitBackdropFilter: `blur(${px}px)`,
              maskImage: `linear-gradient(to bottom, #000 0%, transparent ${end}%)`,
              WebkitMaskImage: `linear-gradient(to bottom, #000 0%, transparent ${end}%)`,
            }}
          />
        ))}
        <span
          className={cn(
            "absolute inset-0 bg-gradient-to-b transition-opacity duration-500",
            "from-[color-mix(in_oklab,var(--background)_72%,transparent)] via-[color-mix(in_oklab,var(--background)_26%,transparent)] to-transparent",
            dark ? "opacity-0" : "opacity-100"
          )}
        />
        {/* the section's own colour, when it has one */}
        <span
          className={cn("absolute inset-0 transition-opacity duration-500", tone && !overDark && !overFooter ? "opacity-100" : "opacity-0")}
          style={{ background: `linear-gradient(to bottom, color-mix(in oklab, ${tone ?? "transparent"} 88%, transparent), color-mix(in oklab, ${tone ?? "transparent"} 40%, transparent) 55%, transparent)` }}
        />
        <span
          className={cn(
            "absolute inset-0 bg-gradient-to-b transition-opacity duration-500",
            "from-[oklch(0.125_0.025_285/0.85)] via-[oklch(0.125_0.025_285/0.35)] to-transparent",
            dark && !(tone && !overDark && !overFooter) ? "opacity-100" : "opacity-0"
          )}
        />
      </div>

      <div className="pointer-events-none relative mx-auto grid h-[4.75rem] w-full max-w-[96rem] grid-cols-[1fr_auto_1fr] items-center px-[clamp(1.25rem,4vw,4rem)] pt-1">
        {/* left */}
        <nav aria-label="Primary" className="pointer-events-auto flex items-center justify-start gap-[clamp(1.25rem,3vw,2.75rem)]">
          <a href="#internships" tabIndex={tab} className={text}>
            <Roll>Internships</Roll>
          </a>
          <a href="#roles" tabIndex={tab} className={cn(text, "hidden md:inline")}>
            <Roll>Who it&rsquo;s for</Roll>
          </a>
        </nav>

        {/* the logo, in the middle */}
        <Link href="/" aria-label="CareerBridge home" tabIndex={tab} className="pointer-events-auto rounded-2xl outline-none transition-transform duration-300 ease-(--ease-out) hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring">
          <BrandMark className="size-12" />
        </Link>

        {/* right */}
        <nav aria-label="Account" className="pointer-events-auto flex items-center justify-end gap-[clamp(1rem,2.4vw,2rem)]">
          <Link href="/login" tabIndex={tab} className={cn(text, "hidden italic sm:inline")}>
            <Roll>Sign in</Roll>
          </Link>
          <Link href="/register" tabIndex={tab} className={cn("group/cta font-display relative inline-flex h-11 items-center justify-center px-8 text-[clamp(1rem,1.25vw,1.2rem)] tracking-[0.02em] uppercase outline-none transition-colors", dark ? "text-[oklch(0.94_0.02_85)]" : "text-foreground")}>
            <svg aria-hidden viewBox="0 0 160 44" preserveAspectRatio="none" className="absolute inset-0 size-full transition-transform duration-500 ease-(--ease-out) group-hover/cta:scale-[1.06]" fill="none" stroke="currentColor" strokeOpacity="0.65">
              <ellipse cx="80" cy="22" rx="78" ry="20" />
            </svg>
            <span className="relative">
              <Roll>Sign up</Roll>
            </span>
          </Link>
        </nav>
      </div>
    </header>
  )
}
