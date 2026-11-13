"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";

import { useAuth } from "@/contexts/auth-context";
import { applyToInternship, errorMessage, getInternship, getSkillMatch } from "@/lib/api";
import { getEligibility } from "@/lib/ats";
import { DEMO_ENABLED, demoSkills } from "@/lib/demo";
import {
  MODE_LABEL, MODE_NOTE, getSampleDetail, makeSample, parseDescription,
  type BrowseInternship, type InternshipDetail, type SkillMatch,
} from "@/lib/internship-data";
import { ApplicationsIcon, ArrowLeftIcon, GlobalIcon, SearchIcon, StarIcon, TrophyIcon } from "@/components/icons";
import { daysUntil, InternshipCard } from "@/components/internship-card";
import { Field, FrostStat, Gauge, OrgAvatar, Panel, TickProgress, stagger } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const SIZE_LABEL: Record<string, string> = { startup: "1–50 people", small: "51–200 people", medium: "201–1000 people", large: "1000+ people" };

const PROCESS = [
  { title: "Apply", Icon: ApplicationsIcon, text: "Send your application with an optional cover letter. Your profile and skills go with it." },
  { title: "Review", Icon: SearchIcon, text: "The recruiter looks at your profile, skills and how well they match the role." },
  { title: "Interview", Icon: StarIcon, text: "Shortlisted candidates get an interview invite they can confirm or reschedule." },
  { title: "Offer", Icon: TrophyIcon, text: "Offers arrive in your Applications page — accept or decline, and download the letter." },
];

