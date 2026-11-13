import Link from "next/link"

import { AsciiBackdrop } from "@/components/ascii-backdrop"
import { BrandMark } from "@/components/brand-mark"
import { PlateArt } from "@/components/landing/plate-art"

/** The main button on both auth pages: taller than the app default, with a tighter 14px corner radius (the theme's rounded-2xl is ~25px, which reads as a pill at this height). */
// (the trailing ! makes the radius win over the base button's rounded-full)
export const AUTH_BUTTON = "h-12 rounded-[14px]! text-[15px] font-semibold sm:h-14 sm:text-[16px]"

/**
 * Login / register: one framed card, centred over the ASCII backdrop — and the logo in the top-left corner.
 * One card, in the site's double-border style, with a serif title and a few fine lines fading in from its top edge.
 */
export function AuthShell({
  title,
  subtitle,
  aside,
  children,
  footer,
}: {
  title: string
  subtitle: string
  /** something small, top-right (the sign-up step dots) */
  aside?: React.ReactNode
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="relative isolate min-h-svh bg-background">
      {/* the page's backdrop: a gradient drawn in ASCII characters that scrambles under the cursor (it listens on window, so it still reacts behind the content) */}
      <div aria-hidden className="absolute inset-0">
        <AsciiBackdrop />
      </div>

      {/* the logo: the same distance from the top as from the left */}
      <Link href="/" className="absolute top-[clamp(1.25rem,2.2vw,2rem)] left-[clamp(1.25rem,2.2vw,2rem)] z-10 inline-flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <BrandMark className="size-11 sm:size-14" />
        <span className="text-[1.2rem] font-medium tracking-tight sm:text-[1.4rem]">CareerBridge</span>
      </Link>

      <main className="relative grid min-h-svh place-items-center px-4 py-24 sm:px-8">
        {/* one card — the site's double-border surface, with a few fine lines fading in from its top edge */}
        <section className="glass-card rise relative w-full max-w-[21.5rem] overflow-hidden rounded-[24px] px-4 pt-5 pb-4 [--r:24px] sm:max-w-[25rem] sm:rounded-[30px] sm:px-9 sm:pt-8 sm:pb-6 sm:[--r:30px] max-sm:[&_button]:text-[14.5px] max-sm:[&_button:not([role])]:h-11 max-sm:[&_input]:h-11 max-sm:[&_[data-slot=select-trigger]]:h-11 max-sm:[&_[data-slot=select-trigger]]:text-[15px] max-sm:[&_[role=combobox]]:h-11max-sm:[&_input]:text-[15px] max-sm:[&_label]:text-[13px]">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-52 opacity-70 [mask-image:linear-gradient(to_bottom,#000,transparent)]">
            <PlateArt kind="silk" hue={292} id="auth-lines" tone="ink" />
          </div>

          {aside && <div className="relative mb-2.5 flex justify-end">{aside}</div>}
          <h1 className="font-display relative text-[1.9rem] sm:text-[2.7rem] leading-[0.95] tracking-[-0.02em] text-[oklch(0.22_0.05_280)] italic dark:text-[oklch(0.95_0.025_285)]">{title}</h1>
          <p className="relative mt-1.5 text-[13.5px] leading-snug text-muted-foreground sm:mt-2 sm:text-[15px]">{subtitle}</p>

          <div className="relative mt-4 sm:mt-6">{children}</div>
          {/* the footer: plain text on the white card — no rule, no band */}
          <p className="relative mt-4 text-center text-[13.5px] sm:mt-5 sm:text-[14.5px] text-muted-foreground [&_a]:font-semibold [&_a]:text-[oklch(0.5_0.17_285)] dark:[&_a]:text-[oklch(0.78_0.12_285)] [&_a]:underline-offset-4 [&_a]:hover:underline">{footer}</p>
        </section>
      </main>
    </div>
  )
}
