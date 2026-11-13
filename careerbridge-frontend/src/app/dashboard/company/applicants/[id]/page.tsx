"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";

import { useAuth } from "@/contexts/auth-context";
import { errorMessage } from "@/lib/api";
import { mediaUrl } from "@/lib/format";
import {
  ALL_STAGES,
  STAGE_LABEL,
  addNote,
  deleteNote,
  downloadIcs,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  getCandidate,
  moveApplicant,
  rateApplicant,
  setTags,
  timeAgo,
  updateInterview,
  withdrawOffer,
  type CandidateDetail,
  type Interview,
} from "@/lib/ats";
import { useCompany } from "@/components/org-gate";
import {
  EmailDialog,
  FeedbackDialog,
  InterviewDialog,
  MatchPill,
  OfferDialog,
  RECOMMENDATION,
  RejectDialog,
  StarRating,
  TagEditor,
  VerifiedChip,
  emailOne,
} from "@/components/ats/ats-ui";
import {
  ArrowLeftIcon,
  CalendarIcon,
  DownloadIcon,
  GlobalIcon,
  LinkIcon,
  MailIcon,
  PhoneIcon,
  TrashIcon,
  VideoIcon,
} from "@/components/icons";
import { DashboardSkeleton, OrgAvatar, Panel, StatusBadge, stagger } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function CandidatePage() {
  return (
    <React.Suspense fallback={<DashboardSkeleton />}>
      <Candidate />
    </React.Suspense>
  );
}

const EVENT_TEXT: Record<string, (e: CandidateDetail["events"][number]) => string> = {
  applied: (e) => `applied${e.detail ? ` ${e.detail}` : ""}`,
  viewed: () => "opened the application",
  moved: (e) => `moved ${STAGE_LABEL[e.from_status] ?? e.from_status} → ${STAGE_LABEL[e.to_status] ?? e.to_status}${e.detail ? ` (${e.detail})` : ""}`,
  note: (e) => `added a note: “${e.detail}”`,
  rated: (e) => `rated ${e.detail}`,
  tagged: (e) => `set tags: ${e.detail}`,
  emailed: (e) => `emailed “${e.detail}”`,
  interview: (e) => e.detail,
  feedback: (e) => `filed a scorecard — ${e.detail}`,
  offer: (e) => e.detail,
  knockout: (e) => `was auto-rejected by a knockout question (${e.detail.replace("Screening: ", "")})`,
};

