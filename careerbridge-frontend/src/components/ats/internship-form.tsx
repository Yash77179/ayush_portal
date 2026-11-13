"use client";

/**
 * Create / edit a listing: basics, location, pay, required skills, eligibility rules and screening questions,
 * with a live "how students will see it" preview.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";

import { errorMessage, getSkills } from "@/lib/api";
import { saveInternship, type ManagedInternship, type ScreeningQuestion } from "@/lib/ats";
import { MODE_LABEL, MODE_NOTE, parseDescription, type BrowseInternship } from "@/lib/internship-data";
import { daysUntil, InternshipCard } from "@/components/internship-card";
import { useCompany } from "@/components/org-gate";
import { CloseCircleIcon, PlusIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { Field, FrostStat, OrgAvatar, Panel, TickProgress, stagger } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Form = {
  title: string; description: string; location: string; work_mode: string;
  stipend: string; duration_months: string; openings: string; deadline: string; status: string;
  min_cgpa: string; allowed_branches: string; allowed_degrees: string; graduation_year_min: string; graduation_year_max: string;
};
type SkillPick = { id: number; name: string; is_required: boolean };
type Question = ScreeningQuestion & { key: string };

const KINDS = { text: "Short answer", yesno: "Yes / No", choice: "Multiple choice" };
const STATUS_ITEMS = { draft: "Draft (hidden)", published: "Published (live)", closed: "Closed" };
let qKey = 0;
const newKey = () => `q${++qKey}`;

/** Sticky "how it will look on the job portal" preview — card or full details. */
function PortalPreview({ form, company, now }: { form: Form; company: string; now: number }) {
  const [view, setView] = useState<"card" | "details">("card");
  const days = form.deadline ? daysUntil(form.deadline, now) : 30;
  const asCard: BrowseInternship = {
    id: 0, title: form.title || "Internship title", company_name: company, company_logo: null,
    location: form.location, work_mode: form.work_mode, stipend: form.stipend,
    duration_months: Number(form.duration_months) || 0, deadline: form.deadline || new Date(now + 30 * 86_400_000).toISOString().slice(0, 10),
    status: form.status, openings: Number(form.openings) || 0, skills_count: 0,
  };
  const blocks = parseDescription(form.description || "Describe the role and it will appear here.");

  return (
    <div className="scene rise overflow-hidden rounded-[34px] border border-(--hairline) p-5 sm:p-6 lg:sticky lg:top-24" style={stagger(2)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-medium">Portal preview</p>
          <p className="text-[12.5px] text-foreground/60">How students will see this listing</p>
        </div>
        <div className="flex gap-1 rounded-full border border-white/60 bg-white/45 p-1 backdrop-blur-md" role="tablist" aria-label="Preview type">
          {(["card", "details"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] font-medium capitalize transition-[background-color,color,transform] duration-200 ease-(--ease-out) active:scale-95",
                view === v ? "bg-card text-foreground shadow-sm" : "text-foreground/60 hover:text-foreground"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "card" ? (
        <div key="card" className="rise">
          <InternshipCard internship={asCard} now={now} index={0} preview className="!animate-none bg-card/80 backdrop-blur-xl" />
        </div>
      ) : (
        <div key="details" className="rise space-y-3">
          <div className="frost rounded-[26px] p-5">
            <div className="flex items-center gap-3">
              <OrgAvatar name={company} className="size-11" />
              <p className="truncate text-[14px] font-medium">{company}</p>
              <Badge variant={form.status === "published" ? "success" : "warning"} className="ml-auto">
                {form.status === "published" ? "Live" : form.status === "closed" ? "Closed" : "Draft"}
              </Badge>
            </div>
            <h2 className="mt-4 text-[1.6rem] leading-tight break-words">{form.title || "Internship title"}</h2>
            <p className="mt-2 text-[13px] text-muted-foreground">
              {form.location || "Location"} · {MODE_LABEL[form.work_mode]} · {form.duration_months || 0} months
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FrostStat label="Stipend" value={<>₹{Number(form.stipend || 0).toLocaleString("en-IN")}</>} caption="per month" className="!p-4" />
            <FrostStat label="Openings" value={Number(form.openings) || 0} caption={`${days > 0 ? days : 0} days left`} className="!p-4" />
          </div>

          <div className="frost rounded-[26px] p-5">
            <p className="text-[13px] text-muted-foreground">Who can apply</p>
            <p className="mt-1.5 text-[14px] leading-relaxed">
              {[
                form.min_cgpa && `CGPA ${form.min_cgpa}+`,
                form.allowed_branches && form.allowed_branches,
                form.allowed_degrees && form.allowed_degrees,
                (form.graduation_year_min || form.graduation_year_max) && `Batch ${form.graduation_year_min || "…"}–${form.graduation_year_max || "…"}`,
              ]
                .filter(Boolean)
                .join(" · ") || "Open to everyone"}
            </p>
          </div>

          <div className="frost rounded-[26px] p-5">
            <p className="text-[13px] text-muted-foreground">Apply before</p>
            <p className="mt-1.5 text-[1.1rem] font-medium">
              {form.deadline ? new Date(form.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Pick a deadline"}
            </p>
            <TickProgress className="mt-3 h-6" value={Math.max(0, Math.min(100, (days / 30) * 100))} ticks={24} />
          </div>

          <div className="frost rounded-[26px] p-5">
            <p className="text-[13px] text-muted-foreground">About the role</p>
            <div className="mt-2 space-y-2 text-[13.5px] leading-relaxed">
              {blocks.slice(0, 2).map((b, i) =>
                b.kind === "p" ? (
                  <p key={i} className="line-clamp-4">{b.text}</p>
                ) : (
                  <ul key={i} className="space-y-1">
                    {b.items.slice(0, 3).map((it) => (
                      <li key={it} className="flex gap-2"><span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-current opacity-40" />{it}</li>
                    ))}
                  </ul>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SkillPicker({ value, onChange }: { value: SkillPick[]; onChange: (v: SkillPick[]) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    const t = setTimeout(() => {
      getSkills(q)
        .then((d) => setHits(((Array.isArray(d) ? d : (d as { results?: { id: number; name: string }[] }).results) ?? []) as { id: number; name: string }[]))
        .catch(() => setHits([]));
    }, 180);
    return () => clearTimeout(t);
  }, [q]);
  const chosen = new Set(value.map((s) => s.id));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {value.length === 0 && <p className="text-[15px] text-muted-foreground">No skills yet — they power the match score that students and your team see.</p>}
        {value.map((s) => (
          <span
            key={s.id}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border py-1 pr-1.5 pl-3 text-[14.5px]",
              s.is_required ? "border-foreground/20 bg-card" : "border-dashed border-border bg-secondary"
            )}
          >
            {s.name}
            <button
              type="button"
              onClick={() => onChange(value.map((x) => (x.id === s.id ? { ...x, is_required: !x.is_required } : x)))}
              className="rounded-full px-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"
              title="Switch between required and nice to have"
            >
              {s.is_required ? "required" : "nice to have"}
            </button>
            <button type="button" aria-label={`Remove ${s.name}`} onClick={() => onChange(value.filter((x) => x.id !== s.id))} className="text-muted-foreground hover:text-foreground">
              <CloseCircleIcon className="size-4" />
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search skills (React, SQL, Figma…)" className="pl-10" />
      </div>
      <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
        {hits
          .filter((h) => !chosen.has(h.id))
          .slice(0, 24)
          .map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => onChange([...value, { id: h.id, name: h.name, is_required: true }])}
              className="rounded-full bg-secondary px-2.5 py-1 text-[13.5px] transition-colors hover:bg-foreground hover:text-background"
            >
              + {h.name}
            </button>
          ))}
      </div>
    </div>
  );
}

function QuestionEditor({ q, onChange, onRemove }: { q: Question; onChange: (q: Question) => void; onRemove: () => void }) {
  const choices = q.kind === "yesno" ? ["Yes", "No"] : q.choices;
  const knockoutItems = { none: "No knockout", ...Object.fromEntries(choices.filter(Boolean).map((c) => [c, `Must answer “${c}”`])) };
  return (
    <div className="space-y-3 rounded-[22px] border border-(--hairline) p-4">
      <div className="flex gap-2">
        <Input value={q.text} onChange={(e) => onChange({ ...q, text: e.target.value })} placeholder="e.g. Can you join full-time from January?" />
        <Button type="button" size="icon" variant="ghost" aria-label="Remove question" onClick={onRemove}>
          <TrashIcon />
        </Button>
      </div>
      <div className="grid items-center gap-3 sm:grid-cols-2">
        <Select
          value={q.kind}
          items={KINDS}
          onValueChange={(v) => v && onChange({ ...q, kind: v as Question["kind"], knockout_answer: "", choices: v === "choice" ? (q.choices.length ? q.choices : ["", ""]) : [] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(KINDS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-[15px]">
          <input type="checkbox" checked={q.required} onChange={(e) => onChange({ ...q, required: e.target.checked })} className="size-4 accent-foreground" />
          Required
        </label>
      </div>
      {q.kind === "choice" && (
        <div className="space-y-2">
          {q.choices.map((c, i) => (
            <div key={i} className="flex gap-2">
              <Input value={c} onChange={(e) => onChange({ ...q, choices: q.choices.map((x, j) => (j === i ? e.target.value : x)) })} placeholder={`Option ${i + 1}`} />
              {q.choices.length > 2 && (
                <Button type="button" size="icon" variant="ghost" aria-label="Remove option" onClick={() => onChange({ ...q, choices: q.choices.filter((_, j) => j !== i) })}>
                  <CloseCircleIcon />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...q, choices: [...q.choices, ""] })}>
            <PlusIcon /> Option
          </Button>
        </div>
      )}
      {q.kind !== "text" && (
        <Field label="Knockout" hint="Any other answer rejects the application automatically. Choose “No knockout” to just collect the answer.">
          <Select value={q.knockout_answer || "none"} items={knockoutItems} onValueChange={(v) => onChange({ ...q, knockout_answer: v === "none" || !v ? "" : String(v) })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(knockoutItems).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </div>
  );
}

export function InternshipForm({ initial }: { initial?: ManagedInternship }) {
  const router = useRouter();
  const { membership } = useCompany();
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(0);
  const [form, setForm] = useState<Form>(() => ({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    location: initial?.location ?? "",
    work_mode: initial?.work_mode ?? "onsite",
    stipend: initial ? String(Number(initial.stipend)) : "0",
    duration_months: String(initial?.duration_months ?? 3),
    openings: String(initial?.openings ?? 1),
    deadline: initial?.deadline ?? "",
    status: initial?.status ?? "draft",
    min_cgpa: initial?.min_cgpa ?? "",
    allowed_branches: initial?.allowed_branches ?? "",
    allowed_degrees: initial?.allowed_degrees ?? "",
    graduation_year_min: initial?.graduation_year_min ? String(initial.graduation_year_min) : "",
    graduation_year_max: initial?.graduation_year_max ? String(initial.graduation_year_max) : "",
  }));
  const [skills, setSkills] = useState<SkillPick[]>(() =>
    (initial?.internship_skills ?? []).map((s) => ({ id: s.skill.id, name: s.skill.name, is_required: s.is_required }))
  );
  const [questions, setQuestions] = useState<Question[]>(() => (initial?.screening_questions ?? []).map((q) => ({ ...q, key: newKey() })));

  useEffect(() => {
    const id = requestAnimationFrame(() => setNow(Date.now()));
    return () => cancelAnimationFrame(id);
  }, []);

  const set = (key: keyof Form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const num = (v: string) => (v === "" ? null : Number(v));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await saveInternship(
        {
          ...form,
          stipend: Number(form.stipend),
          duration_months: Number(form.duration_months),
          openings: Number(form.openings),
          min_cgpa: form.min_cgpa === "" ? null : form.min_cgpa,
          graduation_year_min: num(form.graduation_year_min),
          graduation_year_max: num(form.graduation_year_max),
          skills: skills.map((s) => ({ skill_id: s.id, is_required: s.is_required })),
          questions: questions
            .filter((q) => q.text.trim())
            .map((q) => ({ text: q.text, kind: q.kind, required: q.required, knockout_answer: q.knockout_answer ?? "", choices: q.choices.filter(Boolean) })),
        },
        initial?.id
      );
      toast.success(initial ? "Listing updated" : saved.status === "published" ? "Internship published" : "Draft saved");
      router.push("/dashboard/company/internships");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the internship."));
    } finally {
      setSaving(false);
    }
  };

  const statusItems = initial ? STATUS_ITEMS : { draft: STATUS_ITEMS.draft, published: STATUS_ITEMS.published };

  return (
    <form onSubmit={handleSubmit} className="grid items-start gap-5 lg:grid-cols-12">
      <div className="min-w-0 space-y-5 lg:col-span-7">
        <Panel title="Basics" style={stagger(1)} contentClassName="space-y-5">
          <Field label="Job title *">
            <Input placeholder="e.g. Frontend Developer Intern" value={form.title} onChange={(e) => set("title", e.target.value)} required />
          </Field>
          <Field label="Description *" hint="Tip: put a heading on its own line, then bullets starting with “- ”.">
            <Textarea
              placeholder={"Describe the role…\n\nWhat you'll do\n- Build features\n- Fix bugs"}
              rows={8}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              required
            />
          </Field>
        </Panel>

        <div className="grid gap-5 md:grid-cols-2">
          <Panel title="Location" tone="mist" style={stagger(2)} contentClassName="space-y-5">
            <Field label="City">
              <Input placeholder="Bengaluru, India" value={form.location} onChange={(e) => set("location", e.target.value)} />
            </Field>
            <Field label="Work mode">
              <Select value={form.work_mode} items={MODE_LABEL} onValueChange={(v) => v && set("work_mode", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MODE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <p className="text-[14.5px] leading-relaxed text-muted-foreground">{MODE_NOTE[form.work_mode]}</p>
          </Panel>

          <Panel title="Compensation" tone="sage" style={stagger(3)} contentClassName="space-y-5">
            <Field label="Monthly stipend (₹)">
              <Input type="number" min="0" placeholder="15000" value={form.stipend} onChange={(e) => set("stipend", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Months">
                <Input type="number" min="1" max="24" value={form.duration_months} onChange={(e) => set("duration_months", e.target.value)} />
              </Field>
              <Field label="Openings">
                <Input type="number" min="1" value={form.openings} onChange={(e) => set("openings", e.target.value)} />
              </Field>
            </div>
          </Panel>
        </div>

        <Panel title="Skills" style={stagger(4)}>
          <SkillPicker value={skills} onChange={setSkills} />
        </Panel>

        <Panel title="Eligibility" style={stagger(5)} contentClassName="space-y-5">
          <p className="text-[14.5px] text-muted-foreground">Students who don’t meet these can’t apply, and they’re told exactly why. Leave a field blank for no rule.</p>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Minimum CGPA">
              <Input type="number" step="0.01" min="0" max="10" placeholder="e.g. 7.0" value={form.min_cgpa} onChange={(e) => set("min_cgpa", e.target.value)} />
            </Field>
            <Field label="Graduating from">
              <Input type="number" min="2000" max="2100" placeholder="2026" value={form.graduation_year_min} onChange={(e) => set("graduation_year_min", e.target.value)} />
            </Field>
            <Field label="Graduating until">
              <Input type="number" min="2000" max="2100" placeholder="2027" value={form.graduation_year_max} onChange={(e) => set("graduation_year_max", e.target.value)} />
            </Field>
          </div>
          <Field label="Branches" hint="Comma-separated, e.g. CSE, IT, ECE">
            <Input value={form.allowed_branches} onChange={(e) => set("allowed_branches", e.target.value)} placeholder="Any branch" />
          </Field>
          <Field label="Degrees" hint="Comma-separated, e.g. B.Tech, BCA, MCA">
            <Input value={form.allowed_degrees} onChange={(e) => set("allowed_degrees", e.target.value)} placeholder="Any degree" />
          </Field>
        </Panel>

        <Panel
          title="Screening questions"
          style={stagger(6)}
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setQuestions((qs) => [...qs, { key: newKey(), text: "", kind: "yesno", choices: [], required: true, knockout_answer: "" }])}
            >
              <PlusIcon /> Question
            </Button>
          }
          contentClassName="space-y-3"
        >
          {questions.length === 0 && <p className="text-[15px] text-muted-foreground">Optional. Ask a few quick questions when students apply — availability, relocation, a portfolio link.</p>}
          {questions.map((q) => (
            <QuestionEditor
              key={q.key}
              q={q}
              onChange={(nq) => setQuestions((qs) => qs.map((x) => (x.key === q.key ? nq : x)))}
              onRemove={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}
            />
          ))}
        </Panel>

        <Panel title="Publishing" style={stagger(7)} contentClassName="grid gap-5 sm:grid-cols-2">
          <Field label="Application deadline *">
            <Input type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} required />
          </Field>
          <Field label="Status">
            <Select value={form.status} items={statusItems} onValueChange={(v) => v && set("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusItems).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Panel>

        <div className="flex justify-end gap-3">
          <Button variant="outline" size="lg" type="button" render={<Link href="/dashboard/company/internships" />} nativeButton={false}>
            Cancel
          </Button>
          <Button size="lg" type="submit" disabled={saving} className="px-8">
            {saving && <Loader2 className="animate-spin" />}
            {initial ? "Save changes" : form.status === "published" ? "Publish internship" : "Save draft"}
          </Button>
        </div>
      </div>

      <div className="min-w-0 lg:col-span-5">{now > 0 && <PortalPreview form={form} company={membership.company.name} now={now} />}</div>
    </form>
  );
}
