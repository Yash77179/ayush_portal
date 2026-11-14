"use client"

/**
 * Recruiters belong to a company and placement officers to a university. These gates load that link once,
 * share it with every page underneath, and show a short set-up form until it exists.
 */

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { errorMessage } from "@/lib/api"
import { createCompany, getMyCompany, getMyUniversity, linkUniversity, withdrawUniversityRequest, type MyCompany, type MyUniversity, type UniversityRequest } from "@/lib/ats"
import { useAuth } from "@/contexts/auth-context"
import { BrandMark } from "@/components/brand-mark"
import { BuildingsIcon, ClockIcon, GraduateIcon } from "@/components/icons"
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
/*
 * A placement officer's first steps, before anything else: link your university, which sends a request, then wait
 * until it's approved (by the placement cell's admins, or by CareerBridge if you'd be its first admin). Until then
 * they see only these screens, full screen, with no dashboard behind (see UniversityAccess, used by the app shell).
 */
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

type UniState = { loading: boolean; data: MyUniversity | UniversityRequest | null; error: string | null }

/** Loads the placement-cell link: approved, a request waiting, or nothing yet. */
function useUniversityLink() {
  const [state, setState] = React.useState<UniState>({ loading: true, data: null, error: null })
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
  return { state, setState, refresh }
}

/**
 * Wraps the whole signed-in app for placement officers: until their placement cell has approved them, they see only
 * the link / waiting screen, full screen, and nothing else of CareerBridge.
 */
export function UniversityAccess({ children }: { children: React.ReactNode }) {
  const { state, setState, refresh } = useUniversityLink()
  if (state.loading) return <FullScreen><Loader2 className="size-6 animate-spin text-muted-foreground" /></FullScreen>
  if (state.data?.status === "active") return <>{children}</>
  if (state.error)
    return (
      <FullScreen>
        <OnboardingCard title="Couldn't load your university" subtitle={state.error}>
          <Button size="lg" onClick={refresh}>
            Try again
          </Button>
        </OnboardingCard>
      </FullScreen>
    )
  return (
    <FullScreen>
      {state.data?.status === "pending" ? (
        <UniversityWaiting request={state.data} onChange={refresh} />
      ) : (
        <UniversitySetup onDone={(d) => setState({ loading: false, data: d, error: null })} />
      )}
    </FullScreen>
  )
}

/** For the placement-cell pages: shares the approved link with every page underneath. */
export function UniversityGate({ children }: { children: React.ReactNode }) {
  const { state, refresh } = useUniversityLink()
  const data = state.data?.status === "active" ? state.data : null
  const value = React.useMemo(() => (data ? { data, refresh } : null), [data, refresh])
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
  if (!value) return <Spinner /> // (UniversityAccess shows the link / waiting screen in front of this)
  return <UniversityContext.Provider value={value}>{children}</UniversityContext.Provider>
}

function FullScreen({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth()
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background px-5 pt-5 pb-10 sm:px-8 sm:pt-7">
      {/* a soft pool of violet behind the card */}
      <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 h-[46rem] w-[min(70rem,160vw)] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,oklch(0.9_0.07_295/0.55),transparent)]" />
      <div className="relative flex items-center justify-between">
        <span className="flex items-center gap-3">
          <BrandMark className="size-10" />
          <span className="text-[17px] font-medium">CareerBridge</span>
        </span>
        <Button variant="ghost" onClick={logout}>
          Sign out
        </Button>
      </div>
      <div className="relative flex w-full flex-1 items-center justify-center py-8">{children}</div>
    </div>
  )
}

function OnboardingCard({ title, subtitle, icon, children }: { title: string; subtitle: React.ReactNode; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[44rem] rounded-[32px] border border-(--hairline) bg-card p-7 shadow-[0_40px_90px_-50px_oklch(0.3_0.1_285/0.45)] sm:p-12">
      {icon && <span className="mb-6 flex size-16 items-center justify-center rounded-[22px] bg-secondary [&_svg]:size-8">{icon}</span>}
      <h1 className="text-[clamp(2.1rem,5vw,3.2rem)] leading-[1.02] font-medium tracking-[-0.03em]">{title}</h1>
      <p className="mt-4 text-[clamp(1rem,1.6vw,1.15rem)] leading-relaxed text-muted-foreground">{subtitle}</p>
      <div className="mt-9">{children}</div>
    </div>
  )
}

function UniversitySetup({ onDone }: { onDone: (d: UniversityRequest) => void }) {
  const [uni, setUni] = React.useState<UniversityOption | null>(null)
  const [title, setTitle] = React.useState("Training & Placement Officer")
  const [saving, setSaving] = React.useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uni) return
    setSaving(true)
    try {
      onDone(await linkUniversity({ university_id: uni.id, title }))
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <OnboardingCard
      icon={<GraduateIcon />}
      title="Link your university"
      subtitle="Your placement-cell tools work on your own university's students, drives and reports. Pick it, and we'll ask your placement cell to approve you."
    >
      <form onSubmit={submit} className="space-y-6">
        <Field label="University" hint="Not in the list? Type its full name and add it.">
          <UniversityCombobox value={uni} onChange={setUni} />
        </Field>
        <Field label="Your role">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Training & Placement Officer" className="h-13 text-[16px]" />
        </Field>
        <div className="flex items-center gap-3 rounded-2xl bg-secondary p-4 text-[15px] text-muted-foreground">
          <GraduateIcon className="size-5 shrink-0" />
          Your placement cell&rsquo;s admins approve new members. If you&rsquo;re the first from your university, CareerBridge approves you and you become its admin.
        </div>
        <Button size="lg" type="submit" disabled={!uni || saving} className="h-13 w-full text-[16px]">
          {saving && <Loader2 className="animate-spin" />} Send request
        </Button>
      </form>
    </OnboardingCard>
  )
}

function UniversityWaiting({ request, onChange }: { request: UniversityRequest; onChange: () => Promise<void> }) {
  const [busy, setBusy] = React.useState(false)
  // look again every so often, so the dashboard opens as soon as someone approves
  React.useEffect(() => {
    const t = setInterval(onChange, 15000)
    return () => clearInterval(t)
  }, [onChange])

  const withdraw = async () => {
    setBusy(true)
    try {
      await withdrawUniversityRequest()
      await onChange()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const who = request.approver === "careerbridge" ? "the CareerBridge team" : `${request.university.name}'s placement-cell admins`
  return (
    <OnboardingCard
      icon={<ClockIcon />}
      title="Your request has been sent"
      subtitle={
        <>
          We&rsquo;ve forwarded it to {who}. As soon as they approve you, your placement-cell dashboard opens here.
        </>
      }
    >
      <dl className="grid gap-x-6 gap-y-3 rounded-2xl bg-secondary p-5 text-[15px] sm:grid-cols-[9rem_1fr]">
        <dt className="text-muted-foreground">University</dt>
        <dd className="font-medium">{request.university.name}</dd>
        <dt className="text-muted-foreground">Your role</dt>
        <dd>{request.title || "—"}</dd>
        <dt className="text-muted-foreground">Sent</dt>
        <dd>{new Date(request.requested_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd className="flex items-center gap-2">
          <span className="size-2 animate-pulse rounded-full bg-(--peach-fg)" /> Waiting for approval
        </dd>
      </dl>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button size="lg" onClick={() => onChange()}>
          Check again
        </Button>
        <Button size="lg" variant="ghost" disabled={busy} onClick={withdraw}>
          {busy && <Loader2 className="animate-spin" />} Withdraw and pick another university
        </Button>
      </div>
    </OnboardingCard>
  )
}
