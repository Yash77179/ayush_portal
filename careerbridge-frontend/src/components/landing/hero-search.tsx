"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { ArrowRightIcon, SearchIcon } from "@/components/icons"

/** The hero search pill: keyword + work mode, straight into the browse page. */
export function HeroSearch() {
  const router = useRouter()
  const [q, setQ] = React.useState("")
  const [mode, setMode] = React.useState("all")

  const go = (e: React.FormEvent) => {
    e.preventDefault()
    const p = new URLSearchParams()
    if (q.trim()) p.set("q", q.trim())
    if (mode !== "all") p.set("mode", mode)
    const qs = p.toString()
    router.push(`/internships${qs ? `?${qs}` : ""}`)
  }

  return (
    <form
      onSubmit={go}
      role="search"
      className="flex h-[4.5rem] w-full max-w-[38rem] items-center rounded-full bg-white p-1.5 pl-6 text-foreground shadow-[0_28px_60px_-24px_oklch(0.15_0.1_280/0.7)]"
    >
      <SearchIcon className="size-5 shrink-0 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Role, company or skill"
        aria-label="Search internships"
        className="min-w-0 flex-1 bg-transparent px-4 text-[1.0625rem] outline-none placeholder:text-muted-foreground/70"
      />
      <span aria-hidden className="hidden h-8 w-px bg-border sm:block" />
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        aria-label="Work mode"
        className="hidden h-full w-36 cursor-pointer appearance-none bg-transparent px-5 text-[1rem] outline-none sm:block"
      >
        <option value="all">Any mode</option>
        <option value="remote">Remote</option>
        <option value="hybrid">Hybrid</option>
        <option value="onsite">On-site</option>
      </select>
      <button
        type="submit"
        aria-label="Search"
        className="group/go flex h-full w-20 shrink-0 items-center justify-center rounded-full bg-[oklch(0.9_0.07_285)] text-[oklch(0.28_0.12_280)] outline-none transition-[transform,background-color] duration-200 hover:bg-[oklch(0.86_0.09_285)] focus-visible:ring-2 focus-visible:ring-ring active:scale-95 sm:w-28"
      >
        <ArrowRightIcon className="size-6 transition-transform duration-300 group-hover/go:translate-x-1" />
      </button>
    </form>
  )
}
