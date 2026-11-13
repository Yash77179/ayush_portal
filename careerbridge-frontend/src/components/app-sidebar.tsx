"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "cn"

import { useAuth } from "@/contexts/auth-context"
import { getCompanyStats, getStudentStats } from "@/lib/api"
import {
  demoCompany,
  demoStudent,
  isEmptyCompany,
  isEmptyStudent,
  type CompanyStats,
  type StudentStats,
} from "@/lib/demo"
import { isActive, isChildActive, ROLE_NAV, type NavLink } from "@/lib/nav"
import { useThemeRipple } from "@/lib/theme-ripple"
import { useDashboardData } from "@/lib/use-dashboard-data"
import {
  BellIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowRightUpIcon,
  GlobalIcon,
  LogoutIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  ProfileIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
} from "@/components/icons"
import { BrandMark } from "@/components/brand-mark"
import { openNotifications, useUnreadNotifications } from "@/components/notifications"
import { CommandMenu } from "@/components/command-menu"
import { OrgAvatar, STATUS_DOT } from "@/components/kit"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar"

/* ── Live data for the sidebar (counts on the right, recent people) ──────── */
interface SidebarData {
  meta: Record<string, string | number | undefined>
  recent: { name: string; sub: string; status: string }[]
  recentTo: string
  recentAdd: string
}
const EMPTY: SidebarData = { meta: {}, recent: [], recentTo: "/", recentAdd: "/" }
const SidebarDataCtx = React.createContext<SidebarData>(EMPTY)

function StudentData({ children }: { children: React.ReactNode }) {
  const { data } = useDashboardData<StudentStats>(getStudentStats, demoStudent, isEmptyStudent)
  const value = React.useMemo<SidebarData>(
    () => ({
      meta: {
        "/dashboard/student/applications": data?.total_applications,
        "/dashboard/student/profile": data ? `${data.profile_completion}%` : undefined,
      },
      recent: (data?.recent_applications ?? []).slice(0, 3).map((a) => ({ name: a.company, sub: a.internship_title, status: a.status })),
      recentTo: "/dashboard/student/applications",
      recentAdd: "/internships",
    }),
    [data]
  )
  return <SidebarDataCtx.Provider value={value}>{children}</SidebarDataCtx.Provider>
}

function CompanyData({ children }: { children: React.ReactNode }) {
  const { data } = useDashboardData<CompanyStats>(getCompanyStats, demoCompany, isEmptyCompany)
  const value = React.useMemo<SidebarData>(
    () => ({
      meta: {
        "/dashboard/company/internships": data?.published_internships,
        "/dashboard/company/applicants": data?.total_applicants,
      },
      recent: (data?.recent_applications ?? []).slice(0, 3).map((a) => ({ name: a.student_name, sub: a.internship_title, status: a.status })),
      recentTo: "/dashboard/company/applicants",
      recentAdd: "/dashboard/company/internships/create",
    }),
    [data]
  )
  return <SidebarDataCtx.Provider value={value}>{children}</SidebarDataCtx.Provider>
}

/* ── Styles ──────────────────────────────────────────────────────────────── */
const LABEL = "px-3 pt-6 pb-2.5 text-[12.5px] font-medium tracking-[0.09em] text-muted-foreground uppercase group-data-[collapsible=icon]:invisible"
const ROW =
  "group/row relative flex h-[3.25rem] w-full shrink-0 items-center gap-3.5 rounded-[20px] border border-transparent pr-3 pl-4 text-[15.5px] text-muted-foreground outline-none transition-[background-color,color,transform] duration-200 hover:bg-secondary/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.985] group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-14 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-[20px] group-data-[collapsible=icon]:p-0"
const TILE = "flex size-6 shrink-0 items-center justify-center transition-colors duration-200 [&_svg]:size-[22px]"
const TILE_OFF = "text-muted-foreground group-hover/row:text-foreground"
const TILE_ON = "text-foreground"
const ROW_ACTIVE = "tone-lime tint dbl border border-transparent text-foreground [--r:20px] hover:bg-transparent"
const TEXT = "truncate group-data-[collapsible=icon]:hidden"

