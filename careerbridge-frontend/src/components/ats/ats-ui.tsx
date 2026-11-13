"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import { errorMessage } from "@/lib/api"
import {
  emailApplicant,
  getTeam,
  getTemplates,
  makeOffer,
  scheduleInterview,
  submitFeedback,
  toLocalInput,
  updateInterview,
  type EmailTemplate,
  type Feedback,
  type Interview,
  type Offer,
  type TeamMember,
} from "@/lib/ats"
import { CloseCircleIcon, StarIcon, StarSolidIcon, VerifiedIcon } from "@/components/icons"
import { Field } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

/* ── Small pieces ────────────────────────────────────────────────────────── */
export function StarRating({
  value,
  onChange,
  size = "md",
  readOnly,
}: {
  value: number | null
  onChange?: (v: number) => void
  size?: "sm" | "md"
  readOnly?: boolean
}) {
  const [hover, setHover] = React.useState<number | null>(null)
  const shown = hover ?? value ?? 0
  const cls = size === "sm" ? "size-3.5" : "size-5"
  return (
    <div className="inline-flex items-center gap-0.5" role={readOnly ? "img" : "radiogroup"} aria-label={`Rating: ${value ?? 0} of 5`} onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= Math.round(shown)
        const Icon = on ? StarSolidIcon : StarIcon
        if (readOnly) return <Icon key={n} className={cn(cls, on ? "text-amber-500" : "text-foreground/20")} />
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange?.(value === n ? 0 : n)}
            className="rounded p-0.5 transition-transform duration-150 hover:scale-110 active:scale-90"
          >
            <Icon className={cn(cls, on ? "text-amber-500" : "text-foreground/25")} />
          </button>
        )
      })}
    </div>
  )
}

export function MatchPill({ score }: { score: number }) {
  const tone = score >= 75 ? "bg-(--mint-bg) text-(--mint-fg)" : score >= 40 ? "bg-(--peach-bg) text-(--peach-fg)" : "bg-secondary text-muted-foreground"
  return <span className={cn("rounded-full px-2 py-0.5 text-[12.5px] font-semibold tabular-nums", tone)}>{score}% match</span>
}

export function VerifiedChip({ status }: { status: string }) {
  if (status !== "verified") return null
  return (
    <span title="Enrolment and grades verified by the university" className="inline-flex items-center gap-1 text-[13.5px] font-medium text-(--mint-fg)">
      <VerifiedIcon className="size-3.5" /> Verified
    </span>
  )
}

export function TagEditor({ tags, onChange, disabled }: { tags: string[]; onChange: (tags: string[]) => void; disabled?: boolean }) {
  const [draft, setDraft] = React.useState("")
  const add = () => {
    const t = draft.trim()
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...tags, t])
    setDraft("")
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary py-1 pr-1.5 pl-2.5 text-[13.5px]">
          {t}
          {!disabled && (
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))} className="text-muted-foreground hover:text-foreground">
              <CloseCircleIcon className="size-3.5" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              add()
            }
          }}
          onBlur={add}
          placeholder={tags.length ? "Add tag" : "Add a tag, e.g. strong DSA"}
          className="h-7 min-w-28 flex-1 rounded-full bg-transparent px-2 text-[14.5px] outline-none placeholder:text-muted-foreground"
        />
      )}
    </div>
  )
}

/* ── Email (single or bulk) ──────────────────────────────────────────────── */
export const PLACEHOLDERS = ["{{first_name}}", "{{last_name}}", "{{internship}}", "{{company}}"]

