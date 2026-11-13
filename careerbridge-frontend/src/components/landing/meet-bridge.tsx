"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { ArrowRightIcon } from "@/components/icons"
import { useAuth } from "@/contexts/auth-context"
import { queueBridge } from "@/lib/assistant"
import { cn } from "cn"

/**
 * Landing: a quiet mention of Bridge, the AI assistant, for phones and reduced motion. (On desktop, Bridge is
 * introduced inside the story's dark star instead — see story-stage.tsx.) One pill, one line, one
 * link, then the footer. (Bridge itself lives inside the signed-in app: the link takes you there, through sign-in
 * if needed, and Bridge opens.) The "Meet Bridge" pill arrives as a dot and stretches out into its label.
 */

/** True once the element has been on screen. */
function useSeen<T extends Element>(threshold = 0.6) {
  const ref = React.useRef<T>(null)
  const [seen, setSeen] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        setSeen(true)
      },
      { threshold }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return [ref, seen] as const
}

/** "Meet Bridge": pops in as a glowing dot, then stretches out into the pill as its label slides in. */
export function MeetPill({ seen, className }: { seen: boolean; className?: string }) {
  return (
    <p
      className={cn(
        "inline-flex items-center rounded-full border border-(--hairline) bg-card p-1 text-[12px] font-medium tracking-[0.2em] text-muted-foreground uppercase",
        "origin-left transition-[scale,opacity] duration-[650ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none",
        seen ? "scale-100 opacity-100" : "scale-0 opacity-0",
        className
      )}
    >
      <span aria-hidden className="relative size-5 shrink-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,oklch(0.98_0.02_300),oklch(0.75_0.17_310)_45%,oklch(0.52_0.2_280))] shadow-[0_0_14px_oklch(0.75_0.17_305/0.7)]">
        {seen && <span className="absolute inset-0 animate-ping rounded-full bg-[oklch(0.8_0.15_305/0.7)] [animation-iteration-count:2] motion-reduce:hidden" />}
      </span>
      {/* the label: a 0fr → 1fr column, so the pill grows to exactly its width */}
      <span className={cn("grid transition-[grid-template-columns] delay-[550ms] duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none", seen ? "grid-cols-[1fr]" : "grid-cols-[0fr]")}>
        <span className="overflow-hidden">
          <span
            className={cn(
              "block pr-3 pl-2 whitespace-nowrap transition-[opacity,filter,translate] delay-[750ms] duration-700 ease-out motion-reduce:transition-none",
              seen ? "translate-x-0 opacity-100 blur-0" : "-translate-x-2 opacity-0 blur-[4px]"
            )}
          >
            Meet Bridge
          </span>
        </span>
      </span>
    </p>
  )
}

export function MeetBridge() {
  const router = useRouter()
  const { user } = useAuth()
  const [ref, seen] = useSeen<HTMLDivElement>()
  const open = () => {
    queueBridge({})
    router.push(user ? "/dashboard" : "/login")
  }
  const rise = (delay: string) =>
    cn(
      "transition-[opacity,translate] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
      delay,
      seen ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
    )

  return (
    <section aria-labelledby="meet-bridge" className="relative px-6 pt-24 pb-32 sm:px-10 lg:pt-28 lg:pb-40">
      <div ref={ref} className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <MeetPill seen={seen} />
        <h2 id="meet-bridge" className={cn("mt-6 text-[clamp(2rem,4.2vw,3.4rem)] leading-[1.04] font-medium tracking-[-0.04em] text-balance", rise("delay-200"))}>
          Your career,{" "}
          <span className="font-display tracking-[-0.01em] text-[oklch(0.5_0.17_285)] italic dark:text-[oklch(0.8_0.11_292)]">one question</span> away.
        </h2>
        <p className={cn("mt-4 max-w-md text-[16px] leading-relaxed text-pretty text-muted-foreground", rise("delay-300"))}>
          Bridge, the assistant inside CareerBridge, knows your profile and every open listing — ask it anything, by text or out loud.
        </p>
        <button
          type="button"
          onClick={open}
          className={cn(
            "group mt-7 inline-flex items-center gap-2 text-[15px] font-medium underline decoration-foreground/25 underline-offset-[6px] hover:decoration-foreground/70",
            rise("delay-[400ms]")
          )}
        >
          {user ? "Talk to Bridge" : "Sign in to talk to Bridge"}
          <ArrowRightIcon className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </button>
      </div>
    </section>
  )
}