function Tile({ Icon, active, children }: { Icon: NavLink["icon"]; active: boolean; children?: React.ReactNode }) {
  return (
    <span className={cn(TILE, "relative", active ? TILE_ON : TILE_OFF)}>
      <Icon />
      {children}
    </span>
  )
}

function Meta({ children, tone }: { children: React.ReactNode; tone?: "alert" }) {
  return (
    <span
      className={cn(
        "ml-auto rounded-full px-2.5 py-1 text-[11.5px] leading-none font-medium tabular-nums group-data-[collapsible=icon]:hidden",
        tone === "alert" ? "bg-(--pink-bg) text-(--pink-fg)" : "bg-secondary text-muted-foreground"
      )}
    >
      {children}
    </span>
  )
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
export function AppSidebar() {
  const { user } = useAuth()
  const Provider = user?.role === "student" ? StudentData : user?.role === "company" ? CompanyData : React.Fragment
  return (
    <Provider>
      <SidebarView />
    </Provider>
  )
}

function SidebarView() {
  const { user } = useAuth()
  const pathname = usePathname()
  const { toggleSidebar, state, isMobile } = useSidebar()
  const data = React.useContext(SidebarDataCtx)
  const links = ROLE_NAV[user?.role ?? "student"]
  const collapsed = state === "collapsed" && !isMobile
  const [cmdOpen, setCmdOpen] = React.useState(false)
  const unread = useUnreadNotifications()

  return (
    <>
      <Sidebar variant="floating" collapsible="icon">
        <SidebarHeader className="px-5 pt-6 pb-2 group-data-[collapsible=icon]:px-2">
          <Link href="/" className="flex items-center gap-3.5 rounded-2xl transition-transform duration-150 active:scale-[0.97] group-data-[collapsible=icon]:justify-center">
            <BrandMark />
            <span className="leading-tight group-data-[collapsible=icon]:hidden">
              <span className="block text-[18px] font-semibold tracking-tight">CareerBridge</span>
              <span className="block text-[13px] text-muted-foreground">Placement portal</span>
            </span>
          </Link>
          {!isMobile && (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="absolute top-7 -right-3.5 z-30 flex size-7 items-center justify-center rounded-full border border-(--hairline) bg-card text-muted-foreground shadow-sm transition-[transform,color] duration-150 hover:text-foreground active:scale-90"
            >
              {collapsed ? <ChevronRightIcon className="size-4" /> : <ChevronLeftIcon className="size-4" />}
            </button>
          )}
        </SidebarHeader>

        <SidebarContent className="min-h-0 gap-0 overflow-x-hidden px-4 pt-4 group-data-[collapsible=icon]:px-2">
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="flex h-12 w-full shrink-0 items-center gap-3 rounded-[20px] border border-(--hairline) bg-card px-4 text-[15px] text-muted-foreground transition-[background-color,transform] duration-150 hover:bg-secondary active:scale-[0.985] group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-14 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-[20px] group-data-[collapsible=icon]:px-0"
          >
            <SearchIcon className="size-5 shrink-0" />
            <span className={cn(TEXT, "flex-1 text-left")}>Search</span>
            <span className="flex gap-1 group-data-[collapsible=icon]:hidden">
              <kbd className="grid h-6 min-w-6 place-items-center rounded-md border border-(--hairline) bg-secondary px-1 text-[11px] font-medium">⌘</kbd>
              <kbd className="grid h-6 min-w-6 place-items-center rounded-md border border-(--hairline) bg-secondary px-1 text-[11px] font-medium">K</kbd>
            </span>
          </button>

                    <p className={LABEL}>Main</p>
          <nav className="flex flex-col gap-1.5">
            {links.map((l) => (
              <NavRow key={l.href + l.label} link={l} pathname={pathname} collapsed={collapsed} meta={data.meta[l.href]} />
            ))}
            <button
              type="button"
              className={ROW}
              onClick={openNotifications}
            >
              <Tile Icon={BellIcon} active={false}>
                {unread > 0 && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-destructive ring-2 ring-sidebar" />}
              </Tile>
              <span className={TEXT}>Notifications</span>
              {unread > 0 && <Meta tone="alert">{unread}</Meta>}
            </button>
          </nav>

          <RecentList collapsed={collapsed} />
        </SidebarContent>

        <SidebarFooter className="shrink-0 p-4 group-data-[collapsible=icon]:px-3.5 group-data-[collapsible=icon]:py-4">
          <UserCard collapsed={collapsed} />
        </SidebarFooter>
      </Sidebar>
      <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} />
    </>
  )
}

/* ── One nav row; with children it becomes an animated tree (or a flyout when collapsed) ── */
function NavRow({ link, pathname, collapsed, meta }: { link: NavLink; pathname: string; collapsed: boolean; meta?: string | number }) {
  const Icon = link.icon
  const active = isActive(pathname, link)
  const [open, setOpen] = React.useState(active)

  if (!link.children) {
    return (
      <Link href={link.href} aria-current={active ? "page" : undefined} className={cn(ROW, active && ROW_ACTIVE)} title={collapsed ? link.label : undefined}>
        <Tile Icon={Icon} active={active} />
        <span className={cn(TEXT, active && "font-semibold")}>{link.label}</span>
        {meta !== undefined && <Meta>{meta}</Meta>}
      </Link>
    )
  }

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={<button type="button" aria-label={link.label} className={cn(ROW, active && ROW_ACTIVE)} />}>
          <Tile Icon={Icon} active={active} />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" sideOffset={16} className="min-w-48">
          {link.children.map((c) => (
            <DropdownMenuItem key={c.href} render={<Link href={c.href} />} className={cn(isChildActive(pathname, c) && "bg-secondary font-medium")}>
              {c.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={cn(ROW, active && ROW_ACTIVE)}>
        <Tile Icon={Icon} active={active} />
        <span className={cn(TEXT, "flex-1 text-left", active && "font-semibold")}>{link.label}</span>
        {meta !== undefined && <Meta>{meta}</Meta>}
        <ChevronDownIcon className={cn("size-4 shrink-0 transition-transform duration-300 ease-(--ease-drawer)", !meta && "ml-auto", open && "rotate-180")} />
      </button>
      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-(--ease-drawer)", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <ul className="overflow-hidden">
          <div className="pt-1 pb-1.5 pl-[1.8rem]">
            {link.children.map((c) => {
              const on = isChildActive(pathname, c)
              return (
                <li
                  key={c.href}
                  className="relative pl-7 before:absolute before:top-0 before:left-0 before:h-1/2 before:w-5 before:rounded-bl-xl before:border-b before:border-l before:border-border not-last:after:absolute not-last:after:top-1/2 not-last:after:bottom-0 not-last:after:left-0 not-last:after:border-l not-last:after:border-border"
                >
                  <Link
                    href={c.href}
                    tabIndex={open ? 0 : -1}
                    className={cn(
                      "flex h-10 items-center gap-2.5 rounded-xl px-3 text-[14px] transition-colors duration-150 hover:bg-secondary/60 hover:text-foreground",
                      on ? "font-medium text-foreground" : "text-muted-foreground"
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full transition-colors duration-200", on ? "bg-foreground" : "bg-foreground/20")} />
                    {c.label}
                  </Link>
                </li>
              )
            })}
          </div>
        </ul>
      </div>
    </div>
  )
}

/* ── Recent people ───────────────────────────────────────────────────────── */
function RecentList({ collapsed }: { collapsed: boolean }) {
  const { recent, recentTo, recentAdd } = React.useContext(SidebarDataCtx)
  if (recent.length === 0) return null
  return (
    <div className="mt-2">
      <div className="mx-1 mt-3 mb-1 border-t border-border group-data-[collapsible=icon]:mx-2" />
      <div className="flex items-center justify-between group-data-[collapsible=icon]:invisible">
        <p className={LABEL}>Recent</p>
        <Link href={recentAdd} aria-label="Add" className="mt-4 mr-1 flex size-7 items-center justify-center rounded-full text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-secondary hover:text-foreground active:scale-90">
          <PlusIcon className="size-5" />
        </Link>
      </div>
      <ul className="flex flex-col gap-1">
        {recent.map((p) => (
          <li key={p.name}>
            <Link href={recentTo} title={collapsed ? p.name : undefined} className={cn(ROW, "h-[3.5rem]")}>
              <span className="relative shrink-0">
                <OrgAvatar name={p.name} className="size-10" />
                <span className={cn("absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-sidebar", STATUS_DOT[p.status] ?? "bg-muted-foreground")} />
              </span>
              <span className={cn(TEXT, "flex-1 text-left leading-tight")}>
                <span className="block truncate text-[16px] text-foreground">{p.name}</span>
                <span className="mt-0.5 block truncate text-[13.5px] text-muted-foreground">{p.sub}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── User card: avatar + name open your profile; the chevron opens the menu ── */
const MENU_ROW =
  "h-10 rounded-[10px] px-3 py-0 text-[14px] text-foreground/85 transition-[background-color,color] duration-200 ease-out focus:bg-foreground/[0.05] focus:text-foreground dark:focus:bg-foreground/[0.07] [&_svg]:text-muted-foreground [&_svg]:transition-colors [&_svg]:duration-200 focus:[&_svg]:text-foreground"
const ROLE_CHIP: Record<string, { label: string; tone: string }> = {
  student: { label: "Student", tone: "tone-violet" },
  company: { label: "Recruiter", tone: "tone-blue" },
  university: { label: "University", tone: "tone-mint" },
  admin: { label: "Admin", tone: "tone-peach" },
}
const THEME_EASE = "cubic-bezier(0.32,0.72,0,1)"
/* ── Light / Dark / System: one thumb that glides between the options ── */
function ThemeSwitch() {
  const { theme, setTheme } = useThemeRipple()
  const themes = [
    { v: "light", label: "Light", Icon: SunIcon },
    { v: "dark", label: "Dark", Icon: MoonIcon },
    { v: "system", label: "System", Icon: MonitorIcon },
  ]
  const themeIndex = themes.findIndex((t) => t.v === theme)
  const thumbAt = (i: number) => `translateX(calc(${Math.max(i, 0)} * (100% + 0.25rem)))`
  // the thumb glides to the new option. Web Animations, not a CSS transition: the theme provider switches every
  // transition off for the instant the theme changes, which would make it jump.
  const thumb = React.useRef<HTMLSpanElement>(null)
  const lastIndex = React.useRef(themeIndex)
  React.useLayoutEffect(() => {
    const from = lastIndex.current
    lastIndex.current = themeIndex
    const el = thumb.current
    if (!el || from === themeIndex || from < 0 || themeIndex < 0) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    el.animate([{ transform: thumbAt(from) }, { transform: thumbAt(themeIndex) }], { duration: 420, easing: THEME_EASE })
  }, [themeIndex])

  return (
    <div role="radiogroup" aria-label="Theme" className="dbl relative grid grid-cols-3 gap-1 rounded-[14px] bg-secondary p-1 [--r:14px]">
      <span
        ref={thumb}
        aria-hidden
        className="absolute top-1 bottom-1 left-1 w-[calc((100%-1rem)/3)] rounded-[10px] bg-card shadow-[0_1px_2px_oklch(0_0_0/0.08),0_2px_8px_-2px_oklch(0_0_0/0.1),0_0_0_1px_var(--hairline)]"
        style={{ transform: thumbAt(themeIndex), opacity: themeIndex < 0 ? 0 : 1 }}
      />
      {themes.map(({ v, label, Icon }) => {
        const on = theme === v
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setTheme(v)}
            className={cn(
              "relative z-10 flex h-9 items-center justify-center gap-1.5 rounded-[10px] text-[13px] font-medium outline-none transition-[color,transform] duration-200 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]",
              on ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

function UserCard({ collapsed }: { collapsed: boolean }) {
  const { isMobile } = useSidebar()
  const { user, logout } = useAuth()
  const router = useRouter()
  if (!user) return null

  const name = user.full_name || user.username
  const initials = ((user.first_name?.[0] ?? "") + (user.last_name?.[0] ?? user.username?.[0] ?? "")).toUpperCase()
  const profileHref = user.role === "student" ? "/dashboard/student/profile" : "/dashboard/account"

  return (
    <div className="flex items-center gap-1 rounded-[26px] border border-(--hairline) bg-card p-2 group-data-[collapsible=icon]:relative group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full">
      <Link
        href={profileHref}
        title="Open profile"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[20px] p-1 text-left outline-none transition-[background-color,transform] duration-150 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:pointer-events-none"
      >
        <Avatar className="size-11 shrink-0 rounded-2xl after:rounded-2xl">
          <AvatarImage src={user.profile_photo ?? ""} alt={name} className="rounded-2xl" />
          <AvatarFallback className="tone-lime rounded-2xl bg-(--t-bg) text-sm font-semibold text-(--t-fg)">{initials}</AvatarFallback>
        </Avatar>
        <span className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
          <span className="truncate text-[14.5px] font-semibold">{name}</span>
          <span className="truncate text-[10.5px] font-medium tracking-[0.08em] text-muted-foreground uppercase">{user.role}</span>
        </span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:inset-0 group-data-[collapsible=icon]:size-full group-data-[collapsible=icon]:opacity-0 transition-[background-color,color,transform] duration-150 hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-90 aria-expanded:bg-secondary aria-expanded:text-foreground"
        >
          <ChevronDownIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="dbl w-[min(20rem,calc(100vw-2rem))] rounded-[24px] p-2.5 [--r:24px]"
          side={isMobile || !collapsed ? "top" : "right"}
          align={collapsed && !isMobile ? "end" : "start"}
          sideOffset={12}
        >
          {/* who you are */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center gap-3 px-2 pt-1.5 pb-2.5 font-normal text-foreground">
              <Avatar className="size-10 shrink-0 rounded-[14px] after:rounded-[14px]">
                <AvatarImage src={user.profile_photo ?? ""} alt="" className="rounded-[14px]" />
                <AvatarFallback className="tone-lime rounded-[14px] bg-(--t-bg) text-[13px] font-semibold text-(--t-fg)">{initials}</AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-[14.5px] font-semibold">{name}</span>
                <span className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{user.email}</span>
              </span>
              <span
                className={cn(
                  ROLE_CHIP[user.role]?.tone ?? "tone-mist",
                  "mt-px shrink-0 self-start rounded-full border border-[color-mix(in_oklab,var(--t-fg)_14%,transparent)] bg-(--t-bg) px-2.5 py-[3px] text-[11px] font-semibold tracking-[0.01em] text-(--t-fg) shadow-[inset_0_0_0_1.5px_var(--t-bg),inset_0_0_0_2.5px_var(--keyline-tint)]"
                )}
              >
                {ROLE_CHIP[user.role]?.label ?? user.role}
              </span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>

          <div className="dbl rounded-[16px] border border-(--hairline) bg-card p-1.5 [--r:16px]">
            <DropdownMenuItem render={<Link href={profileHref} />} className={MENU_ROW}>
              <ProfileIcon /> {user.role === "student" ? "My profile" : "Account"}
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/dashboard/account" />} className={MENU_ROW}>
              <SettingsIcon /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/" />} className={MENU_ROW}>
              <GlobalIcon /> Website
              <ArrowRightUpIcon className="ml-auto size-4! text-muted-foreground" />
            </DropdownMenuItem>
          </div>

          {/* appearance: one segmented control instead of three rows */}
          <div className="mt-2.5 px-1">
            <p className="px-1 pb-1.5 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">Appearance</p>
            <ThemeSwitch />
          </div>

          <DropdownMenuSeparator className="mx-2 my-2.5" />
          <DropdownMenuItem
            variant="destructive"
            className={cn(MENU_ROW, "text-destructive focus:bg-destructive/[0.08] focus:text-destructive [&_svg]:text-destructive! dark:focus:bg-destructive/15")}
            onClick={() => {
              logout()
              toast("Signed out")
              router.push("/")
            }}
          >
            <LogoutIcon /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