export default function InternshipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const numId = Number(id);
  const router = useRouter();
  const { user } = useAuth();

  const [detail, setDetail] = useState<InternshipDetail | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiMatch, setApiMatch] = useState<SkillMatch | null>(null);
  const [now, setNow] = useState(0);
  const [applyOpen, setApplyOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [applying, setApplying] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [elig, setElig] = useState<{ eligible: boolean; reasons: string[]; already_applied: boolean } | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setNow(Date.now()));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    let alive = true;
    const fallback = () => {
      if (!alive || !DEMO_ENABLED) return;
      setDetail(getSampleDetail(numId));
      setIsDemo(true);
    };
    getInternship(numId)
      .then((d) => {
        if (!alive) return;
        const x = d as InternshipDetail;
        if (x && Array.isArray(x.internship_skills) && x.company) setDetail(x);
        else fallback();
      })
      .catch(fallback)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [numId]);

  const isStudent = user?.role === "student";

  useEffect(() => {
    if (!isStudent || isDemo || !detail) return;
    let alive = true;
    getSkillMatch(detail.id)
      .then((m) => alive && setApiMatch(m as SkillMatch))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isStudent, isDemo, detail]);

  useEffect(() => {
    if (!isStudent || isDemo || !detail) return;
    getEligibility(detail.id)
      .then(setElig)
      .catch(() => setElig(null));
  }, [isStudent, isDemo, detail]);

  // In sample mode, compute the match locally from the sample skills.
  const match = useMemo<SkillMatch | null>(() => {
    if (!isStudent || !detail) return null;
    if (!isDemo) return apiMatch;
    const mine = new Set(demoSkills.map((s) => s.skill.name));
    const req = detail.internship_skills.filter((s) => s.is_required).map((s) => s.skill.name);
    const pref = detail.internship_skills.filter((s) => !s.is_required).map((s) => s.skill.name);
    const mr = req.filter((n) => mine.has(n));
    const mp = pref.filter((n) => mine.has(n));
    const max = req.length * 3 + pref.length;
    return {
      score: max ? Math.round(((mr.length * 3 + mp.length) / max) * 100) : 100,
      matched_required: mr, missing_required: req.filter((n) => !mine.has(n)),
      matched_preferred: mp, total_required: req.length, total_preferred: pref.length,
    };
  }, [isStudent, detail, isDemo, apiMatch]);

  const related: BrowseInternship[] = useMemo(
    () => (isDemo && detail ? makeSample().filter((i) => i.id !== detail.id).slice(0, 3) : []),
    [isDemo, detail]
  );

  const handleApply = async () => {
    if (!detail) return;
    if (!user) return router.push("/login");
    setApplying(true);
    try {
      const missing = (detail.screening_questions ?? []).filter((q) => q.required && !answers[q.id]?.trim());
      if (missing.length) {
        toast.error("Please answer the required questions.");
        return;
      }
      if (!isDemo)
        await applyToInternship(
          detail.id,
          coverLetter,
          Object.entries(answers)
            .filter(([, v]) => v.trim())
            .map(([k, v]) => ({ question_id: Number(k), answer: v }))
        );
      toast.success("Application submitted", { action: { label: "Track it", onClick: () => router.push("/dashboard/student/applications") } });
      setApplyOpen(false);
      setCoverLetter("");
      setAnswers({});
      setElig((e) => (e ? { ...e, already_applied: true } : e));
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Application failed."));
    } finally {
      setApplying(false);
    }
  };

  if (loading || now === 0) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-44 rounded-[32px]" />
        <div className="grid gap-5 lg:grid-cols-12">
          <Skeleton className="h-96 rounded-[32px] lg:col-span-8" />
          <Skeleton className="h-96 rounded-[32px] lg:col-span-4" />
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="py-24 text-center">
        <p className="text-[26px] font-medium">Internship not found</p>
        <p className="mt-2 text-muted-foreground">It may have been closed or removed.</p>
        <Button className="mt-6" size="lg" render={<Link href="/internships" />} nativeButton={false}>
          Browse internships
        </Button>
      </div>
    );
  }

  const daysLeft = daysUntil(detail.deadline, now);
  const urgent = daysLeft > 0 && daysLeft <= 7;
  const req = detail.internship_skills.filter((s) => s.is_required);
  const pref = detail.internship_skills.filter((s) => !s.is_required);
  const matchedSet = new Set([...(match?.matched_required ?? []), ...(match?.matched_preferred ?? [])]);
  const blocks = parseDescription(detail.description);
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const totalStipend = Number(detail.stipend) * detail.duration_months;

  const big = [
    { label: "Monthly stipend", value: `₹${Number(detail.stipend).toLocaleString("en-IN")}`, unit: "/mo" },
    { label: "Duration", value: String(detail.duration_months), unit: "months" },
    { label: "Openings", value: String(detail.openings), unit: detail.openings === 1 ? "seat" : "seats" },
  ];
  const meta = [
    { label: "Posted", value: detail.created_at ? fmt(detail.created_at) : "Recently" },
    { label: "Apply by", value: fmt(detail.deadline) },
    { label: "Work mode", value: MODE_LABEL[detail.work_mode] ?? detail.work_mode },
    { label: "Location", value: detail.location || "Remote" },
  ];

  const SkillChip = ({ name, required }: { name: string; required: boolean }) => {
    const known = !!match;
    const has = matchedSet.has(name);
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-foreground/[0.045] px-3 py-1.5 text-[13px] text-foreground/80">
        {known && (
          <span
            className="size-1.5 rounded-full"
            style={{ background: has ? "var(--c-mint)" : required ? "var(--c-red)" : "color-mix(in oklab, var(--foreground) 25%, transparent)" }}
            aria-label={has ? "You have this skill" : required ? "Missing" : "Nice to have"}
          />
        )}
        {name}
      </span>
    );
  };

  const skillRow = (label: string, items: typeof req, required: boolean) => (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:gap-4">
      <span className="w-28 shrink-0 pt-1.5 text-[12.5px] text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-2">
        {items.map((s) => (
          <SkillChip key={s.skill.id} name={s.skill.name} required={required} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* ── Compact banner: who and what ── */}
      <section className="scene rise overflow-hidden rounded-[32px] border border-(--hairline) p-5 sm:p-7">
        <Link
          href="/internships"
          className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-[13px] font-medium text-foreground backdrop-blur-md transition-[background-color,transform] duration-150 hover:bg-card/90 active:scale-95"
        >
          <ArrowLeftIcon className="size-4" /> All internships
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <OrgAvatar name={detail.company.name} className="size-11" />
              <div className="leading-tight">
                <p className="flex flex-wrap items-center gap-2 text-[15px] font-medium">
                  {isDemo ? (
                    detail.company.name
                  ) : (
                    <Link href={`/companies/${detail.company.id}`} className="underline-offset-4 hover:underline">
                      {detail.company.name}
                    </Link>
                  )}
                  {detail.company.is_verified && <Badge variant="success">Verified</Badge>}
                  {isDemo && <Badge variant="lime">Sample data</Badge>}
                </p>
                <p className="mt-0.5 text-[13px] text-foreground/60">{detail.company.industry || "Company"}</p>
              </div>
            </div>
            <h1 className="mt-4 max-w-2xl text-[clamp(1.9rem,3.4vw,2.6rem)]">{detail.title}</h1>
            <p className="mt-2 text-[15px] text-foreground/65">
              {detail.location || "Remote"} · {MODE_LABEL[detail.work_mode] ?? detail.work_mode} · {detail.duration_months} months
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {elig?.already_applied ? (
              <Button size="lg" variant="outline" className="bg-card/60" render={<Link href="/dashboard/student/applications" />} nativeButton={false}>
                Applied ✓ Track it
              </Button>
            ) : (
              <Button size="lg" onClick={() => (user ? setApplyOpen(true) : router.push("/login"))} disabled={daysLeft <= 0 || (!!user && !isStudent)}>
                {!user ? "Sign in to apply" : !isStudent ? "Students apply here" : elig && !elig.eligible ? "Check eligibility" : "Apply now"}
              </Button>
            )}
            <Button size="lg" variant="outline" className="border-border bg-card/60 text-foreground backdrop-blur-md hover:bg-card/90" render={<Link href="/internships" />} nativeButton={false}>
              Browse more
            </Button>
          </div>
        </div>
      </section>

      {/* ── Details (left) and key cards (right) ── */}
      <div className="grid items-start gap-5 lg:grid-cols-12">
        <div className="min-w-0 space-y-5 lg:col-span-8">
          <Panel title="About the role" style={stagger(1)} contentClassName="space-y-8">
            {blocks.map((b, i) =>
              b.kind === "p" ? (
                <p key={i} className={cn("leading-relaxed text-foreground/80", i === 0 ? "text-[18px] text-foreground" : "text-[16px]")}>{b.text}</p>
              ) : (
                <div key={i}>
                  {b.heading && <h3 className="mb-3.5 text-[18px] font-medium">{b.heading}</h3>}
                  <ul className="space-y-3">
                    {b.items.map((it) => (
                      <li key={it} className="flex gap-3.5 text-[15.5px] leading-relaxed text-foreground/80">
                        <span className="mt-[10px] size-1.5 shrink-0 rounded-full bg-foreground/40" />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}

          </Panel>

          {(req.length > 0 || pref.length > 0) && (
            <Panel
              title="Skills"
              style={stagger(2)}
              contentClassName="space-y-4"
              action={match ? <span className="text-[13px] text-muted-foreground tabular-nums">{match.score}% match with your profile</span> : undefined}
            >
              {req.length > 0 && skillRow("Required", req, true)}
              {pref.length > 0 && skillRow("Nice to have", pref, false)}
              {match && (
                <p className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-4 text-[12px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full" style={{ background: "var(--c-mint)" }} /> You have this</span>
                  <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full" style={{ background: "var(--c-red)" }} /> Required, missing</span>
                </p>
              )}
            </Panel>
          )}

          <Panel title="At a glance" style={stagger(3)} contentClassName="space-y-0">
            <dl className="grid grid-cols-3 divide-x divide-border pb-7">
              {big.map((x) => (
                <div key={x.label} className="px-3 text-center first:pl-0 last:pr-0">
                  <dt className="text-[13px] text-muted-foreground">{x.label}</dt>
                  <dd className="mt-2.5 text-[2.1rem] leading-none font-light tracking-[-0.045em] tabular-nums">
                    {x.value}
                    <span className="ml-1.5 text-[14px] tracking-normal text-muted-foreground">{x.unit}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <dl className="grid grid-cols-2 gap-y-6 border-t border-border pt-6 sm:grid-cols-4 sm:divide-x sm:divide-border">
              {meta.map((x) => (
                <div key={x.label} className="px-3 text-center first:pl-0 last:pr-0">
                  <dt className="text-[13px] text-muted-foreground">{x.label}</dt>
                  <dd className="mt-1.5 text-[15px] font-medium">{x.value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="How hiring works" style={stagger(4)}>
            <ol className="relative grid gap-9 sm:grid-cols-4 sm:gap-4">
              {/* rail runs centre-to-centre of the first and last node */}
              <span aria-hidden className="absolute top-5 bottom-5 left-5 w-px bg-border sm:hidden" />
              <span aria-hidden className="absolute top-5 right-[12.5%] left-[12.5%] hidden h-px bg-border sm:block">
                <span className="grow-x block h-full w-1/3 bg-foreground/70" />
              </span>
              {PROCESS.map((st, i) => {
                const Icon = st.Icon;
                return (
                  <li key={st.title} className="relative flex gap-4 sm:flex-col sm:items-center sm:gap-0 sm:text-center">
                    <span
                      className={cn(
                        "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border shadow-sm [&_svg]:size-[18px]",
                        i === 0 ? "border-transparent bg-primary text-primary-foreground" : "border-(--hairline) bg-card text-foreground"
                      )}
                    >
                      <Icon />
                    </span>
                    <div className="sm:mt-5">
                      <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">Step {i + 1}</p>
                      <p className="mt-1 text-[17px] font-medium tracking-tight">{st.title}</p>
                      <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground sm:mx-auto sm:max-w-[13rem]">{st.text}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </div>

        <div className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:col-span-4">
          {/* key facts: frosted cards over a colourful scene */}
          <div className="scene rise space-y-3 overflow-hidden rounded-[32px] border border-(--hairline) p-4" style={stagger(1)}>
            <FrostStat
              label="Stipend"
              value={<>₹{Number(detail.stipend).toLocaleString("en-IN")}<span className="ml-1 text-[14px] tracking-normal text-muted-foreground">/mo</span></>}
              caption={`${detail.duration_months} months · ₹${totalStipend.toLocaleString("en-IN")} total`}
            />
            <FrostStat label="Openings" value={detail.openings} caption={`${req.length} required skill${req.length === 1 ? "" : "s"}`} />
            <FrostStat label="Deadline" caption={daysLeft > 0 ? `${daysLeft} days left · ${fmt(detail.deadline)}` : "Deadline passed"}>
              <TickProgress className="mt-3 h-7" value={Math.max(0, Math.min(100, (daysLeft / 30) * 100))} color={urgent ? "var(--c-red)" : "var(--foreground)"} ticks={22} />
            </FrostStat>
          </div>

          {isStudent && match && (
            <div className="rise tone-lime tint dbl rounded-[32px] border p-7 [--r:32px]" style={stagger(2)}>
              <p className="text-[17px] font-medium">Your skill match</p>
              <Gauge className="my-6" value={match.score} label="Match score" />
              <p className="text-[13px] text-muted-foreground">
                {match.missing_required.length === 0
                  ? "You meet every required skill."
                  : `Missing: ${match.missing_required.join(", ")}.`}
              </p>
              <Button variant="outline" className="mt-4 w-full" render={<Link href="/dashboard/student/skills" />} nativeButton={false}>
                Improve my skills
              </Button>
            </div>
          )}

          <Panel title="About the company" style={stagger(3)} contentClassName="space-y-4">
            <div className="flex items-center gap-3">
              <OrgAvatar name={detail.company.name} className="size-11" />
              <div className="leading-tight">
                <p className="font-medium">{detail.company.name}</p>
                <p className="text-[13px] text-muted-foreground">{detail.company.location || detail.location}</p>
              </div>
            </div>
            {detail.company.description && <p className="text-[14px] leading-relaxed text-foreground/75">{detail.company.description}</p>}
            <dl className="space-y-3 border-t border-border pt-4 text-[14px]">
              {detail.company.industry && (
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Industry</dt><dd>{detail.company.industry}</dd></div>
              )}
              {detail.company.size && (
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Size</dt><dd>{SIZE_LABEL[detail.company.size] ?? detail.company.size}</dd></div>
              )}
            </dl>
            {detail.company.website && (
              <Button variant="outline" className="w-full" render={<a href={detail.company.website} target="_blank" rel="noreferrer" />} nativeButton={false}>
                <GlobalIcon /> Visit website
              </Button>
            )}
          </Panel>

          <Panel title="Where & how" tone="mist" style={stagger(4)} contentClassName="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="info">{MODE_LABEL[detail.work_mode] ?? detail.work_mode}</Badge>
              <span className="text-[14px] font-medium">{detail.location || "Remote"}</span>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{MODE_NOTE[detail.work_mode]}</p>
          </Panel>
        </div>
      </div>

      {related.length > 0 && (
        <section className="pt-6">
          <h2 className="mb-5 text-[1.75rem]">More internships</h2>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {related.map((r, i) => (
              <InternshipCard key={r.id} internship={r} now={now} index={i} onApply={() => router.push(`/internships/${r.id}`)} />
            ))}
          </div>
        </section>
      )}

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="rounded-[32px] p-7">
          <DialogHeader>
            <DialogTitle className="text-2xl font-medium tracking-tight">Apply for {detail.title}</DialogTitle>
            <DialogDescription>{detail.company.name} will see your profile and skills with this application.</DialogDescription>
          </DialogHeader>
          {elig && !elig.eligible ? (
            <div className="space-y-3 rounded-2xl bg-(--pink-bg) p-4 text-[14px] text-(--pink-fg)">
              <p className="font-medium">You can’t apply to this one yet:</p>
              <ul className="list-disc space-y-1 pl-5">
                {elig.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <Link href="/dashboard/student/profile" className="inline-block font-medium underline underline-offset-4">
                Update your profile
              </Link>
            </div>
          ) : (
            <div className="max-h-[55svh] space-y-5 overflow-y-auto pr-1">
              {(detail.screening_questions ?? []).map((q) => (
                <Field key={q.id} label={q.text + (q.required ? " *" : "")}>
                  {q.kind === "text" ? (
                    <Textarea rows={2} value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(q.kind === "yesno" ? ["Yes", "No"] : q.choices).map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-pressed={answers[q.id] === c}
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: c }))}
                          className={cn(
                            "rounded-full border px-4 py-2 text-[14px] transition-colors",
                            answers[q.id] === c ? "border-foreground bg-foreground text-background" : "border-border hover:bg-secondary"
                          )}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </Field>
              ))}
              <Field label="Cover letter (optional)">
                <Textarea rows={5} placeholder="Why are you a great fit for this role?" value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>
              {elig && !elig.eligible ? "Close" : "Cancel"}
            </Button>
            {!(elig && !elig.eligible) && (
              <Button onClick={handleApply} disabled={applying}>
                {applying && <Loader2 className="animate-spin" />} Submit application
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
