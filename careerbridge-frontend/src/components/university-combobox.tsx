"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { createUniversity, searchUniversities } from "@/lib/api"
import { ChevronDownIcon, SearchIcon } from "@/components/icons"

export interface UniversityOption {
  id: number
  name: string
  location?: string
}

/**
 * Type-to-search university picker. The dropdown is the input: start typing to
 * filter the list, or add the name as a new university when it isn't there.
 */
export function UniversityCombobox({
  value,
  onChange,
  id,
}: {
  value: UniversityOption | null
  onChange: (u: UniversityOption) => void
  id?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<UniversityOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [adding, setAdding] = React.useState(false)
  const [active, setActive] = React.useState(0)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listId = React.useId()

  const trimmed = query.trim()

  // Debounced server-side search (the list holds hundreds of universities).
  React.useEffect(() => {
    if (!open) return
    let alive = true
    const t = window.setTimeout(
      () => {
        setLoading(true)
        searchUniversities(trimmed)
          .then((d) => {
            if (!alive) return
            const list = Array.isArray(d) ? d : ((d as { results?: UniversityOption[] }).results ?? [])
            setResults(list as UniversityOption[])
          })
          .catch(() => alive && setResults([]))
          .finally(() => alive && setLoading(false))
      },
      trimmed ? 220 : 0
    )
    return () => {
      alive = false
      window.clearTimeout(t)
    }
  }, [open, trimmed])

  // Close when clicking outside.
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [open])

  const exact = results.some((r) => r.name.toLowerCase() === trimmed.toLowerCase())
  const canAdd = trimmed.length >= 2 && !exact
  const total = results.length + (canAdd ? 1 : 0)

  const pick = (u: UniversityOption) => {
    onChange(u)
    setOpen(false)
    setQuery("")
    inputRef.current?.blur()
  }

  const add = async () => {
    if (adding || !canAdd) return
    setAdding(true)
    try {
      const u = (await createUniversity(trimmed)) as UniversityOption
      toast.success(`Added “${u.name}”`)
      pick(u)
    } catch {
      toast.error("Couldn't add that university. Try again.")
    } finally {
      setAdding(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, Math.max(total - 1, 0)))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === "Enter" && open) {
      e.preventDefault()
      if (active < results.length) pick(results[active])
      else if (canAdd) void add()
    } else if (e.key === "Escape") {
      setOpen(false)
      setQuery("")
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-5 z-10 size-5 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={open ? query : (value?.name ?? "")}
        placeholder={open ? (value?.name ?? "Search your university") : "Search your university"}
        onFocus={() => {
          setOpen(true)
          setActive(0)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onKeyDown={onKeyDown}
        className="field-surface h-14 w-full min-w-0 truncate rounded-[1.125rem] pr-12 pl-13 text-[1rem] outline-none placeholder:text-muted-foreground/70"
      />
      <ChevronDownIcon className={cn("pointer-events-none absolute top-1/2 right-5 size-4 -translate-y-1/2 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />

      {open && (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 origin-top animate-in fade-in-0 zoom-in-95 overflow-hidden rounded-[1.375rem] border border-(--hairline) bg-popover p-1.5 shadow-[0_24px_48px_-20px_oklch(0.2_0.05_280/0.35)] duration-150">
          <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto overscroll-contain">
            {results.map((u, i) => (
              <li
                key={u.id}
                role="option"
                aria-selected={value?.id === u.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(u)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer flex-col rounded-2xl px-4 py-2.5 transition-colors",
                  i === active ? "bg-secondary" : "",
                  value?.id === u.id && "font-medium"
                )}
              >
                <span className="truncate text-[0.9688rem]">{u.name}</span>
                {u.location && <span className="truncate text-[0.8438rem] text-muted-foreground">{u.location}</span>}
              </li>
            ))}

            {!loading && results.length === 0 && !canAdd && <li className="px-4 py-3 text-[0.9375rem] text-muted-foreground">No universities found.</li>}
            {loading && results.length === 0 && <li className="px-4 py-3 text-[0.9375rem] text-muted-foreground">Searching…</li>}

            {canAdd && (
              <li
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void add()}
                onMouseEnter={() => setActive(results.length)}
                className={cn(
                  "mt-1 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-3 transition-colors",
                  active === results.length && "bg-secondary"
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[1.25rem] leading-none font-light text-primary-foreground">+</span>
                <span className="min-w-0 text-[0.9688rem]">
                  {adding ? "Adding…" : <>Add <span className="font-medium">“{trimmed}”</span> as a new university</>}
                </span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
