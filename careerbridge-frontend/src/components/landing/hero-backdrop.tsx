"use client"

import type * as React from "react"
import dynamic from "next/dynamic"

type GrainientProps = {
  colors?: string[]
  angle?: number
  flow?: number
  silk?: number
  grainAmount?: number
  className?: string
}
// React Bits' Grainient (src/components/Grainient.jsx) is plain JS with defaulted props: give it the type it really has.
// It's WebGL, so it loads after the page (the hero's words never wait for it).
const Grainient = dynamic<GrainientProps>(
  () => import("@/components/Grainient").then((m) => m.default as unknown as React.ComponentType<GrainientProps>),
  { ssr: false }
)

/** The hero's background: a flowing, lightly grained violet gradient that swirls under the pointer. */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <Grainient colors={["#120f17", "#0a132a", "#5b129a", "#a855f7", "#a855f7"]} angle={55} flow={0.8} silk={0.35} grainAmount={0.04} />
      {/* a soft pool behind the words, so they stay crisp */}
      <div className="absolute inset-0 bg-[radial-gradient(48%_38%_at_50%_50%,oklch(0.2_0.08_285/0.5),transparent_75%)]" />
    </div>
  )
}
