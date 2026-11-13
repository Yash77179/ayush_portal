"use client"

/**
 * Recruiters belong to a company and placement officers to a university. These gates load that link once,
 * share it with every page underneath, and show a short set-up form until it exists.
 */

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { errorMessage } from "@/lib/api"
import { createCompany, getMyCompany, getMyUniversity, linkUniversity, type MyCompany, type MyUniversity } from "@/lib/ats"
import { BuildingsIcon, GraduateIcon } from "@/components/icons"
import { Field, PageHeader, Panel, stagger } from "@/components/kit"
import { UniversityCombobox, type UniversityOption } from "@/components/university-combobox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

function Spinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

const isMissing = (err: unknown, key: string) => err instanceof Error && err.message.includes(key)

/* ── Company ─────────────────────────────────────────────────────────────── */
interface CompanyCtx {
  membership: MyCompany
  canManage: boolean
  isAdmin: boolean
  refresh: () => Promise<void>
}
const CompanyContext = React.createContext<CompanyCtx | null>(null)

export function useCompany() {
  const ctx = React.useContext(CompanyContext)
  if (!ctx) throw new Error("useCompany must be used inside <CompanyGate>")
  return ctx
}

export function CompanyGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<{ loading: boolean; membership: MyCompany | null; error: string | null }>({
    loading: true,
    membership: null,
    error: null,
  })

  const refresh = React.useCallback(
    () =>
      getMyCompany()
        .then((m) => setState({ loading: false, membership: m, error: null }))
        .catch((err) => setState({ loading: false, membership: null, error: isMissing(err, "no_company") ? null : errorMessage(err) })),
    []
  )

  React.useEffect(() => {
    refresh()
  }, [refresh])

  const value = React.useMemo<CompanyCtx | null>(
    () =>
      state.membership
        ? {
            membership: state.membership,
            canManage: state.membership.role !== "interviewer",
            isAdmin: state.membership.role === "admin",
            refresh,
          }
        : null,
    [state.membership, refresh]
  )

  if (state.loading) return <Spinner />
  if (state.error)
    return (
      <Panel title="Couldn't load your company">
        <p className="text-muted-foreground">{state.error}</p>
        <Button className="mt-5" onClick={refresh}>
          Try again
        </Button>
      </Panel>
    )
  if (!value) return <CompanySetup onDone={(m) => setState({ loading: false, membership: m, error: null })} />
  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}

const SIZES = { startup: "Startup (1–50)", small: "Small (51–200)", medium: "Medium (201–1000)", large: "Large (1000+)" }

function CompanySetup({ onDone }: { onDone: (m: MyCompany) => void }) {
  const [form, setForm] = React.useState({ name: "", industry: "", size: "", location: "", website: "", description: "" })
  const [saving, setSaving] = React.useState(false)
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const m = await createCompany(form)
      toast.success(`${m.company.name} is set up — you're its admin`)
      onDone(m)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Set up your company"
        subtitle="Recruiting on CareerBridge happens as a company team. Create your company's page — you'll be its admin and can invite colleagues."
      />
      <form onSubmit={submit}>
        <Panel style={stagger(1)} contentClassName="space-y-5 pt-6">
          <div className="flex items-center gap-3 rounded-2xl bg-secondary p-4 text-[15px] text-muted-foreground">
            <BuildingsIcon className="size-5 shrink-0" />
            Already on CareerBridge? Ask your company admin to add you from <span className="font-medium text-foreground">Company → Team</span> using your sign-in email.
          </div>
          <Field label="Company name *">
            <Input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Nova Tech Pvt. Ltd." />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Industry">
              <Input value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="Software, Fintech…" />
            </Field>
            <Field label="Size">
              <Select value={form.size} items={SIZES} onValueChange={(v) => set("size", String(v ?? ""))}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a size" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SIZES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Headquarters">
              <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Bengaluru" />
            </Field>
            <Field label="Website">
              <Input type="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
            </Field>
          </div>
          <Field label="About">
            <Textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What you build and who you are." />
          </Field>
          <div className="flex justify-end">
            <Button size="lg" type="submit" disabled={saving || form.name.trim().length < 2}>
              {saving && <Loader2 className="animate-spin" />} Create company
            </Button>
          </div>
        </Panel>
      </form>
    </div>
  )
}

/* ── University ──────────────────────────────────────────────────────────── */
interface UniversityCtx {
  data: MyUniversity
  refresh: () => Promise<void>
}
const UniversityContext = React.createContext<UniversityCtx | null>(null)

export function useUniversity() {
  const ctx = React.useContext(UniversityContext)
  if (!ctx) throw new Error("useUniversity must be used inside <UniversityGate>")
  return ctx
}

export function UniversityGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<{ loading: boolean; data: MyUniversity | null; error: string | null }>({
    loading: true,
    data: null,
    error: null,
  })
  const refresh = React.useCallback(
    () =>
      getMyUniversity()
        .then((data) => setState({ loading: false, data, error: null }))
        .catch((err) => setState({ loading: false, data: null, error: isMissing(err, "no_university") ? null : errorMessage(err) })),
    []
  )
  React.useEffect(() => {
    refresh()
  }, [refresh])
  const value = React.useMemo(() => (state.data ? { data: state.data, refresh } : null), [state.data, refresh])

  if (state.loading) return <Spinner />
  if (state.error)
    return (
      <Panel title="Couldn't load your university">
        <p className="text-muted-foreground">{state.error}</p>
        <Button className="mt-5" onClick={refresh}>
          Try again
        </Button>
      </Panel>
    )
  if (!value) return <UniversitySetup onDone={(d) => setState({ loading: false, data: d, error: null })} />
  return <UniversityContext.Provider value={value}>{children}</UniversityContext.Provider>
}

function UniversitySetup({ onDone }: { onDone: (d: MyUniversity) => void }) {
  const [uni, setUni] = React.useState<UniversityOption | null>(null)
  const [title, setTitle] = React.useState("Training & Placement Officer")
  const [saving, setSaving] = React.useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uni) return
    setSaving(true)
    try {
      const d = await linkUniversity({ university_id: uni.id, title })
      toast.success(d.is_admin ? `You're the placement cell admin for ${d.university.name}` : `Joined ${d.university.name}'s placement cell`)
      onDone(d)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader title="Link your university" subtitle="Your placement-cell tools work on your own university's students, drives and reports." />
      <form onSubmit={submit}>
        <Panel style={stagger(1)} contentClassName="space-y-5 pt-6">
          <div className="flex items-center gap-3 rounded-2xl bg-secondary p-4 text-[15px] text-muted-foreground">
            <GraduateIcon className="size-5 shrink-0" />
            The first officer to link a university becomes its placement-cell admin. Colleagues who link later join your team.
          </div>
          <Field label="University *" hint="Not in the list? Type its full name and add it.">
            <UniversityCombobox value={uni} onChange={setUni} />
          </Field>
          <Field label="Your role">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Training & Placement Officer" />
          </Field>
          <div className="flex justify-end">
            <Button size="lg" type="submit" disabled={!uni || saving}>
              {saving && <Loader2 className="animate-spin" />} Link university
            </Button>
          </div>
        </Panel>
      </form>
    </div>
  )
}
