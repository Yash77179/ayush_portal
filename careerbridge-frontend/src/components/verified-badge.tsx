import { cn } from "cn"

/**
 * A scalloped "verified" seal with a white tick — the blue-check look people know
 * from social profiles. Pure SVG, so it stays crisp at any size.
 *
 * tone="blue" (default): the company verified mark.
 * tone="teal": the blue-green seal for student verification (flat, no glow).
 * tone="inverse": for inside a solid verify button — the seal takes the button's text colour and the tick is cut out
 *   in the button colour. Inside a `group/button` the scallops turn a notch on hover while the tick stays put.
 */
const POINTS = Array.from({ length: 96 }, (_, i) => {
  const a = (i / 96) * Math.PI * 2
  const r = 10.2 + 1.15 * Math.cos(a * 8)
  return `${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`
})
const SEAL = `M${POINTS.join("L")}Z`

const TONES = {
  blue: { svg: "text-[oklch(0.66_0.17_245)] drop-shadow-[0_2px_4px_oklch(0.5_0.17_245/0.35)]", tick: "#fff" },
  teal: { svg: "text-(--verify)", tick: "#fff" },
  inverse: { svg: "text-current", tick: "var(--verify)" },
}

export function VerifiedBadge({ className, title = "Verified", tone = "blue" }: { className?: string; title?: string; tone?: keyof typeof TONES }) {
  const t = TONES[tone]
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} className={cn("size-5 shrink-0", t.svg, className)}>
      <title>{title}</title>
      <path
        d={SEAL}
        fill="currentColor"
        className="origin-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-box:fill-box] group-hover/button:rotate-45 motion-reduce:transition-none"
      />
      <path d="M7.6 12.4l3 3 5.9-6.4" fill="none" stroke={t.tick} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