function Candidate() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const { canManage, isAdmin } = useCompany();
  const [c, setC] = React.useState<CandidateDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<"interview" | "offer" | "email" | "reject" | "feedback" | null>(() => {
    const action = params.get("action");
    return action === "interview" || action === "offer" ? action : null;
  });
  const [editing, setEditing] = React.useState<Interview | null>(null);
  const [scoring, setScoring] = React.useState<Interview | null>(null);
  const [note, setNote] = React.useState("");
  const [savingNote, setSavingNote] = React.useState(false);

  const load = React.useCallback(
    () =>
      getCandidate(id)
        .then(setC)
        .catch((err) => setError(errorMessage(err, "Candidate not found."))),
    [id]
  );

  React.useEffect(() => {
    load();
  }, [load]);

  // ?action=interview|offer (from the pipeline board) opens that form once; then tidy the URL.
  React.useEffect(() => {
    if (params.get("action")) router.replace(`/dashboard/company/applicants/${id}`, { scroll: false });
  }, [params, router, id]);

  if (error)
    return (
      <Panel title="Couldn't open this candidate">
        <p className="text-muted-foreground">{error}</p>
        <Button className="mt-5" render={<Link href="/dashboard/company/applicants" />} nativeButton={false}>
          Back to applicants
        </Button>
      </Panel>
    );
  if (!c) return <DashboardSkeleton />;

  const s = c.student;
  const resume = s.resume_file ? mediaUrl(s.resume_file) : s.resume_url;
  const closed = c.status === "rejected" || c.status === "selected";
  const liveOffer = c.offer && (c.offer.status === "pending" || c.offer.status === "accepted") && !c.offer.is_expired;

  const move = async (to: string, notify = true) => {
    try {
      await moveApplicant(c.id, to, notify);
      toast.success(`Moved to ${STAGE_LABEL[to]}`);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const onStage = (to: string) => {
    if (to === c.status) return;
    if (to === "offered") return setDialog("offer");
    if (to === "rejected") return setDialog("reject");
    move(to);
  };

  const rate = async (stars: number) => {
    try {
      const r = await rateApplicant(c.id, stars);
      setC({ ...c, my_rating: r.my_rating, avg_rating: r.avg_rating });
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const saveTags = async (tags: string[]) => {
    setC({ ...c, tags });
    try {
      await setTags(c.id, tags);
    } catch (err) {
      toast.error(errorMessage(err));
      load();
    }
  };

  const saveNote = async () => {
    if (!note.trim()) return;
    setSavingNote(true);
    try {
      await addNote(c.id, note.trim());
      setNote("");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingNote(false);
    }
  };

  const interviewAction = async (i: Interview, status: "cancelled" | "completed") => {
    try {
      await updateInterview(i.id, { status });
      toast.success(status === "cancelled" ? "Interview cancelled — the candidate was told" : "Marked as completed");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const stageItems = Object.fromEntries(ALL_STAGES.map((st) => [st, STAGE_LABEL[st]]));

  return (
    <div className="space-y-6">
      <Link href="/dashboard/company/pipeline" className="rise inline-flex items-center gap-2 text-[15px] text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Pipeline
      </Link>

      {/* Header */}
      <section className="rise flex flex-col gap-6 rounded-[32px] border border-(--hairline) bg-card p-6 sm:p-8 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-4 sm:items-center sm:gap-5">
          {c.student_photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(c.student_photo) ?? ""} alt="" className="size-14 shrink-0 rounded-[20px] object-cover sm:size-20 sm:rounded-[24px]" />
          ) : (
            <OrgAvatar name={s.user_name} className="size-14 rounded-[20px] text-xl sm:size-20 sm:rounded-[24px] sm:text-2xl" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="truncate text-[clamp(1.75rem,3vw,2.5rem)] leading-tight font-medium tracking-tight">{s.user_name}</h1>
              <VerifiedChip status={s.verification_status} />
            </div>
            <p className="mt-1 text-[15px] text-muted-foreground">
              {[s.degree, s.branch].filter(Boolean).join(" · ") || "—"}
              {s.university ? ` · ${s.university.name}` : ""}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[14.5px] text-muted-foreground">
              <a href={`mailto:${s.user_email}`} className="inline-flex max-w-full min-w-0 items-center gap-1.5 hover:text-foreground">
                <MailIcon className="size-4 shrink-0" /> <span className="truncate">{s.user_email}</span>
              </a>
              {c.student_phone && (
                <span className="inline-flex items-center gap-1.5">
                  <PhoneIcon className="size-4" /> {c.student_phone}
                </span>
              )}
              {resume && (
                <a href={resume} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline">
                  <DownloadIcon className="size-4" /> Resume
                </a>
              )}
              {s.linkedin_url && (
                <a href={s.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground">
                  <LinkIcon className="size-4" /> LinkedIn
                </a>
              )}
              {s.github_url && (
                <a href={s.github_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground">
                  <GlobalIcon className="size-4" /> GitHub
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:w-80">
          <p className="text-[14.5px] text-muted-foreground">
            {c.internship.title} · applied {timeAgo(c.applied_at)}
            {c.source === "drive" && " · campus drive"}
          </p>
          {canManage ? (
            <Select value={c.status} items={stageItems} onValueChange={(v) => v && onStage(String(v))}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_STAGES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {STAGE_LABEL[st]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <StatusBadge status={c.status} />
          )}
          {canManage && (
            <div className={cn("grid gap-2", closed || liveOffer ? "grid-cols-2" : "grid-cols-3")}>
              {!closed && (
                <Button variant="outline" onClick={() => { setEditing(null); setDialog("interview"); }}>
                  Interview
                </Button>
              )}
              {!closed && !liveOffer && (
                <Button variant="outline" onClick={() => setDialog("offer")}>
                  Offer
                </Button>
              )}
              <Button variant="outline" onClick={() => setDialog("email")}>
                Email
              </Button>
            </div>
          )}
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <div className="min-w-0 space-y-5 lg:col-span-8">
          {/* Offer */}
          {c.offer && (
            <Panel title="Offer" style={stagger(1)} tone={c.offer.status === "accepted" ? "mint" : undefined} action={<OfferBadge offer={c.offer} />}>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[15px] sm:grid-cols-4">
                <Info label="Role" value={c.offer.role_title} />
                <Info label="Stipend" value={`${fmtMoney(c.offer.stipend)}/mo`} />
                <Info label="Starts" value={fmtDate(c.offer.start_date)} />
                <Info label="Reply by" value={fmtDate(c.offer.expires_on)} />
              </dl>
              {c.offer.response_note && <p className="mt-4 rounded-2xl bg-secondary p-3 text-[15px]">“{c.offer.response_note}”</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="outline" render={<Link href={`/offers/${c.offer.id}`} target="_blank" />} nativeButton={false}>
                  Offer letter
                </Button>
                {canManage && c.offer.status === "pending" && (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await withdrawOffer(c.offer!.id);
                        toast.success("Offer withdrawn");
                        load();
                      } catch (err) {
                        toast.error(errorMessage(err));
                      }
                    }}
                  >
                    Withdraw
                  </Button>
                )}
              </div>
            </Panel>
          )}

          {/* Interviews */}
          <Panel
            title="Interviews"
            style={stagger(2)}
            action={canManage && !closed ? <Button size="sm" variant="outline" onClick={() => { setEditing(null); setDialog("interview"); }}>Schedule</Button> : undefined}
            contentClassName="space-y-3"
          >
            {c.interviews.length === 0 && <p className="py-4 text-[15px] text-muted-foreground">No interviews yet.</p>}
            {c.interviews.map((i) => {
              const mine = i.feedback.find((f) => f.author_id === user?.id);
              const onPanel = i.interviewers.some((p) => p.id === user?.id);
              return (
                <div key={i.id} className={cn("rounded-[22px] border border-(--hairline) p-4", i.status === "cancelled" && "opacity-60")}>
                  <div className="grid grid-cols-[auto_1fr] items-start gap-3 sm:grid-cols-[auto_1fr_auto]">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary">
                      {i.mode === "video" ? <VideoIcon className="size-5" /> : i.mode === "phone" ? <PhoneIcon className="size-5" /> : <CalendarIcon className="size-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[17px] font-medium">{i.round_name}</p>
                      <p className="text-[14.5px] text-muted-foreground">
                        {fmtDateTime(i.scheduled_at)} · {i.duration_minutes} min
                        {i.interviewers.length > 0 && ` · ${i.interviewers.map((p) => p.name).join(", ")}`}
                      </p>
                      {i.meeting_link && (
                        <a href={i.meeting_link} target="_blank" rel="noreferrer" className="block truncate text-[14.5px] underline-offset-4 hover:underline">
                          {i.meeting_link}
                        </a>
                      )}
                      {i.location && <p className="text-[14.5px]">{i.location}</p>}
                    </div>
                    <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:flex-col sm:items-end sm:gap-1.5">
                      <Badge variant={i.status === "completed" ? "success" : i.status === "cancelled" ? "danger" : "info"} className="capitalize">
                        {i.status}
                      </Badge>
                      {i.status === "scheduled" && (
                        <span className={cn("text-[13.5px]", i.candidate_response === "confirmed" ? "text-(--mint-fg)" : i.candidate_response === "reschedule" ? "text-(--pink-fg)" : "text-muted-foreground")}>
                          {i.candidate_response === "confirmed" ? "Candidate confirmed" : i.candidate_response === "reschedule" ? "Asked to reschedule" : "Awaiting reply"}
                        </span>
                      )}
                    </div>
                  </div>
                  {i.candidate_note && <p className="mt-3 rounded-2xl bg-secondary p-3 text-[14.5px]">Candidate: “{i.candidate_note}”</p>}
                  {i.feedback.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {i.feedback.map((f) => (
                        <div key={f.id} className="rounded-2xl bg-secondary/70 p-3 text-[14.5px]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{f.author_name}</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[12.5px] font-semibold", RECOMMENDATION[f.recommendation]?.cls)}>
                              {RECOMMENDATION[f.recommendation]?.label}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              Tech {f.technical}/5 · Comm {f.communication}/5 · Culture {f.culture}/5
                            </span>
                          </div>
                          {f.comments && <p className="mt-1.5 text-muted-foreground">{f.comments}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {i.status !== "cancelled" && (onPanel || canManage) && (
                      <Button size="sm" variant={mine ? "ghost" : "outline"} onClick={() => { setScoring(i); setDialog("feedback"); }}>
                        {mine ? "Edit my scorecard" : "Add scorecard"}
                      </Button>
                    )}
                    {i.status !== "cancelled" && (
                      <Button size="sm" variant="ghost" onClick={() => downloadIcs(i.id).catch((e) => toast.error(errorMessage(e)))}>
                        Calendar file
                      </Button>
                    )}
                    {canManage && i.status === "scheduled" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(i); setDialog("interview"); }}>
                          Reschedule
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => interviewAction(i, "completed")}>
                          Mark done
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => interviewAction(i, "cancelled")}>
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </Panel>

          {/* Match */}
          <Panel title="Skill match" style={stagger(3)} action={<MatchPill score={c.match.score} />}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[14.5px] text-muted-foreground">Has</p>
                <div className="flex flex-wrap gap-1.5">
                  {[...c.match.matched_required, ...c.match.matched_preferred].map((n) => (
                    <span key={n} className="rounded-full bg-(--mint-bg) px-2.5 py-1 text-[13.5px] text-(--mint-fg)">{n}</span>
                  ))}
                  {c.match.matched_required.length + c.match.matched_preferred.length === 0 && <span className="text-[15px] text-muted-foreground">None of the listed skills</span>}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[14.5px] text-muted-foreground">Missing (required)</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.match.missing_required.map((n) => (
                    <span key={n} className="rounded-full bg-(--pink-bg) px-2.5 py-1 text-[13.5px] text-(--pink-fg)">{n}</span>
                  ))}
                  {c.match.missing_required.length === 0 && <span className="text-[15px] text-muted-foreground">Nothing — all required skills present</span>}
                </div>
              </div>
            </div>
          </Panel>

          {/* Answers + cover letter */}
          {(c.answers.length > 0 || c.cover_letter) && (
            <Panel title="Application" style={stagger(4)} contentClassName="space-y-4">
              {c.answers.map((a) => (
                <div key={a.question_id}>
                  <p className="text-[14.5px] text-muted-foreground">{a.question}</p>
                  <p className="mt-1 whitespace-pre-wrap">{a.answer}</p>
                </div>
              ))}
              {c.cover_letter && (
                <div>
                  <p className="text-[14.5px] text-muted-foreground">Cover letter</p>
                  <p className="mt-1 whitespace-pre-wrap">{c.cover_letter}</p>
                </div>
              )}
            </Panel>
          )}

          {/* Profile */}
          <Panel title="Profile" style={stagger(5)} contentClassName="space-y-6">
            {s.bio && <p className="whitespace-pre-wrap text-[15px]">{s.bio}</p>}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[15px] sm:grid-cols-4">
              <Info label="CGPA" value={s.cgpa ?? "—"} />
              <Info label="Graduates" value={s.graduation_year ?? "—"} />
              <Info label="Enrollment no." value={s.enrollment_number || "—"} />
              <Info label="University check" value={s.verification_status === "verified" ? "Verified" : "Not verified"} />
            </dl>
            {c.skills.length > 0 && (
              <div>
                <p className="mb-2 text-[14.5px] text-muted-foreground">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.skills.map((sk) => (
                    <span key={sk.name} className="rounded-full bg-secondary px-2.5 py-1 text-[13.5px]">
                      {sk.name} <span className="text-muted-foreground capitalize">· {sk.proficiency}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {c.experiences.length > 0 && (
              <div className="space-y-3">
                <p className="text-[14.5px] text-muted-foreground">Experience</p>
                {c.experiences.map((e) => (
                  <div key={e.id}>
                    <p className="text-[17px] font-medium">
                      {e.title} · {e.company}
                    </p>
                    <p className="text-[14.5px] text-muted-foreground">
                      {fmtDate(e.start_date, { month: "short", year: "numeric" })} – {e.is_current ? "Present" : fmtDate(e.end_date, { month: "short", year: "numeric" })}
                      {e.location && ` · ${e.location}`}
                    </p>
                    {e.description && <p className="mt-1 text-[15px] whitespace-pre-wrap text-muted-foreground">{e.description}</p>}
                  </div>
                ))}
              </div>
            )}
            {c.certifications.length > 0 && (
              <div className="space-y-2">
                <p className="text-[14.5px] text-muted-foreground">Certifications</p>
                {c.certifications.map((ce) => (
                  <p key={ce.id} className="text-[15px]">
                    {ce.credential_url ? (
                      <a href={ce.credential_url} target="_blank" rel="noreferrer" className="font-medium underline-offset-4 hover:underline">{ce.name}</a>
                    ) : (
                      <span className="font-medium">{ce.name}</span>
                    )}{" "}
                    <span className="text-muted-foreground">· {ce.issuer}</span>
                  </p>
                ))}
              </div>
            )}
            {c.achievements.length > 0 && (
              <div className="space-y-2">
                <p className="text-[14.5px] text-muted-foreground">Achievements</p>
                {c.achievements.map((a) => (
                  <p key={a.id} className="text-[15px]">
                    <span className="font-medium">{a.title}</span>
                    {a.detail && <span className="text-muted-foreground"> — {a.detail}</span>}
                  </p>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-5 lg:col-span-4">
          <Panel title="Rating" style={stagger(1)} contentClassName="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px] text-muted-foreground">Your rating</span>
              <StarRating value={c.my_rating} onChange={rate} />
            </div>
            <div className="flex items-center justify-between gap-3 text-[15px]">
              <span className="text-muted-foreground">Team average</span>
              <span className="font-medium tabular-nums">{c.avg_rating ?? "—"}{c.avg_rating !== null && " / 5"}</span>
            </div>
            {c.ratings.length > 0 && (
              <ul className="space-y-1 border-t border-border pt-3 text-[14.5px]">
                {c.ratings.map((r) => (
                  <li key={r.author_name} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{r.author_name}</span>
                    <StarRating value={r.stars} size="sm" readOnly />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Tags" style={stagger(2)}>
            <TagEditor tags={c.tags} onChange={saveTags} />
          </Panel>

          <Panel title="Notes" style={stagger(3)} contentClassName="space-y-3">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Private to your team — the candidate never sees notes." />
            <Button size="sm" onClick={saveNote} disabled={savingNote || !note.trim()}>
              {savingNote && <Loader2 className="animate-spin" />} Add note
            </Button>
            <ul className="-mr-2 max-h-[22rem] space-y-2.5 overflow-y-auto overscroll-contain pt-1 pr-2 [scrollbar-width:thin]">
              {c.notes.map((n) => (
                <li key={n.id} className="group rounded-2xl bg-secondary p-3">
                  <p className="text-[15px] whitespace-pre-wrap">{n.body}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[13.5px] text-muted-foreground">
                    {n.author_name} · {timeAgo(n.created_at)}
                    {(n.author_id === user?.id || isAdmin) && (
                      <button
                        type="button"
                        aria-label="Delete note"
                        className="ml-auto opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={async () => {
                          await deleteNote(n.id).catch((e) => toast.error(errorMessage(e)));
                          load();
                        }}
                      >
                        <TrashIcon className="size-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Activity" style={stagger(4)}>
            <ol className="relative max-h-[28rem] space-y-4 overflow-y-auto overscroll-contain border-l border-border pl-5 [scrollbar-width:thin]">
              {c.events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-card bg-foreground/40" />
                  <p className="text-[14.5px]">
                    <span className="font-medium">{e.actor_name}</span> {(EVENT_TEXT[e.kind] ?? ((x) => x.detail))(e)}
                  </p>
                  <p className="text-[13.5px] text-muted-foreground">{fmtDateTime(e.created_at)}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      <InterviewDialog
        open={dialog === "interview" && canManage}
        onOpenChange={(o) => !o && setDialog(null)}
        applicationId={c.id}
        candidateName={s.user_name}
        existing={editing}
        onSaved={() => load()}
      />
      <OfferDialog
        open={dialog === "offer" && canManage}
        onOpenChange={(o) => !o && setDialog(null)}
        applicationId={c.id}
        candidateName={s.user_name}
        defaults={{ role_title: c.internship.title, stipend: c.internship.stipend, duration_months: c.internship.duration_months, location: c.internship.location }}
        onSaved={() => load()}
      />
      <EmailDialog
        open={dialog === "email"}
        onOpenChange={(o) => !o && setDialog(null)}
        recipients={s.user_name}
        onSend={async (subj, body) => {
          await emailOne(c.id)(subj, body);
          load();
        }}
      />
      <FeedbackDialog
        open={dialog === "feedback"}
        onOpenChange={(o) => !o && setDialog(null)}
        interview={scoring}
        mine={scoring?.feedback.find((f) => f.author_id === user?.id)}
        onSaved={() => load()}
      />
      <RejectDialog open={dialog === "reject"} onOpenChange={(o) => !o && setDialog(null)} count={1} onConfirm={(notify) => move("rejected", notify)} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium">{value}</dd>
    </div>
  );
}

function OfferBadge({ offer }: { offer: NonNullable<CandidateDetail["offer"]> }) {
  if (offer.is_expired) return <Badge variant="danger">Expired</Badge>;
  const v = { pending: "warning", accepted: "success", declined: "danger", withdrawn: "danger" } as const;
  return (
    <Badge variant={v[offer.status]} className="capitalize">
      {offer.status === "pending" ? "Awaiting reply" : offer.status}
    </Badge>
  );
}
