"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Lenis from "lenis"

import { setLenis } from "@/lib/lenis-instance"
import { SMOOTH_SCROLL } from "@/lib/smooth-scroll-config"

/**
 * Site-wide smooth scrolling for every page except the landing page, which runs its own Lenis
 * (driven by GSAP's ticker, in landing-motion.tsx) so the two never fight.
 */
export function SmoothScroll() {
  const pathname = usePathname()
  const isLanding = pathname === "/"

  React.useEffect(() => {
    if (isLanding) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const lenis = new Lenis(SMOOTH_SCROLL)
    setLenis(lenis)

    let raf = 0
    const loop = (t: number) => {
      lenis.raf(t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      setLenis(null)
      lenis.destroy()
    }
  }, [isLanding, pathname])

  return null
}
