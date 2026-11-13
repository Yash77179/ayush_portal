"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "cn"

import { useAuth } from "@/contexts/auth-context"
import { ArrowLeftIcon, HomeIcon, SidebarIcon } from "@/components/icons"
import { isActive, PAGE_TITLES, ROLE_HOME, ROLE_NAV } from "@/lib/nav"
import { NotificationsMenu } from "@/components/notifications"
import { useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const ICON_BTN =
  "glass-nav relative flex size-11 shrink-0 items-center justify-center rounded-full text-foreground/85 outline-none transition-[transform,color] duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-90 [&_svg]:size-[18px]"

function Hint({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** Sticky header: sidebar toggle, Back, Home, sliding segmented nav, bell. Always visible. */
export function AppHeader() {
  const { user } = useAuth()
  const { toggleSidebar } = useSidebar()
  const pathname = usePathname()
  const router = useRouter()
  const role = user?.role ?? "student"
  const home = ROLE_HOME[role]
  const links = ROLE_NAV[role]
  const title = PAGE_TITLES[pathname] ?? (pathname.startsWith("/internships/") ? "Internship details" : "CareerBridge")

  const navRef = React.useRef<HTMLElement>(null)
  const itemRefs = React.useRef<Record<string, HTMLAnchorElement | null>>({})
  const [pill, setPill] = React.useState<{ x: number; w: number } | null>(null)

  // Slide the lime segment under the active link (interruptible CSS transition).
  const measure = React.useCallback(() => {
    const active = links.find((l) => isActive(pathname, l))
    const el = active && itemRefs.current[active.href]
    setPill(el ? { x: el.offsetLeft, w: el.offsetWidth } : null)
  }, [links, pathname])

  React.useEffect(() => {
    const raf = requestAnimationFrame(measure)
    document.fonts?.ready.then(measure)
    const ro = new ResizeObserver(measure)
    if (navRef.current) ro.observe(navRef.current)
    Object.values(itemRefs.current).forEach((el) => el && ro.observe(el))
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [measure])

  const goBack = () => {
    if (window.history.length > 1) router.back()
    else router.push(home)
  }

  // Top-level pages only: skip duplicates that share an href.
  const topLinks = links.filter((l, i) => links.findIndex((x) => x.href === l.href) === i)
  const crowded = topLinks.length > 5

  return (
    <header className="sticky top-0 z-30 flex h-[5.75rem] shrink-0 items-center gap-2 bg-gradient-to-b from-background/90 via-background/50 to-transparent px-4 pt-4 sm:px-6 lg:px-10">
      <Hint label="Menu">
        <button type="button" className={cn(ICON_BTN, "md:hidden")} aria-label="Open menu" onClick={toggleSidebar}>
          <SidebarIcon />
        </button>
      </Hint>
      <Hint label="Back">
        <button type="button" className={ICON_BTN} aria-label="Go back" onClick={goBack}>
          <ArrowLeftIcon />
        </button>
      </Hint>
      <Hint label="Home">
        <Link href={home} className={ICON_BTN} aria-label="Go to my dashboard">
          <HomeIcon />
        </Link>
      </Hint>

      <h2 className="ml-3 truncate text-[17px] leading-6 font-medium lg:hidden">{title}</h2>

      <nav
        ref={navRef}
        aria-label="Primary"
        className="glass-nav relative mx-auto hidden min-w-0 gap-1 rounded-full p-2 lg:flex"
      >
        {pill && (
          <span
            aria-hidden
            className="glass-active pointer-events-none absolute top-2 bottom-2 left-0 rounded-full transition-[transform,width] duration-[460ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ transform: `translateX(${pill.x}px)`, width: pill.w }}
          />
        )}
        {topLinks.map((l) => {
          const active = isActive(pathname, l)
          const Icon = l.icon
          return (
            <Link
              key={l.href}
              href={l.href}
              ref={(el) => {
                itemRefs.current[l.href] = el
              }}
              aria-current={active ? "page" : undefined}
              aria-label={l.label}
              title={crowded && !active ? l.label : undefined}
              className={cn(
                "group/tab relative z-10 flex shrink-0 items-center gap-2 rounded-full py-2.5 text-[15.5px] font-medium transition-[color,transform] duration-300 ease-(--ease-out) active:scale-[0.96]",
                crowded && !active ? "px-3.5 2xl:px-5" : "px-5",
                active ? "text-(--on-lime)" : "text-foreground/55 hover:text-foreground"
              )}
            >
              <Icon className="size-[18px] transition-transform duration-300 ease-(--ease-out) group-hover/tab:-translate-y-px group-hover/tab:scale-110" />
              {/* with many sections, inactive tabs show only their icon until the screen is wide enough */}
              <span className={cn(crowded && !active && "hidden 2xl:inline")}>{l.label}</span>
            </Link>
          )
        })}
      </nav>

      <NotificationsMenu className="ml-auto lg:ml-0" />
    </header>
  )
}
