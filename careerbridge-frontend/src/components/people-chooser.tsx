"use client";

/**
 * Pick individual students for an announcement. The composer only shows a button and the people chosen; the full,
 * searchable list (shadcn Command) opens in a dialog over a blurred page, so the form never grows to list size.
 */

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { cn } from "cn";

import type { CampusStudent } from "@/lib/ats";
import { CloseCircleIcon, PeopleIcon } from "@/components/icons";
import { OrgAvatar } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const SHOWN = 6;

export function PeopleChooser({ students, value, onChange }: { students: CampusStudent[]; value: number[]; onChange: (v: number[]) => void }) {
  const [open, setOpen] = React.useState(false);
  const byId = React.useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const chosen = value.map((id) => byId.get(id)).filter((s): s is CampusStudent => !!s);
  const [more, setMore] = React.useState(false);
  const visible = more ? chosen : chosen.slice(0, SHOWN);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Trigger asChild>
          <Button type="button" variant="outline" className="h-9 gap-2 rounded-full px-4">
            <PeopleIcon className="size-4" /> {chosen.length ? "Edit list" : "Choose students"}
          </Button>
        </DialogPrimitive.Trigger>
        <ChooserDialog students={students} value={value} onChange={onChange} onDone={() => setOpen(false)} />
      </DialogPrimitive.Root>

      {chosen.length === 0 ? (
        <span className="text-[0.875rem] text-muted-foreground">No one yet. Pick by name, enrolment number or branch.</span>
      ) : (
        <>
          {visible.map((s) => (
            <span key={s.id} className="inline-flex h-9 items-center gap-2 rounded-full bg-secondary/70 pr-1 pl-1 text-[0.8125rem] font-medium">
              <OrgAvatar name={s.name} className="size-7 [&>*]:text-[0.625rem]" />
              <span className="max-w-36 truncate">{s.name}</span>
              <button
                type="button"
                aria-label={`Remove ${s.name}`}
                onClick={() => onChange(value.filter((x) => x !== s.id))}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              >
                <CloseCircleIcon className="size-4" />
              </button>
            </span>
          ))}
          {chosen.length > SHOWN && (
            <button type="button" onClick={() => setMore((m) => !m)} className="h-9 rounded-full px-3 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              {more ? "Show fewer" : `+${chosen.length - SHOWN} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ChooserDialog({ students, value, onChange, onDone }: { students: CampusStudent[]; value: number[]; onChange: (v: number[]) => void; onDone: () => void }) {
  const [q, setQ] = React.useState("");
  const [branch, setBranch] = React.useState<string | null>(null);
  const set = new Set(value);
  const branches = React.useMemo(() => [...new Set(students.map((s) => s.branch).filter(Boolean))].sort(), [students]);

  const term = q.trim().toLowerCase();
  const rows = students.filter(
    (s) => (!branch || s.branch === branch) && (!term || `${s.name} ${s.enrollment_number} ${s.branch} ${s.email}`.toLowerCase().includes(term))
  );
  const groups = new Map<string, CampusStudent[]>();
  for (const s of rows.slice(0, 300)) {
    const k = s.branch || "No branch";
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const toggle = (id: number) => onChange(set.has(id) ? value.filter((x) => x !== id) : [...value, id]);
  const allIn = rows.length > 0 && rows.every((s) => set.has(s.id));
  const addAll = () => onChange(allIn ? value.filter((id) => !rows.some((s) => s.id === id)) : [...new Set([...value, ...rows.map((s) => s.id)])]);
  const picked = value.map((id) => students.find((s) => s.id === id)).filter((s): s is CampusStudent => !!s);

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_oklab,var(--background)_42%,transparent)] backdrop-blur-[10px] duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className="fixed top-[max(1rem,10svh)] left-1/2 z-50 flex max-h-[calc(100svh-2rem)] w-[min(36rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col overflow-hidden rounded-[1.75rem] bg-popover text-popover-foreground shadow-[0_2px_8px_oklch(0.2_0.02_270/0.06),0_40px_90px_-30px_oklch(0.2_0.02_270/0.45)] ring-1 ring-(--hairline) duration-300 ease-(--ease-out) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.97] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=open]:slide-in-from-top-2"
      >
        <Command shouldFilter={false} className="min-h-0">
          <div className="space-y-4 p-5 pb-3 sm:p-6 sm:pb-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="text-[1.25rem] font-medium tracking-[-0.01em]">Choose students</DialogPrimitive.Title>
                <p className="mt-0.5 text-[0.875rem] text-muted-foreground">Only the people you pick get this announcement.</p>
              </div>
              <DialogPrimitive.Close className="-mt-1 -mr-1 rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Close">
                <XIcon className="size-[1.125rem]" />
              </DialogPrimitive.Close>
            </div>
            <CommandInput autoFocus value={q} onValueChange={setQ} placeholder="Search name, enrolment no., branch or email" />
            {branches.length > 1 && (
              <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
                <BranchPill on={branch === null} onClick={() => setBranch(null)}>
                  All branches
                </BranchPill>
                {branches.map((b) => (
                  <BranchPill key={b} on={branch === b} onClick={() => setBranch(branch === b ? null : b)}>
                    {b}
                  </BranchPill>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between text-[0.8125rem]">
              <span className="text-muted-foreground">
                {rows.length} student{rows.length === 1 ? "" : "s"}
                {term || branch ? " match" : ""}
              </span>
              {rows.length > 0 && (
                <button type="button" onClick={addAll} className="rounded-full px-2.5 py-1 font-medium text-(--violet-fg) transition-colors hover:bg-(--violet-bg)">
                  {allIn ? "Remove these" : `Add all ${rows.length}`}
                </button>
              )}
            </div>
          </div>

          <CommandList className="max-h-[min(24rem,46svh)] min-h-0 flex-1 px-3 pb-3 sm:px-4">
            <CommandEmpty>No one matches “{q}”.</CommandEmpty>
            {[...groups].map(([g, list]) => (
              <CommandGroup key={g} heading={`${g} · ${list.length}`}>
                {list.map((s) => {
                  const on = set.has(s.id);
                  return (
                    <CommandItem key={s.id} value={String(s.id)} checked={on} onSelect={() => toggle(s.id)}>
                      <OrgAvatar name={s.name} className="size-9 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{s.name}</span>
                        <span className={cn("block truncate text-[0.75rem]", on ? "text-(--violet-fg)/75" : "text-muted-foreground")}>
                          {[s.graduation_year && `Batch ${s.graduation_year}`, s.enrollment_number || s.email].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className={cn("text-[0.75rem] font-medium transition-opacity duration-150", on ? "opacity-100" : "opacity-0")}>Added</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>

        <div className="flex items-center gap-3 border-t border-(--hairline) px-5 py-4 sm:px-6">
          <div className="flex -space-x-1.5">
            {picked.slice(0, 4).map((s) => (
              <OrgAvatar key={s.id} name={s.name} className="size-8 ring-2 ring-popover [&>*]:text-[0.6875rem]" />
            ))}
          </div>
          <p className="min-w-0 flex-1 text-[0.875rem]">
            <b className="font-medium tabular-nums">{value.length}</b> <span className="text-muted-foreground">selected</span>
          </p>
          {value.length > 0 && (
            <Button type="button" variant="ghost" onClick={() => onChange([])}>
              Clear
            </Button>
          )}
          <Button type="button" onClick={onDone} className="min-w-24">
            Done
          </Button>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function BranchPill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "h-8 shrink-0 rounded-full px-3.5 text-[0.8125rem] font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150",
        on ? "bg-(--violet-bg) text-(--violet-fg) shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--violet-fg)_32%,transparent)]" : "bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
