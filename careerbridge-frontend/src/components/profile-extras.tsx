"use client"

import * as React from "react"
import { ArrowRight, Calendar, Clock, Loader2, MapPin } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import { addStudentSkill, getStudentProfile } from "@/lib/api"
import { mediaUrl } from "@/lib/format"
import {
  DEMO_DETECTED,
  uploadResume,
  useProfileExtras,
  type Achievement,
  type Certification,
  type DetectedSkill,
  type Experience,
} from "@/lib/profile-extras"
import { ApplicationsIcon, CheckCircleIcon, PlusIcon, TrashIcon, TrophyIcon } from "@/components/icons"
import BranchedMenu from "@/components/BranchedMenu"
import { VerifiedBadge } from "@/components/verified-badge"
import { Field, OrgAvatar, Panel, stagger } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

/* ── helpers ─────────────────────────────────────────────────────────────── */
const month = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "")

function span(start: string, end: string | null, current: boolean) {
  const a = new Date(start)
  const b = current || !end ? new Date() : new Date(end)
  const m = Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1)
  const y = Math.floor(m / 12)
  const r = m % 12
  return [y ? `${y} yr` : "", r ? `${r} mo` : ""].filter(Boolean).join(" ")
}

const SMALL_BTN =
  "inline-flex h-10 items-center gap-1.5 rounded-full border border-(--hairline) bg-card px-4 text-[14.5px] font-medium shadow-[inset_0_0_0_3px_var(--card),inset_0_0_0_4px_var(--keyline-card)] outline-none transition-[background-color,transform] duration-150 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring active:scale-95"

const SAMPLE_NOTE = <span className="ml-2 text-[13px] font-normal text-muted-foreground opacity-70">· Sample data</span>

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={SMALL_BTN}>
      <PlusIcon className="size-4" /> {label}
    </button>
  )
}

function IconDelete({ onClick, label, always }: { onClick: () => void; label: string; always?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-[opacity,background-color,color] duration-150 hover:bg-(--pink-bg) hover:text-(--pink-fg) focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
        always ? "opacity-70 hover:opacity-100" : "opacity-0 group-hover/item:opacity-100"
      )}
    >
      <TrashIcon className="size-[18px]" />
    </button>
  )
}

/** Dashed drop-zone that opens the file picker (or accepts a dropped file). */
function DropZone({
  accept,
  onFile,
  busy,
  title,
  hint,
  compact,
}: {
  accept: string
  onFile: (f: File) => void
  busy?: boolean
  title: string
  hint: string
  compact?: boolean
}) {
  const [over, setOver] = React.useState(false)
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const f = e.dataTransfer.files?.[0]
        if (f) onFile(f)
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-[26px] border-2 border-dashed text-center transition-[background-color,border-color,transform] duration-200 has-focus-visible:ring-2 has-focus-visible:ring-ring",
        compact ? "gap-1.5 px-5 py-6" : "min-h-56 gap-2.5 px-6 py-8",
        over ? "scale-[1.01] border-(--c-violet) bg-(--violet-bg)" : "border-foreground/15 bg-secondary/40 hover:border-foreground/30 hover:bg-secondary/70"
      )}
    >
      <span className="tone-violet flex size-12 items-center justify-center rounded-2xl bg-(--t-bg) text-(--t-fg)">
        {busy ? <Loader2 className="size-5 animate-spin" /> : <PlusIcon className="size-6" />}
      </span>
      <span className="text-[17px] font-medium">{title}</span>
      <span className="max-w-64 text-[14.5px] leading-snug text-muted-foreground">{hint}</span>
      <input
        type="file"
        accept={accept}
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ""
        }}
      />
    </label>
  )
}

