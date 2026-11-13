"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/contexts/auth-context"
import { GlobalIcon, LogoutIcon, MoonIcon, SearchIcon } from "@/components/icons"
import { ROLE_NAV } from "@/lib/nav"
import { useThemeRipple } from "@/lib/theme-ripple"

interface Cmd {
  id: string
  label: string
  hint?: string
  icon: React.ReactNode
  run: () => void
}

/** ⌘K / Ctrl+K command palette: jump to any page or run an action. */
export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const { theme, setTheme } = useThemeRipple()
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)

  const go = React.useCallback(
    (href: string) => {
      onOpenChange(false)
      router.push(href)
    },
    [router, onOpenChange]
  )

  const all = React.useMemo<Cmd[]>(() => {
    const links = ROLE_NAV[user?.role ?? "student"]
    const pages: Cmd[] = links.flatMap((l) => {
      const Icon = l.icon
      const base: Cmd = { id: l.href + l.label, label: l.label, hint: "Page", icon: <Icon className="size-[18px]" />, run: () => go(l.href) }
      const kids: Cmd[] = (l.children ?? [])
        .filter((c) => c.href !== l.href)
        .map((c) => ({ id: c.href, label: `${l.label} · ${c.label}`, hint: "Page", icon: <Icon className="size-[18px]" />, run: () => go(c.href) }))
      return [base, ...kids]
    })
    return [
      ...pages,
      { id: "site", label: "Open website", hint: "Action", icon: <GlobalIcon className="size-[18px]" />, run: () => go("/") },
      {
        id: "theme",
        label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        hint: "Action",
        icon: <MoonIcon className="size-[18px]" />,
        run: () => {
          setTheme(theme === "dark" ? "light" : "dark")
          onOpenChange(false)
        },
      },
      {
        id: "logout",
        label: "Log out",
        hint: "Action",
        icon: <LogoutIcon className="size-[18px]" />,
        run: () => {
          logout()
          onOpenChange(false)
          router.push("/")
        },
      },
    ]
  }, [user?.role, go, theme, setTheme, onOpenChange, logout, router])

  const results = all.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase()))

  // Global shortcut
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  React.useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  React.useEffect(() => {
    listRef.current?.querySelector("[data-active]")?.scrollIntoView({ block: "nearest" })
  }, [active])

  if (!open) return null

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === "Enter") {
      results[active]?.run()
    } else if (e.key === "Escape") {
      onOpenChange(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[14vh]" role="dialog" aria-modal="true" aria-label="Search">
      <button
        aria-label="Close search"
        className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px] animate-in fade-in duration-150"
        onClick={() => onOpenChange(false)}
      />
      <div className="glass-card relative flex w-full max-w-[36rem] flex-col overflow-hidden rounded-[26px] bg-popover p-2 shadow-[0_2px_6px_oklch(0.2_0.02_280/0.06),0_40px_90px_-30px_oklch(0.2_0.02_280/0.45)] [--r:26px] animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200">
        <div className="field-surface flex h-13 items-center gap-3 rounded-[18px] pr-2 pl-4">
          <SearchIcon className="size-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onInputKey}
            placeholder="Search pages and actions…"
            aria-label="Search pages and actions"
            className="min-w-0 flex-1 bg-transparent text-[15.5px] outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close search"
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] bg-secondary px-2.5 text-[12px] font-medium text-muted-foreground transition-[background-color,color,transform] duration-150 hover:text-foreground active:scale-95"
          >
            Esc
          </button>
        </div>

        <ul ref={listRef} className="no-scrollbar mt-2 max-h-[min(22rem,55vh)] overflow-y-auto overscroll-contain px-0.5 py-0.5">
          {results.length === 0 && (
            <li className="px-4 py-10 text-center text-[14px] text-muted-foreground">Nothing matches “{query.trim()}”</li>
          )}
          {results.map((c, i) => (
            <li key={c.id}>
              <button
                data-active={i === active || undefined}
                onMouseMove={() => setActive(i)}
                onClick={c.run}
                className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2 text-left text-[14px] transition-colors duration-100 data-active:bg-secondary"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-card text-foreground/80 ring-1 ring-(--hairline)">{c.icon}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{c.label}</span>
                <span className="shrink-0 text-[12px] text-muted-foreground">{c.hint}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-1.5 flex items-center gap-4 border-t border-(--hairline) px-3 pt-2.5 pb-1 text-[11.5px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><Key>↑</Key><Key>↓</Key> to move</span>
          <span className="flex items-center gap-1.5"><Key>↵</Key> to open</span>
          <span className="ml-auto flex items-center gap-1.5"><Key>Ctrl</Key><Key>K</Key> anytime</span>
        </div>
      </div>
    </div>
  )
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[6px] bg-secondary px-1 font-sans text-[10.5px] font-medium text-foreground/70 shadow-[inset_0_-1px_0_var(--hairline)]">
      {children}
    </kbd>
  )
}
