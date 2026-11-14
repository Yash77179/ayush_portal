import Link from "next/link"

import { Roll } from "@/components/landing/roll-link"

/** A call to action written inside a thin hand-drawn oval (used by the "Who it's for" section). */
export function OvalLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="group/oval font-display relative inline-flex h-14 items-center justify-center px-12 text-[1.1rem] tracking-[0.08em] text-[oklch(0.22_0.06_280)] uppercase outline-none">
      <svg aria-hidden viewBox="0 0 320 56" preserveAspectRatio="none" className="absolute inset-0 size-full text-[oklch(0.22_0.06_280/0.55)] transition-[transform,color] duration-500 ease-(--ease-out) group-hover/oval:scale-[1.06] group-hover/oval:text-[oklch(0.22_0.06_280)]" fill="none" stroke="currentColor">
        <ellipse cx="160" cy="28" rx="158" ry="26" />
      </svg>
      <span className="relative">
        <Roll>{children}</Roll>
      </span>
    </Link>
  )
}