/* ── Resume + skills read from it ────────────────────────────────────────── */
export function ResumeAndSkills({ demo, onSkillsChanged }: { demo: boolean; onSkillsChanged?: () => void }) {
  const [busy, setBusy] = React.useState(false)
  const [file, setFile] = React.useState<{ name: string; url: string | null } | null>(null)
  React.useEffect(() => {
    let alive = true
    getStudentProfile()
      .then((p) => {
        const url = (p as { resume_file?: string | null }).resume_file
        if (alive && url) setFile({ name: decodeURIComponent(url.split("/").pop() ?? "resume.pdf"), url: mediaUrl(url) })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  const [skills, setSkills] = React.useState<DetectedSkill[] | null>(null)
  const [adding, setAdding] = React.useState<number | "all" | null>(null)

  const isSample = skills === null
  const shown = skills ?? (demo ? DEMO_DETECTED : [])

  const handle = async (f: File) => {
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return toast.error("Please upload a PDF.")
    if (f.size > 5 * 1024 * 1024) return toast.error("Resume must be 5 MB or smaller.")
    setBusy(true)
    try {
      const r = await uploadResume(f)
      setFile({ name: f.name, url: mediaUrl(r.resume_file) })
      setSkills(r.detected_skills)
      toast.success(r.detected_skills.length ? `Found ${r.detected_skills.length} skills in your resume` : "Resume saved — no known skills found")
    } catch {
      toast.error("Couldn't read that PDF. Try another file.")
    } finally {
      setBusy(false)
    }
  }

  const add = async (s: DetectedSkill) => {
    if (s.id < 0) return toast.info("This is sample data — upload your resume to add real skills.")
    setAdding(s.id)
    try {
      await addStudentSkill(s.id, "intermediate")
      setSkills((cur) => cur?.map((x) => (x.id === s.id ? { ...x, already_added: true } : x)) ?? cur)
      onSkillsChanged?.()
    } catch {
      toast.error(`Couldn't add ${s.name}.`)
    } finally {
      setAdding(null)
    }
  }

  const addAll = async () => {
    const todo = shown.filter((s) => !s.already_added)
    if (todo.some((s) => s.id < 0)) return toast.info("This is sample data — upload your resume to add real skills.")
    setAdding("all")
    await Promise.all(todo.map((s) => addStudentSkill(s.id, "intermediate").catch(() => null)))
    setSkills((cur) => cur?.map((x) => ({ ...x, already_added: true })) ?? cur)
    setAdding(null)
    onSkillsChanged?.()
    toast.success("Skills added to your profile")
  }

  const pending = shown.filter((s) => !s.already_added).length

  return (
    <>
      <Panel className="lg:col-span-5" title="Resume" style={stagger(4)} contentClassName="flex flex-col gap-4">
        <DropZone accept="application/pdf,.pdf" onFile={handle} busy={busy} title={file ? "Replace your resume" : "Upload your resume"} hint="PDF up to 5 MB. We read it to suggest skills — nothing is added without your OK." />
        {file && (
          <div className="flex items-center gap-3.5 rounded-[22px] border border-(--hairline) bg-card p-3.5">
            <span className="tone-pink flex size-12 shrink-0 items-center justify-center rounded-2xl bg-(--t-bg) text-[12px] font-semibold tracking-wide text-(--t-fg)">PDF</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-medium">{file.name}</p>
              <p className="text-[14px] text-muted-foreground">Uploaded · visible to recruiters</p>
            </div>
            {file.url && (
              <a href={file.url} target="_blank" rel="noopener noreferrer" className="rounded-full px-3 py-1.5 text-[14px] font-medium underline-offset-4 hover:underline">
                View
              </a>
            )}
          </div>
        )}
      </Panel>

      <Panel
        className="lg:col-span-7"
        title="Skills from your resume"
        style={stagger(5)}
        action={pending > 0 && !isSample ? <AddButton onClick={addAll} label={adding === "all" ? "Adding…" : `Add all ${pending}`} /> : undefined}
        contentClassName="flex flex-col"
      >
        {shown.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
            <span className="tone-mint flex size-14 items-center justify-center rounded-2xl bg-(--t-bg) text-(--t-fg)"><ApplicationsIcon className="size-6" /></span>
            <p className="text-[17px] font-medium">Nothing read yet</p>
            <p className="max-w-72 text-[14.5px] text-muted-foreground">Upload your resume and we’ll pull out the skills we recognise.</p>
          </div>
        ) : (
          <>
            <p className="text-[15px] text-muted-foreground">
              {isSample ? "Here’s what we’d find in a typical resume" : `We recognised ${shown.length} skill${shown.length === 1 ? "" : "s"}`}
              {isSample && SAMPLE_NOTE}
            </p>
            <ul className="stagger mt-5 flex flex-wrap gap-2.5">
              {shown.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={s.already_added || adding !== null}
                    onClick={() => add(s)}
                    className={cn(
                      "inline-flex h-11 items-center gap-2.5 rounded-full border pr-3.5 pl-4 text-[15.5px] font-medium outline-none transition-[background-color,transform,border-color] duration-150 focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
                      s.already_added ? "tone-mint border-transparent bg-(--t-bg) text-(--t-fg)" : "border-(--hairline) bg-card hover:bg-secondary"
                    )}
                  >
                    {s.name}
                    {s.already_added ? (
                      <CheckCircleIcon className="size-[18px]" />
                    ) : adding === s.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[16px] leading-none font-light text-primary-foreground">+</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </>
  )
}

/* ── Experience ──────────────────────────────────────────────────────────── */
const TONES = ["tone-blue", "tone-violet", "tone-mint", "tone-peach", "tone-pink"]

function ExperienceDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (b: Partial<Experience>) => Promise<boolean> }) {
  const [f, setF] = React.useState({ title: "", company: "", location: "", start: "", end: "", current: false, description: "" })
  const [saving, setSaving] = React.useState(false)
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }))
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const ok = await onSave({
      title: f.title.trim(),
      company: f.company.trim(),
      location: f.location.trim(),
      start_date: `${f.start}-01`,
      end_date: f.current || !f.end ? null : `${f.end}-01`,
      is_current: f.current,
      description: f.description.trim(),
    })
    setSaving(false)
    if (ok) {
      setF({ title: "", company: "", location: "", start: "", end: "", current: false, description: "" })
      onOpenChange(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto rounded-[32px] p-7 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-medium tracking-tight">Add experience</DialogTitle>
          <DialogDescription>An internship, job, freelance gig or a project you led.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <Field label="Role">
            <Input required placeholder="e.g. Frontend Developer Intern" value={f.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company">
              <Input required placeholder="e.g. Zoho Corporation" value={f.company} onChange={(e) => set("company", e.target.value)} />
            </Field>
            <Field label="Location">
              <Input placeholder="e.g. Chennai" value={f.location} onChange={(e) => set("location", e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start">
              <Input required type="month" value={f.start} onChange={(e) => set("start", e.target.value)} />
            </Field>
            <Field label="End">
              <Input type="month" disabled={f.current} value={f.end} onChange={(e) => set("end", e.target.value)} />
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-3 text-[15.5px]">
            <input type="checkbox" checked={f.current} onChange={(e) => set("current", e.target.checked)} className="size-5 accent-(--c-violet)" />
            I currently work here
          </label>
          <Field label="What did you do?" hint="One achievement per line works best.">
            <Textarea placeholder="Built… Improved… Led…" value={f.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="submit" size="lg" disabled={saving || !f.title || !f.company || !f.start}>
              {saving && <Loader2 className="animate-spin" />} Save experience
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type Extras = ReturnType<typeof useProfileExtras>

/** Roles at the same company are grouped under it, newest first, like a career tree. */
function groupByCompany(items: Experience[]) {
  const sorted = [...items].sort((a, b) => +new Date(b.start_date) - +new Date(a.start_date))
  const groups: { company: string; roles: Experience[] }[] = []
  for (const e of sorted) {
    const g = groups.find((x) => x.company.trim().toLowerCase() === e.company.trim().toLowerCase())
    if (g) g.roles.push(e)
    else groups.push({ company: e.company.trim(), roles: [e] })
  }
  return groups
}

/** Months covered by a set of roles, counting overlapping stretches once. */
function totalMonths(items: Experience[]) {
  const ranges = items
    .map((e) => [+new Date(e.start_date), e.is_current || !e.end_date ? Date.now() : +new Date(e.end_date)] as const)
    .sort((a, b) => a[0] - b[0])
  let total = 0
  let s = 0
  let t = 0
  for (const [a, b] of ranges) {
    if (a > t) {
      total += t - s
      s = a
      t = b
    } else t = Math.max(t, b)
  }
  total += t - s
  return Math.max(1, Math.round(total / (1000 * 60 * 60 * 24 * 30.44)))
}
const fmtMonths = (m: number) => [Math.floor(m / 12) ? `${Math.floor(m / 12)} yr` : "", m % 12 ? `${m % 12} mo` : ""].filter(Boolean).join(" ")

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="min-w-0 rounded-[18px] border border-(--hairline) bg-card px-2.5 py-2.5 sm:px-4 sm:py-3">
      <p className="truncate text-[17px] leading-tight font-semibold tracking-[-0.02em] tabular-nums sm:text-[20px]">{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground min-[400px]:text-[12px] sm:text-[12.5px]">{label}</p>
    </div>
  )
}

function Chip({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-(--hairline) bg-card px-3 py-1 text-[13px] font-medium text-foreground/75">
      <Icon className="size-3.5 text-(--c-violet)" />
      {children}
    </span>
  )
}

const Eyebrow = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={cn("text-[11.5px] font-semibold tracking-[0.14em] text-muted-foreground uppercase", className)}>{children}</p>
)

/**
 * Every role on one line, placed by date from the first start to today; the picked one is violet.
 * Click a segment to open that role.
 */
function CareerBar({ items, selectedId, onPick }: { items: Experience[]; selectedId: number; onPick: (id: number) => void }) {
  const from = Math.min(...items.map((e) => +new Date(e.start_date)))
  const [to] = React.useState(() => Date.now())
  const pct = (t: number) => ((t - from) / Math.max(1, to - from)) * 100
  return (
    <div>
      <div className="relative h-2.5 rounded-full bg-foreground/[0.06]">
        {items.map((e) => {
          const a = pct(+new Date(e.start_date))
          const b = pct(e.is_current || !e.end_date ? to : +new Date(e.end_date))
          const on = e.id === selectedId
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onPick(e.id)}
              title={`${e.title} · ${e.company}`}
              aria-label={`Show ${e.title} at ${e.company}`}
              className={cn(
                "absolute inset-y-0 rounded-full outline-none transition-[background-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-ring",
                on ? "z-[1] bg-(--c-violet) shadow-[0_0_0_3px_var(--card)]" : "bg-foreground/20 hover:bg-foreground/35"
              )}
              style={{ left: `${a}%`, width: `max(${b - a}%, 8px)` }}
            />
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[12px] text-muted-foreground tabular-nums">
        <span>{new Date(from).getFullYear()}</span>
        <span>Today</span>
      </div>
    </div>
  )
}

/** The role picked in the branched menu, as a full card: who, when, where, what they did, and where it sits in the career. */
function ExperienceDetail({
  e,
  items,
  onPick,
  onDelete,
}: {
  e: Experience
  items: Experience[]
  onPick: (id: number) => void
  onDelete?: () => void
}) {
  const lines = e.description ? e.description.split("\n").filter(Boolean) : []
  const sameCompany = items.filter((r) => r.id !== e.id && r.company.trim().toLowerCase() === e.company.trim().toLowerCase())
  return (
    <div className="relative min-w-0 overflow-hidden rounded-[22px] border border-(--hairline) bg-[color-mix(in_oklab,var(--c-violet)_5%,var(--card))] p-5 sm:p-6">
      {/* a soft glow in the corner so the card doesn't read flat */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-56 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--c-violet)_16%,transparent),transparent)]" />

      <div key={e.id} className="relative animate-in duration-300 fade-in-0 slide-in-from-bottom-1">
        <div className="flex items-start gap-3.5">
          <OrgAvatar name={e.company} className="size-12 shrink-0 bg-card text-[15px] shadow-[0_6px_14px_-8px_oklch(0.3_0.08_280/0.45)] ring-[3px] ring-card" />
          <div className="min-w-0 flex-1">
            <p className="text-[20px] leading-tight font-semibold tracking-[-0.015em]">{e.title}</p>
            <p className="mt-1 text-[15px] leading-snug text-foreground/70">{e.company}</p>
          </div>
          {e.is_current && (
            <span className="tone-mint inline-flex shrink-0 items-center gap-1.5 rounded-full bg-(--t-bg) px-2.5 py-1 text-[12.5px] leading-none font-medium text-(--t-fg)">
              <span className="size-1.5 animate-pulse rounded-full bg-(--t-fg)" />
              Current
            </span>
          )}
          {onDelete && <IconDelete always onClick={onDelete} label={`Remove ${e.title}`} />}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Chip icon={Calendar}>
            <span className="tabular-nums">
              {month(e.start_date)} – {e.is_current ? "Present" : month(e.end_date)}
            </span>
          </Chip>
          <Chip icon={Clock}>{span(e.start_date, e.end_date, e.is_current)}</Chip>
          {e.location && <Chip icon={MapPin}>{e.location}</Chip>}
        </div>

        <Eyebrow className="mt-5">What I did</Eyebrow>
        {lines.length > 0 ? (
          <ul className="mt-2.5 space-y-2">
            {lines.map((line, j) => (
              <li key={j} className="flex gap-2.5 text-[14.5px] leading-snug text-foreground/80">
                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-(--c-violet)" />
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[14px] text-muted-foreground">No description added for this role.</p>
        )}

        {sameCompany.length > 0 && (
          <>
            <Eyebrow className="mt-5">Also at {e.company}</Eyebrow>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {sameCompany.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onPick(r.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-(--hairline) bg-card px-3 py-1 text-[13px] font-medium transition-colors hover:bg-secondary"
                >
                  {r.title}
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {items.length > 1 && (
        <div className="relative mt-6 border-t border-(--hairline) pt-4">
          <Eyebrow className="mb-2.5">Career timeline</Eyebrow>
          <CareerBar items={items} selectedId={e.id} onPick={onPick} />
        </div>
      )}
    </div>
  )
}

function ExperienceInner({ x, className }: { x: Extras; className?: string }) {
  const [open, setOpen] = React.useState(false)
  const { items, isDemo } = x.experience
  const groups = React.useMemo(() => groupByCompany(items), [items])
  // the role shown on the right; falls back to the newest one (also after the picked one is deleted)
  const [picked, setPicked] = React.useState<string>("")
  const selected = items.find((e) => String(e.id) === picked) ?? groups[0]?.roles[0]
  const pick = (id: number) => setPicked(String(id))

  // companies are the branches' heads, their roles the leaves — all open, newest first
  const menuItems = groups.map((g) => ({
    label: g.company,
    children: g.roles.map((r) => ({
      value: String(r.id),
      label: r.title,
      icon: r.is_current ? <span className="tone-mint block size-2 rounded-full bg-(--t-fg)" /> : undefined,
    })),
  }))
  // remount the menu when the list itself changes, so its open sections start fresh
  const menuKey = items.map((e) => e.id).join(",")

  return (
    <>
      <Panel className={className} title="Experience" style={stagger(6)} action={<AddButton onClick={() => setOpen(true)} label="Add experience" />}>
        {isDemo && <p className="-mt-2 mb-5 text-[14px] text-muted-foreground">Sample data — add your own and it replaces this.</p>}
        {selected ? (
          <>
            <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-2.5">
              <Stat
                value={
                  <>
                    {/* "2y 8m" on phones, "2 yr 8 mo" where there's room */}
                    <span className="sm:hidden">{fmtMonths(totalMonths(items)).replace(" yr", "y").replace(" mo", "m")}</span>
                    <span className="hidden sm:inline">{fmtMonths(totalMonths(items))}</span>
                  </>
                }
                label="Experience"
              />
              <Stat value={groups.length} label={groups.length === 1 ? "Company" : "Companies"} />
              <Stat value={items.length} label={items.length === 1 ? "Role" : "Roles"} />
            </div>
            <div className="grid gap-6 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-7">
              <div className="min-w-0">
                <Eyebrow className="mb-3">Career path</Eyebrow>
                <BranchedMenu
                  key={menuKey}
                  items={menuItems}
                  defaultOpen={menuItems.map((_, i) => i)}
                  active={String(selected.id)}
                  onSelect={(value) => setPicked(value)}
                  color="var(--foreground)"
                  accentColor="var(--c-violet)"
                  lineColor="color-mix(in oklab, var(--foreground) 16%, transparent)"
                  width={224}
                  rowHeight={36}
                  indent={40}
                  trunk={14}
                  radius={10}
                  lineWidth={1.5}
                  fontSize={14}
                  drawDuration={400}
                  foldDuration={300}
                />
                <p className="mt-3 hidden text-[12.5px] text-muted-foreground md:block">Pick a role to see the details.</p>
              </div>
              <ExperienceDetail e={selected} items={items} onPick={pick} onDelete={isDemo ? undefined : () => x.removeExperience(selected.id)} />
            </div>
          </>
        ) : (
          <p className="text-[14.5px] text-muted-foreground">No experience yet — add your first role.</p>
        )}
      </Panel>
      <ExperienceDialog open={open} onOpenChange={setOpen} onSave={x.addExperience} />
    </>
  )
}

/* ── Achievements ────────────────────────────────────────────────────────── */
function AchievementDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (b: Partial<Achievement>) => Promise<boolean> }) {
  const [f, setF] = React.useState({ title: "", detail: "", date: "" })
  const [saving, setSaving] = React.useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const ok = await onSave({ title: f.title.trim(), detail: f.detail.trim(), achieved_on: f.date ? `${f.date}-01` : null })
    setSaving(false)
    if (ok) {
      setF({ title: "", detail: "", date: "" })
      onOpenChange(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[32px] p-7 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-medium tracking-tight">Add achievement</DialogTitle>
          <DialogDescription>Awards, hackathon results, publications, scholarships…</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <Field label="Title">
            <Input required placeholder="e.g. Winner, Smart India Hackathon" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="Details">
            <Textarea placeholder="What was it for and what did you do?" value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} />
          </Field>
          <Field label="When">
            <Input type="month" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <DialogFooter>
            <Button type="submit" size="lg" disabled={saving || !f.title}>
              {saving && <Loader2 className="animate-spin" />} Save achievement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const MEDALS = [
  { bg: "linear-gradient(145deg,#fbe9a6,#e3b84a)", ink: "oklch(0.42 0.1 80)", tint: "tone-amber" },
  { bg: "linear-gradient(145deg,#eef0f8,#b4bcd6)", ink: "oklch(0.4 0.05 270)", tint: "tone-mist" },
  { bg: "linear-gradient(145deg,#f6d6bd,#cf8f5c)", ink: "oklch(0.42 0.09 50)", tint: "tone-peach" },
]

function Medal({ i }: { i: number }) {
  const m = MEDALS[i % MEDALS.length]
  return (
    <span className="relative flex w-16 shrink-0 flex-col items-center">
      <span className="absolute top-12 left-3 h-6 w-3.5 -rotate-12 bg-(--c-violet)/70 [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)]" aria-hidden />
      <span className="absolute top-12 right-3 h-6 w-3.5 rotate-12 bg-(--c-violet)/45 [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)]" aria-hidden />
      <span
        className="relative flex size-16 items-center justify-center rounded-full shadow-[inset_0_2px_0_oklch(1_0_0/0.7),inset_0_-4px_8px_oklch(0.3_0.05_60/0.18),0_10px_20px_-10px_oklch(0.3_0.08_60/0.5)]"
        style={{ background: m.bg, color: m.ink }}
      >
        <span aria-hidden className="absolute inset-1.5 rounded-full border border-white/55" />
        <TrophyIcon className="relative size-7" />
      </span>
    </span>
  )
}

function AchievementsInner({ x, className }: { x: Extras; className?: string }) {
  const [open, setOpen] = React.useState(false)
  const { items, isDemo } = x.achievements
  return (
    <>
      <Panel className={className} title="Achievements" style={stagger(7)} action={<AddButton onClick={() => setOpen(true)} label="Add" />}>
        {isDemo && <p className="-mt-2 mb-5 text-[14px] text-muted-foreground">Sample data — add your own and it replaces this.</p>}
        <ul className="stagger space-y-4">
          {items.map((a, i) => (
            <li key={a.id} className={cn(MEDALS[i % MEDALS.length].tint, "group/item relative overflow-hidden rounded-[28px] bg-(--t-bg) p-5 shadow-[inset_0_0_0_1px_oklch(1_0_0/0.55)] transition-transform duration-200 hover:-translate-y-0.5")}>
              {a.achieved_on && (
                <span aria-hidden className="pointer-events-none absolute -right-2 -bottom-6 text-[6rem] leading-none font-light tracking-[-0.06em] text-(--t-fg)/[0.07] select-none">
                  {new Date(a.achieved_on).getFullYear()}
                </span>
              )}
              <div className="relative flex items-start gap-5">
                <Medal i={i} />
                <div className="min-w-0 flex-1 pt-1">
                  <p className="text-[18px] leading-snug font-medium tracking-[-0.01em] text-foreground">{a.title}</p>
                  {a.detail && <p className="mt-1.5 text-[14.5px] leading-snug text-foreground/65">{a.detail}</p>}
                  {a.achieved_on && <p className="mt-3 inline-flex rounded-full bg-card/80 px-3 py-1 text-[13px] font-medium text-(--t-fg)">{month(a.achieved_on)}</p>}
                </div>
                {!isDemo && <IconDelete onClick={() => x.removeAchievement(a.id)} label={`Remove ${a.title}`} />}
              </div>
            </li>
          ))}
        </ul>
      </Panel>
      <AchievementDialog open={open} onOpenChange={setOpen} onSave={x.addAchievement} />
    </>
  )
}

/* ── Certifications ──────────────────────────────────────────────────────── */
function CertDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (f: FormData) => Promise<boolean> }) {
  const [f, setF] = React.useState({ name: "", issuer: "", date: "", cid: "", url: "" })
  const [file, setFile] = React.useState<File | null>(null)
  const [saving, setSaving] = React.useState(false)
  const pick = (picked: File) => {
    if (picked.size > 5 * 1024 * 1024) return toast.error("File must be 5 MB or smaller.")
    setFile(picked)
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = new FormData()
    body.append("name", f.name.trim())
    body.append("issuer", f.issuer.trim())
    if (f.date) body.append("issued_on", `${f.date}-01`)
    if (f.cid) body.append("credential_id", f.cid.trim())
    if (f.url) body.append("credential_url", f.url.trim())
    if (file) body.append("file", file)
    setSaving(true)
    const ok = await onSave(body)
    setSaving(false)
    if (ok) {
      setF({ name: "", issuer: "", date: "", cid: "", url: "" })
      setFile(null)
      onOpenChange(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto rounded-[32px] p-7 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-medium tracking-tight">Add certification</DialogTitle>
          <DialogDescription>Upload a copy so recruiters can verify it.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <Field label="Certificate name">
            <Input required placeholder="e.g. AWS Certified Cloud Practitioner" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Issued by">
              <Input required placeholder="e.g. Amazon Web Services" value={f.issuer} onChange={(e) => setF({ ...f, issuer: e.target.value })} />
            </Field>
            <Field label="Issued on">
              <Input type="month" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Credential ID">
              <Input placeholder="Optional" value={f.cid} onChange={(e) => setF({ ...f, cid: e.target.value })} />
            </Field>
            <Field label="Credential link">
              <Input type="url" placeholder="https://…" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
            </Field>
          </div>
          {file ? (
            <div className="flex items-center gap-3 rounded-[22px] border border-(--hairline) bg-card p-3.5">
              <span className="tone-violet flex size-11 shrink-0 items-center justify-center rounded-2xl bg-(--t-bg) text-(--t-fg)"><ApplicationsIcon className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15.5px] font-medium">{file.name}</p>
                <p className="text-[13.5px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button type="button" onClick={() => setFile(null)} className="rounded-full px-3 py-1.5 text-[14px] font-medium text-muted-foreground hover:text-foreground">Remove</button>
            </div>
          ) : (
            <DropZone compact accept="application/pdf,image/png,image/jpeg,image/webp,.pdf" onFile={pick} title="Upload the certificate" hint="PDF or image, up to 5 MB" />
          )}
          <DialogFooter>
            <Button type="submit" size="lg" disabled={saving || !f.name || !f.issuer}>
              {saving && <Loader2 className="animate-spin" />} Save certification
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CertCard({ c, i, demo, onDelete }: { c: Certification; i: number; demo: boolean; onDelete: () => void }) {
  const tone = TONES[i % TONES.length]
  const initial = c.issuer.trim().charAt(0).toUpperCase() || "C"
  return (
    <li className="group/item relative flex flex-col overflow-hidden rounded-[28px] border border-(--hairline) bg-card p-2 shadow-[0_1px_2px_oklch(0.2_0.05_280/0.04),0_16px_30px_-22px_oklch(0.2_0.06_280/0.3)] transition-transform duration-200 hover:-translate-y-0.5">
      <div className={cn(tone, "relative overflow-hidden rounded-[22px] bg-(--t-bg) p-5 shadow-[inset_0_0_0_1px_oklch(1_0_0/0.55)]")}>
        <span aria-hidden className="pointer-events-none absolute -top-6 -right-4 text-[9rem] leading-none font-light tracking-[-0.06em] text-(--t-fg)/[0.08] select-none">{initial}</span>
        <div className="relative flex items-start justify-between gap-3">
          <OrgAvatar name={c.issuer.split("·")[0].trim()} className="size-11 bg-card" />
        </div>
        <p className="relative mt-6 text-[19px] leading-snug font-medium tracking-[-0.01em] text-foreground">{c.name}</p>
        <p className="relative mt-1.5 flex items-center gap-1.5 text-[15.5px] text-foreground/65">{c.issuer}<VerifiedBadge className="size-5" title="Verified credential" /></p>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-3.5 pt-4 pb-3">
        <dl className="grid grid-cols-2 gap-3 text-[14px]">
          <div>
            <dt className="text-muted-foreground">Issued</dt>
            <dd className="mt-0.5 font-medium">{month(c.issued_on) || "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">Credential ID</dt>
            <dd className="mt-0.5 truncate font-medium">{c.credential_id || "—"}</dd>
          </div>
        </dl>
        <div className="mt-auto flex items-center gap-2">
          {c.file ? (
            c.file === "demo" ? (
              <span className="inline-flex h-10 flex-1 items-center gap-2 rounded-full bg-secondary px-4 text-[14.5px] font-medium">
                <ApplicationsIcon className="size-[18px]" /> Certificate attached
              </span>
            ) : (
              <a href={c.file} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 flex-1 items-center gap-2 rounded-full bg-secondary px-4 text-[14.5px] font-medium outline-none transition-colors hover:bg-secondary/70 focus-visible:ring-2 focus-visible:ring-ring">
                <ApplicationsIcon className="size-[18px]" /> View certificate
              </a>
            )
          ) : (
            <span className="inline-flex h-10 flex-1 items-center rounded-full border border-dashed border-border px-4 text-[14.5px] text-muted-foreground">No file attached</span>
          )}
          {!demo && <IconDelete onClick={onDelete} label={`Remove ${c.name}`} />}
        </div>
      </div>
    </li>
  )
}

function CertsInner({ x, className }: { x: Extras; className?: string }) {
  const [open, setOpen] = React.useState(false)
  const { items, isDemo } = x.certs
  return (
    <>
      <Panel className={className} title="Certifications" style={stagger(8)} action={<AddButton onClick={() => setOpen(true)} label="Add certification" />}>
        {isDemo && <p className="-mt-2 mb-5 text-[14px] text-muted-foreground">Sample data — add your own and it replaces this.</p>}
        <ul className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c, i) => (
            <CertCard key={c.id} c={c} i={i} demo={isDemo} onDelete={() => x.removeCert(c.id)} />
          ))}
        </ul>
      </Panel>
      <CertDialog open={open} onOpenChange={setOpen} onSave={x.addCert} />
    </>
  )
}

/** Experience, achievements and certifications, sharing one data hook. */
export function ProfileExtras() {
  const x = useProfileExtras()
  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-12">
        <ExperienceInner x={x} className="lg:col-span-7" />
        <AchievementsInner x={x} className="lg:col-span-5" />
      </div>
      <CertsInner x={x} />
    </>
  )
}