export function EmailDialog({
  open,
  onOpenChange,
  recipients,
  onSend,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  recipients: string
  /** Defaults to emailing one applicant; pass a function for bulk sends. */
  onSend: (subject: string, body: string) => Promise<void>
}) {
  const [templates, setTemplates] = React.useState<EmailTemplate[]>([])
  const [subject, setSubject] = React.useState("")
  const [body, setBody] = React.useState("")
  const [sending, setSending] = React.useState(false)

  React.useEffect(() => {
    if (open) getTemplates().then(setTemplates).catch(() => setTemplates([]))
  }, [open])

  const send = async () => {
    setSending(true)
    try {
      await onSend(subject, body)
      onOpenChange(false)
      setSubject("")
      setBody("")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-[32px] p-7">
        <DialogHeader>
          <DialogTitle className="text-2xl font-medium tracking-tight">Email {recipients}</DialogTitle>
          <DialogDescription>Placeholders are filled in per person: {PLACEHOLDERS.join(" ")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {templates.length > 0 && (
            <Field label="Start from a template">
              <Select
                value=""
                items={Object.fromEntries(templates.map((t) => [String(t.id), t.name]))}
                onValueChange={(v) => {
                  const t = templates.find((x) => String(x.id) === v)
                  if (t) {
                    setSubject(t.subject)
                    setBody(t.body)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Subject">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Next steps for {{internship}}" />
          </Field>
          <Field label="Message">
            <Textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} placeholder={"Hi {{first_name}},\n\n…"} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={send} disabled={sending || !subject.trim() || !body.trim()}>
            {sending && <Loader2 className="animate-spin" />} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function emailOne(applicationId: number) {
  return async (subject: string, body: string) => {
    const r = await emailApplicant(applicationId, subject, body)
    if (r.sent) toast.success("Email sent")
    else toast.warning("Saved to the timeline, but the email couldn't be delivered right now")
  }
}

/* ── Interview scheduling ────────────────────────────────────────────────── */
const MODES = { video: "Video call", phone: "Phone", onsite: "On-site" }

interface InterviewDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  applicationId: number
  candidateName: string
  existing?: Interview | null
  onSaved: (i: Interview) => void
}

export function InterviewDialog(props: InterviewDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92svh] max-w-xl overflow-y-auto rounded-[32px] p-7">
        {props.open && <InterviewForm key={props.existing?.id ?? "new"} {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function blankInterview() {
  const d = new Date(Date.now() + 2 * 86400000)
  d.setHours(11, 0, 0, 0)
  return {
    round_name: "Technical interview",
    scheduled_at: toLocalInput(d),
    duration_minutes: "45",
    mode: "video",
    meeting_link: "",
    location: "",
    instructions: "",
    interviewer_ids: [] as number[],
  }
}

function InterviewForm({ onOpenChange, applicationId, candidateName, existing, onSaved }: InterviewDialogProps) {
  const [team, setTeam] = React.useState<TeamMember[]>([])
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState(() =>
    existing
      ? {
          round_name: existing.round_name,
          scheduled_at: toLocalInput(new Date(existing.scheduled_at)),
          duration_minutes: String(existing.duration_minutes),
          mode: existing.mode as string,
          meeting_link: existing.meeting_link,
          location: existing.location,
          instructions: existing.instructions,
          interviewer_ids: existing.interviewers.map((i) => i.id),
        }
      : blankInterview()
  )

  React.useEffect(() => {
    getTeam()
      .then((t) => setTeam(t.results.filter((m) => m.is_active)))
      .catch(() => setTeam([]))
  }, [])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      const payload = { ...form, duration_minutes: Number(form.duration_minutes), scheduled_at: new Date(form.scheduled_at).toISOString() }
      const i = existing ? await updateInterview(existing.id, payload) : await scheduleInterview(applicationId, payload)
      toast.success(existing ? "Interview updated — the candidate got a new invite" : "Interview scheduled — invite sent with a calendar file")
      onSaved(i)
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl font-medium tracking-tight">{existing ? "Reschedule interview" : `Interview ${candidateName}`}</DialogTitle>
        <DialogDescription>The candidate gets an email with a calendar invite and can confirm or ask to reschedule.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-1">
        <Field label="Round">
          <Input value={form.round_name} onChange={(e) => set("round_name", e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Field label="Date & time">
            <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => set("scheduled_at", e.target.value)} />
          </Field>
          <Field label="Minutes">
            <Input type="number" min={10} max={480} step={5} value={form.duration_minutes} onChange={(e) => set("duration_minutes", e.target.value)} />
          </Field>
        </div>
        <Field label="Format">
          <Select value={form.mode} items={MODES} onValueChange={(v) => v && set("mode", String(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(MODES).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {form.mode === "video" && (
          <Field label="Meeting link *">
            <Input type="url" value={form.meeting_link} onChange={(e) => set("meeting_link", e.target.value)} placeholder="https://meet.google.com/…" />
          </Field>
        )}
        {form.mode === "onsite" && (
          <Field label="Address *">
            <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Office address, floor, who to ask for" />
          </Field>
        )}
        {team.length > 0 && (
          <Field label="Interviewers" hint="They get the invite too and can file a scorecard afterwards.">
            <div className="flex flex-wrap gap-2">
              {team.map((m) => {
                const on = form.interviewer_ids.includes(m.user_id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("interviewer_ids", on ? form.interviewer_ids.filter((x) => x !== m.user_id) : [...form.interviewer_ids, m.user_id])}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[14.5px] transition-colors",
                      on ? "border-foreground bg-foreground text-background" : "border-border hover:bg-secondary"
                    )}
                  >
                    {m.name}
                  </button>
                )
              })}
            </div>
          </Field>
        )}
        <Field label="Notes for the candidate">
          <Textarea rows={3} value={form.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="What to prepare, who they’ll meet…" />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving || !form.scheduled_at}>
          {saving && <Loader2 className="animate-spin" />} {existing ? "Save & re-send invite" : "Schedule & send invite"}
        </Button>
      </DialogFooter>
    </>
  )
}

/* ── Scorecard ───────────────────────────────────────────────────────────── */
export const RECOMMENDATION: Record<string, { label: string; cls: string }> = {
  strong_yes: { label: "Strong hire", cls: "bg-(--mint-bg) text-(--mint-fg)" },
  yes: { label: "Hire", cls: "bg-(--mint-bg) text-(--mint-fg)" },
  no: { label: "No hire", cls: "bg-(--pink-bg) text-(--pink-fg)" },
  strong_no: { label: "Strong no hire", cls: "bg-(--pink-bg) text-(--pink-fg)" },
}

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  interview: Interview | null
  mine?: Feedback | null
  onSaved: (f: Feedback) => void
}

export function FeedbackDialog(props: FeedbackDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg rounded-[32px] p-7">
        {props.open && <FeedbackForm key={`${props.interview?.id}-${props.mine?.id ?? "new"}`} {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function FeedbackForm({ onOpenChange, interview, mine, onSaved }: FeedbackDialogProps) {
  const [form, setForm] = React.useState(() =>
    mine
      ? { technical: mine.technical, communication: mine.communication, culture: mine.culture, recommendation: mine.recommendation as string, comments: mine.comments }
      : { technical: 0, communication: 0, culture: 0, recommendation: "", comments: "" }
  )
  const [saving, setSaving] = React.useState(false)

  const save = async () => {
    if (!interview) return
    setSaving(true)
    try {
      const f = await submitFeedback(interview.id, form as Partial<Feedback>)
      toast.success("Scorecard saved")
      onSaved(f)
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }
  const ready = form.technical && form.communication && form.culture && form.recommendation

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl font-medium tracking-tight">Scorecard</DialogTitle>
        <DialogDescription>{interview ? `${interview.round_name} · ${interview.candidate_name}` : ""}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-1">
        {(["technical", "communication", "culture"] as const).map((k) => (
          <div key={k} className="flex items-center justify-between gap-4 rounded-2xl bg-secondary px-4 py-3">
            <span className="text-[15px] capitalize">{k === "culture" ? "Culture & attitude" : k}</span>
            <StarRating value={form[k] || null} onChange={(v) => setForm((f) => ({ ...f, [k]: v }))} />
          </div>
        ))}
        <Field label="Recommendation">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(RECOMMENDATION).map(([k, v]) => (
              <button
                key={k}
                type="button"
                aria-pressed={form.recommendation === k}
                onClick={() => setForm((f) => ({ ...f, recommendation: k }))}
                className={cn(
                  "h-11 rounded-2xl border text-[15px] font-medium transition-colors",
                  form.recommendation === k ? "border-foreground bg-foreground text-background" : "border-border hover:bg-secondary"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Comments">
          <Textarea rows={4} value={form.comments} onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))} placeholder="Evidence for your scores…" />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving || !ready}>
          {saving && <Loader2 className="animate-spin" />} Save scorecard
        </Button>
      </DialogFooter>
    </>
  )
}

/* ── Offer ───────────────────────────────────────────────────────────────── */
interface OfferDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  applicationId: number
  candidateName: string
  defaults: { role_title: string; stipend: string; duration_months: number; location: string }
  onSaved: (o: Offer) => void
}

export function OfferDialog(props: OfferDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92svh] max-w-xl overflow-y-auto rounded-[32px] p-7">
        {props.open && <OfferForm {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
}

function OfferForm({ onOpenChange, applicationId, candidateName, defaults, onSaved }: OfferDialogProps) {
  const [form, setForm] = React.useState(() => ({
    role_title: defaults.role_title,
    location: defaults.location,
    stipend: String(Number(defaults.stipend)),
    duration_months: String(defaults.duration_months),
    start_date: daysFromNow(30),
    expires_on: daysFromNow(7),
    message: "",
  }))
  const [saving, setSaving] = React.useState(false)
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      const o = await makeOffer(applicationId, { ...form, stipend: Number(form.stipend), duration_months: Number(form.duration_months) })
      toast.success(`Offer sent to ${candidateName}`)
      onSaved(o)
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl font-medium tracking-tight">Offer for {candidateName}</DialogTitle>
        <DialogDescription>They’ll get an email and can accept or decline in the portal. An offer letter is generated for both of you.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-1">
        <Field label="Role">
          <Input value={form.role_title} onChange={(e) => set("role_title", e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Stipend (₹ / month)">
            <Input type="number" min={0} value={form.stipend} onChange={(e) => set("stipend", e.target.value)} />
          </Field>
          <Field label="Duration (months)">
            <Input type="number" min={1} max={24} value={form.duration_months} onChange={(e) => set("duration_months", e.target.value)} />
          </Field>
          <Field label="Start date">
            <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
          </Field>
          <Field label="Reply by">
            <Input type="date" value={form.expires_on} onChange={(e) => set("expires_on", e.target.value)} />
          </Field>
        </div>
        <Field label="Location">
          <Input value={form.location} onChange={(e) => set("location", e.target.value)} />
        </Field>
        <Field label="Personal note (optional)">
          <Textarea rows={3} value={form.message} onChange={(e) => set("message", e.target.value)} placeholder="We loved your system design round…" />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving || !form.role_title || !form.start_date || !form.expires_on}>
          {saving && <Loader2 className="animate-spin" />} Send offer
        </Button>
      </DialogFooter>
    </>
  )
}

/* ── Confirm rejection (it emails the student) ───────────────────────────── */
export function RejectDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  count: number
  onConfirm: (notify: boolean) => Promise<void>
}) {
  const [busy, setBusy] = React.useState(false)
  const run = async (notify: boolean) => {
    setBusy(true)
    try {
      await onConfirm(notify)
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[32px] p-7">
        <DialogHeader>
          <DialogTitle className="text-2xl font-medium tracking-tight">Reject {count === 1 ? "this candidate" : `${count} candidates`}?</DialogTitle>
          <DialogDescription>A kind, standard rejection email goes out so nobody is left waiting. You can move them back later.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" disabled={busy} onClick={() => run(false)}>
            Reject without emailing
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => run(true)}>
            {busy && <Loader2 className="animate-spin" />} Reject & notify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
