"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

import type { Bridge } from "@/components/assistant/chat-view"
import { type ConversationSummary, deleteConversation, listConversations } from "@/lib/assistant"
import { cn } from "cn"

/** Group saved chats the way people remember them. */
function bucket(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return "Today"
  const days = (now.getTime() - d.getTime()) / 86_400_000
  if (days < 2) return "Yesterday"
  if (days < 7) return "This week"
  return "Earlier"
}

function when(iso: string) {
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

/**
 * Past chats, inside the popup: slides down over the conversation. Each entry is titled with Bridge's
 * own summary of that chat. Open one to carry on where you left off, or delete it.
 */
export function HistoryPanel({ bridge, onClose }: { bridge: Bridge; onClose: () => void }) {
  const { chat, user } = bridge
  const [items, setItems] = useState<ConversationSummary[] | null>(null)

  useEffect(() => {
    if (!user) return
    let live = true
    listConversations()
      .then((rows) => live && setItems(rows))
      .catch(() => live && setItems([]))
    return () => {
      live = false
    }
  }, [user])

  const open = async (id: number) => {
    try {
      await chat.load(id)
      onClose()
    } catch {
      toast.error("Couldn't open that chat.")
    }
  }

  const remove = async (id: number) => {
    try {
      await deleteConversation(id)
      setItems((all) => all?.filter((c) => c.id !== id) ?? null)
      if (id === chat.conversationId) bridge.reset()
    } catch {
      toast.error("Couldn't delete that chat.")
    }
  }

  const groups = (items ?? []).reduce<Record<string, ConversationSummary[]>>((acc, c) => {
    ;(acc[bucket(c.updated_at)] ??= []).push(c)
    return acc
  }, {})

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 [scrollbar-width:thin]">
        {!user ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-[15px] font-medium">Keep your chats</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">Sign in and Bridge saves every conversation here, so you can pick up where you left off.</p>
            <Link href="/login" className="mt-4 rounded-full bg-primary px-4 py-2 text-[13.5px] font-semibold text-primary-foreground transition-transform active:scale-95">
              Sign in
            </Link>
          </div>
        ) : items === null ? (
          <div className="space-y-2 px-2 pt-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-[14px] bg-foreground/[0.05]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-[15px] font-medium">No chats yet</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">Ask Bridge something — your conversations will be saved here.</p>
          </div>
        ) : (
          Object.entries(groups).map(([label, rows], gi) => (
            <section key={label} className="mb-4 animate-in duration-300 fade-in-0 slide-in-from-top-1" style={{ animationDelay: `${gi * 50}ms` }}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
              <ul className="space-y-1">
                {rows.map((c) => {
                  const current = c.id === chat.conversationId
                  return (
                    <li key={c.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => open(c.id)}
                        aria-current={current ? "true" : undefined}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-[14px] border py-2.5 pr-11 pl-3 text-left transition-colors [--r:14px]",
                          current ? "dbl border-(--hairline) bg-card" : "border-transparent hover:bg-foreground/[0.05]"
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium">{c.title || "New chat"}</span>
                          <span className="block text-[12px] text-muted-foreground">{when(c.updated_at)}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        aria-label={`Delete “${c.title}”`}
                        className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[10px] text-muted-foreground opacity-0 transition-[opacity,background-color,color] group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100"
                      >
                        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                        </svg>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
