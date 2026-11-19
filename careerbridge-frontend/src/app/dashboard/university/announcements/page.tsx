"use client";

/**
 * Placement-cell announcements, laid out like a mail composer:
 *   To      — everyone, a branch/batch, one slice of a drive (next round, no-shows…) or hand-picked students
 *   Message — type, title, body, attachments, an event, a link, an expiry, "ask students to acknowledge", pin
 * with a live head-count, the exact card students will see, and a feed of sent notices with read receipts.
 */

import * as React from "react";
import gsap from "gsap";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";

import { errorMessage } from "@/lib/api";
import {
  deleteAnnouncement,
  deleteAnnouncementFile,
  fmtDate,
  fmtDateTime,
  getAnnouncementAcks,
  getAnnouncements,
  getCampusStudents,
  getDrives,
  previewAudience,
  remindAnnouncement,
  saveAnnouncement,
  timeAgo,
  uploadAnnouncementFile,
  type Announcement,
  type AnnouncementAudience,
  type AnnouncementFile,
  type AnnouncementKind,
  type AudiencePreview,
  type CampusStudent,
  type Drive,
  type DriveSegment,
} from "@/lib/ats";
import { AnnouncementCard, FileGlyph, KIND_META, fileSize } from "@/components/announcement-card";
import { useUniversity } from "@/components/org-gate";
import { PeopleChooser } from "@/components/people-chooser";
import { AnnouncementDialog } from "@/components/announcement-dialog";
import {
  AttachIcon,
  CalendarIcon,
  CalendarMarkIcon,
  CheckReadIcon,
  ClockIcon,
  CloseCircleIcon,
  CohortIcon,
  EyeIcon,
  FlagIcon,
  GlobalIcon,
  HourglassIcon,
  LinkIcon,
  MenuDotsIcon,
  PenIcon,
  PeopleIcon,
  PinIcon,
  SearchIcon,
  SendIcon,
  TrashIcon,
  UserCheckIcon,
  UserCrossIcon,
} from "@/components/icons";
import { DashboardSkeleton, OrgAvatar, PageHeader, Panel, stagger } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// ── choices ─────────────────────────────────────────────────────────────────

type IconT = React.ComponentType<{ className?: string }>;

const AUDIENCES: { v: AnnouncementAudience; label: string; Icon: IconT }[] = [
  { v: "everyone", label: "Everyone", Icon: GlobalIcon },
  { v: "cohort", label: "Batch", Icon: CohortIcon },
  { v: "drive", label: "Drive", Icon: CalendarMarkIcon },
  { v: "students", label: "People", Icon: PeopleIcon },
];

const SEGMENTS: { v: DriveSegment; label: string; hint: string; Icon: IconT }[] = [
  { v: "selected", label: "Moving to the next round", hint: "Selected in this drive", Icon: FlagIcon },
  { v: "registered", label: "Everyone registered", hint: "All who signed up", Icon: PeopleIcon },
  { v: "attended", label: "Attended", hint: "Marked present on the day", Icon: UserCheckIcon },
  { v: "missed", label: "Missed the drive", hint: "Registered but didn't attend", Icon: UserCrossIcon },
  { v: "not_selected", label: "Not selected", hint: "Didn't make this round", Icon: CloseCircleIcon },
  { v: "pending", label: "Awaiting a result", hint: "No outcome recorded yet", Icon: ClockIcon },
];

const KIND_ORDER: AnnouncementKind[] = ["update", "round", "reminder", "urgent"];

type Extra = "event" | "link" | "expiry";
type Upload = { key: string; name: string; size: number; file?: AnnouncementFile };
type Template = { label: string; kind: AnnouncementKind; title: string; body: string; ack?: boolean };
type Form = {
  id?: number;
  title: string;
  body: string;
  kind: AnnouncementKind;
  pinned: boolean;
  requireAck: boolean;
  audience: AnnouncementAudience;
  drive: number | null;
  segment: DriveSegment;
  branches: string[];
  year: number | null;
  students: number[];
  eventAt: string;
  venue: string;
  linkUrl: string;
  linkLabel: string;
  expiresAt: string;
};
const EMPTY: Form = {
  title: "", body: "", kind: "update", pinned: false, requireAck: false, audience: "everyone", drive: null, segment: "selected",
  branches: [], year: null, students: [], eventAt: "", venue: "", linkUrl: "", linkLabel: "", expiresAt: "",
};

/** `datetime-local` wants local "YYYY-MM-DDTHH:mm"; the API speaks ISO. */
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

const FIELD = "h-10 rounded-[0.75rem] bg-card px-3 text-[0.875rem] ring-1 ring-(--hairline) outline-none transition-shadow focus:ring-foreground/30";

/** Ready-made wording for the situation picked. */
function templates(f: Form, drive: Drive | undefined, uni: string): Template[] {
  if (f.audience === "drive" && drive) {
    const when = fmtDate(drive.drive_date);
    const name = drive.company_display || drive.title;
    const by: Partial<Record<DriveSegment, Template[]>> = {
      selected: [
        { label: "Next-round invite", kind: "round", ack: true, title: `You're through to the next round with ${name}`, body: `Congratulations! You've been selected for the next round of the ${drive.title}.\n\nBring a printed resume and your college ID. Tap "Got it" so we know you've seen this.` },
      ],
      missed: [
        { label: "Missed the drive", kind: "reminder", title: `We missed you at the ${drive.title}`, body: `You registered for the ${drive.title} on ${when} but weren't marked present.\n\nIf something came up, reply on the Campus page within 2 days — we'll check whether ${name} has a later slot.` },
      ],
      registered: [
        { label: "Drive-day reminder", kind: "reminder", ack: true, title: `Reminder: ${drive.title} on ${when}`, body: "Report 30 minutes early with your college ID and two printed resumes. Dress code: formal." },
        { label: "Venue changed", kind: "urgent", title: `Venue changed for the ${drive.title}`, body: `The ${drive.title} on ${when} has moved. Everything else stays the same.` },
      ],
      attended: [{ label: "Thanks for coming", kind: "update", title: `Thanks for attending the ${drive.title}`, body: `${name} will share results soon — you'll be notified here the moment they do.` }],
      not_selected: [{ label: "Kind follow-up", kind: "update", title: `About the ${drive.title}`, body: `This time ${name} moved ahead with other candidates. More drives are coming up, and we're happy to review your resume with you.` }],
      pending: [{ label: "Results soon", kind: "update", title: `${drive.title}: results coming soon`, body: `${name} is still reviewing. We'll let you know as soon as results are in.` }],
    };
    return by[f.segment] ?? [];
  }
  return [
    { label: "Workshop", kind: "update", title: "Resume workshop this Friday", body: `The ${uni} placement cell is running a resume workshop this Friday at 3 pm in the seminar hall.\n\nBring your laptop and current resume.` },
    { label: "Profile deadline", kind: "reminder", ack: true, title: "Complete your profile by Sunday", body: "Recruiters filter by complete, verified profiles. Please finish your profile and upload your latest resume by Sunday." },
    { label: "Placement policy", kind: "urgent", ack: true, title: "Placement policy 2026 — please read", body: "The updated placement policy is attached. Key points: one offer per student above the dream threshold, and attendance at registered drives is mandatory." },
  ];
}

// ── page ────────────────────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  const { data: uni } = useUniversity();
  const [items, setItems] = React.useState<Announcement[] | null>(null);
  const [drives, setDrives] = React.useState<Drive[]>([]);
  const [students, setStudents] = React.useState<CampusStudent[]>([]);
  const [branches, setBranches] = React.useState<string[]>([]);
  const [form, setForm] = React.useState<Form>(EMPTY);
  const [extras, setExtras] = React.useState<Set<Extra>>(new Set());
  const [files, setFiles] = React.useState<Upload[]>([]);
  const [preview, setPreview] = React.useState<AudiencePreview | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [receipts, setReceipts] = React.useState<Announcement | null>(null);
  const [opened, setOpened] = React.useState<Announcement | null>(null);
  const composer = React.useRef<HTMLFormElement>(null);
  const picker = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(() => {
    getAnnouncements()
      .then(setItems)
      .catch((err) => {
        toast.error(errorMessage(err));
        setItems([]);
      });
  }, []);
  React.useEffect(() => {
    load();
    getDrives().then((d) => setDrives(d.filter((x) => x.status !== "cancelled"))).catch(() => {});
    getCampusStudents({})
      .then((d) => {
        setStudents(d.results);
        setBranches(d.branches);
      })
      .catch(() => {});
  }, [load]);

  const editing = form.id !== undefined;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleExtra = (x: Extra, on?: boolean) =>
    setExtras((s) => {
      const n = new Set(s);
      if (on ?? !n.has(x)) n.add(x);
      else n.delete(x);
      return n;
    });

  const audiencePayload = React.useMemo(
    () => ({
      audience: form.audience,
      drive: form.audience === "drive" ? form.drive : null,
      segment: form.audience === "drive" ? form.segment : ("" as const),
      branches: form.audience === "cohort" ? form.branches.join(", ") : "",
      graduation_year: form.audience === "cohort" ? form.year : null,
      student_ids: form.audience === "students" ? form.students : [],
    }),
    [form.audience, form.drive, form.segment, form.branches, form.year, form.students]
  );

  React.useEffect(() => {
    if (editing) return;
    const t = setTimeout(() => previewAudience(audiencePayload).then(setPreview).catch(() => {}), 220);
    return () => clearTimeout(t);
  }, [audiencePayload, editing]);

  const years = React.useMemo(() => [...new Set(students.map((s) => s.graduation_year).filter((y): y is number => !!y))].sort(), [students]);
  const drive = drives.find((d) => d.id === form.drive);
  const reach = preview?.error ? 0 : preview?.count ?? 0;
  const uploading = files.some((f) => !f.file);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    for (const file of Array.from(list)) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      setFiles((fs) => [...fs, { key, name: file.name, size: file.size }]);
      try {
        const saved = await uploadAnnouncementFile(file);
        setFiles((fs) => fs.map((f) => (f.key === key ? { ...f, file: saved } : f)));
      } catch (err) {
        toast.error(`${file.name}: ${errorMessage(err)}`);
        setFiles((fs) => fs.filter((f) => f.key !== key));
      }
    }
    if (picker.current) picker.current.value = "";
  };
  const removeFile = (u: Upload) => {
    setFiles((fs) => fs.filter((f) => f.key !== u.key));
    if (u.file) deleteAnnouncementFile(u.file.id).catch(() => {});
  };

  const reset = () => {
    setForm(EMPTY);
    setExtras(new Set());
    setFiles([]);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const msg = {
        title: form.title,
        body: form.body,
        pinned: form.pinned,
        kind: form.kind,
        require_ack: form.requireAck,
        event_at: extras.has("event") ? toIso(form.eventAt) : null,
        venue: extras.has("event") ? form.venue : "",
        link_url: extras.has("link") ? form.linkUrl : "",
        link_label: extras.has("link") ? form.linkLabel : "",
        expires_at: extras.has("expiry") ? toIso(form.expiresAt) : null,
        attachment_ids: files.flatMap((f) => (f.file ? [f.file.id] : [])),
      };
      if (editing) {
        await saveAnnouncement(msg, form.id);
        toast.success("Announcement updated");
      } else {
        const a = await saveAnnouncement({ ...msg, ...audiencePayload });
        toast.success(`Sent to ${a.recipient_count} student${a.recipient_count === 1 ? "" : "s"}`, { description: a.audience_label });
      }
      reset();
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (a: Announcement) => {
    setForm({
      ...EMPTY, id: a.id, title: a.title, body: a.body, pinned: a.pinned, kind: a.kind, requireAck: a.require_ack, audience: a.audience,
      eventAt: toLocal(a.event_at), venue: a.venue, linkUrl: a.link_url, linkLabel: a.link_label, expiresAt: toLocal(a.expires_at),
    });
    setExtras(new Set<Extra>([...(a.event_at || a.venue ? ["event" as const] : []), ...(a.link_url ? ["link" as const] : []), ...(a.expires_at ? ["expiry" as const] : [])]));
    setFiles(a.attachments.map((f) => ({ key: `saved-${f.id}`, name: f.name, size: f.size, file: f })));
    composer.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (items === null) return <DashboardSkeleton />;
  const editingItem = editing ? items.find((a) => a.id === form.id) : undefined;

  return (
    <div className="space-y-8">
      <PageHeader title="Announcements" subtitle="Notices, round calls and documents — sent to exactly the students who need them." />

      <div className="grid items-start gap-5 xl:grid-cols-12">
        {/* ── composer ── */}
        <form ref={composer} onSubmit={send} className="min-w-0 xl:col-span-7">
          <Panel
            title={editing ? "Edit announcement" : "New announcement"}
            style={stagger(1)}
            action={!editing && <TemplatesMenu items={templates(form, drive, uni.university.name)} onPick={(t) => setForm((f) => ({ ...f, title: t.title, body: t.body, kind: t.kind, requireAck: t.ack ?? f.requireAck }))} />}
            contentClassName="px-0"
          >
            {/* To */}
            <Row
              label="To"
              first
              control={
                editing ? (
                  <p className="text-[0.9375rem]">
                    <b className="font-medium">{editingItem?.audience_label}</b>
                    <span className="text-muted-foreground"> · {editingItem?.recipient_count} students · can&apos;t change after sending</span>
                  </p>
                ) : (
                  <Segmented value={form.audience} onChange={(v) => set("audience", v)} />
                )
              }
            >
              {!editing && (
                  <Reveal k={form.audience}>
                    {form.audience === "everyone" && <p className="text-[0.9375rem] text-muted-foreground">Every student who has linked {uni.university.name} on CareerBridge.</p>}
                    {form.audience === "cohort" && (
                      <div className="space-y-3">
                        <ChipLine label="Branch">
                          {branches.map((b) => (
                            <Chip key={b} on={form.branches.includes(b)} onClick={() => set("branches", form.branches.includes(b) ? form.branches.filter((x) => x !== b) : [...form.branches, b])}>
                              {b}
                            </Chip>
                          ))}
                        </ChipLine>
                        <ChipLine label="Batch">
                          <Chip on={form.year === null} onClick={() => set("year", null)}>
                            Any
                          </Chip>
                          {years.map((y) => (
                            <Chip key={y} on={form.year === y} onClick={() => set("year", y)}>
                              {y}
                            </Chip>
                          ))}
                        </ChipLine>
                      </div>
                    )}
                    {form.audience === "drive" && (
                      <DriveAudience
                        drives={drives}
                        drive={form.drive}
                        segment={form.segment}
                        counts={preview?.segments}
                        onDrive={(id) => setForm((f) => ({ ...f, drive: id, kind: f.kind === "update" ? "round" : f.kind }))}
                        onSegment={(s) => set("segment", s)}
                      />
                    )}
                    {form.audience === "students" && <PeopleChooser students={students} value={form.students} onChange={(v) => set("students", v)} />}
                  </Reveal>
              )}
            </Row>

            {/* Type */}
            <Row
              label="Type"
              control={
              <div className="flex flex-wrap gap-1">
                {KIND_ORDER.map((v) => {
                  const k = KIND_META[v];
                  const on = form.kind === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("kind", v)}
                      className={cn(
                        `tone-${k.tone}`,
                        "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[0.875rem] font-medium transition-colors duration-150",
                        on ? "bg-(--t-bg) text-(--t-fg)" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      <k.Icon className="size-4" /> {k.label}
                    </button>
                  );
                })}
              </div>
              }
            />

            {/* Message */}
            <div className="space-y-1 px-(--card-spacing) pt-6">
              <input
                required
                maxLength={200}
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Title"
                aria-label="Title"
                className="w-full bg-transparent text-[1.5rem] font-medium tracking-[-0.02em] outline-none placeholder:text-muted-foreground/45"
              />
              <textarea
                required
                rows={6}
                value={form.body}
                onChange={(e) => set("body", e.target.value)}
                placeholder="Write the message — what, when, where, what to bring…"
                aria-label="Message"
                className="field-sizing-content min-h-36 w-full resize-none bg-transparent text-[1rem] leading-relaxed outline-none placeholder:text-muted-foreground/45"
              />
            </div>

            {/* attachments + extras */}
            {(files.length > 0 || extras.size > 0) && (
              <div className="space-y-2.5 px-(--card-spacing) pb-4">
                {files.length > 0 && (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {files.map((u) => (
                      <li key={u.key} className="flex items-center gap-3 rounded-[0.875rem] bg-secondary/60 p-2 pr-2.5">
                        <FileGlyph name={u.name} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.875rem] font-medium">{u.name}</span>
                          <span className="block text-[0.75rem] text-muted-foreground">{u.file ? fileSize(u.size) : "Uploading…"}</span>
                        </span>
                        {u.file ? (
                          <button type="button" aria-label={`Remove ${u.name}`} onClick={() => removeFile(u)} className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground">
                            <CloseCircleIcon className="size-[1.125rem]" />
                          </button>
                        ) : (
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {extras.has("event") && (
                  <ExtraLine icon={CalendarIcon} label="Event" onRemove={() => toggleExtra("event", false)}>
                    <input type="datetime-local" value={form.eventAt} onChange={(e) => set("eventAt", e.target.value)} aria-label="Event date and time" className={FIELD} />
                    <input value={form.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Venue — e.g. Block 34, seminar hall" aria-label="Venue" className={cn(FIELD, "min-w-0 flex-1")} />
                  </ExtraLine>
                )}
                {extras.has("link") && (
                  <ExtraLine icon={LinkIcon} label="Link" onRemove={() => toggleExtra("link", false)}>
                    <input value={form.linkLabel} onChange={(e) => set("linkLabel", e.target.value)} placeholder="Button text — Register now" aria-label="Link button text" className={cn(FIELD, "w-40")} />
                    <input type="url" value={form.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} placeholder="https://…" aria-label="Link address" className={cn(FIELD, "min-w-48 flex-1")} />
                  </ExtraLine>
                )}
                {extras.has("expiry") && (
                  <ExtraLine icon={HourglassIcon} label="Hide after" onRemove={() => toggleExtra("expiry", false)}>
                    <input type="datetime-local" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} aria-label="Hide from students after" className={FIELD} />
                  </ExtraLine>
                )}
              </div>
            )}

            {/* toolbar */}
            <div className="flex flex-wrap items-center gap-0.5 border-y border-(--hairline) px-[calc(var(--card-spacing)-0.5rem)] py-2">
              <input ref={picker} type="file" multiple hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg,.webp,.zip" onChange={(e) => addFiles(e.target.files)} />
              <Tool icon={AttachIcon} onClick={() => picker.current?.click()}>
                Attach
              </Tool>
              <Tool icon={CalendarIcon} on={extras.has("event")} onClick={() => toggleExtra("event")}>
                Event
              </Tool>
              <Tool icon={LinkIcon} on={extras.has("link")} onClick={() => toggleExtra("link")}>
                Link
              </Tool>
              <Tool icon={HourglassIcon} on={extras.has("expiry")} onClick={() => toggleExtra("expiry")}>
                Expiry
              </Tool>
              <span className="mx-1.5 hidden h-5 w-px bg-(--hairline) sm:block" />
              <SwitchPill on={form.requireAck} onClick={() => set("requireAck", !form.requireAck)} icon={CheckReadIcon}>
                Read receipts
              </SwitchPill>
              <Tool icon={PinIcon} on={form.pinned} onClick={() => set("pinned", !form.pinned)}>
                {form.pinned ? "Pinned" : "Pin"}
              </Tool>
            </div>

            {/* send */}
            <div className="flex flex-col gap-4 px-(--card-spacing) pt-5 sm:flex-row sm:items-center">
              {editing ? <p className="flex-1 text-[0.875rem] text-muted-foreground">Saving updates the post; no new notification is sent.</p> : <Reach preview={preview} />}
              <div className="flex items-center gap-2">
                {editing && (
                  <Button type="button" size="lg" variant="ghost" onClick={reset}>
                    Cancel
                  </Button>
                )}
                <Button type="submit" size="lg" className="min-w-40 flex-1 sm:flex-none" disabled={saving || uploading || (!editing && reach === 0)}>
                  {saving ? <Loader2 className="animate-spin" /> : <SendIcon className="size-[1.125rem]" />}
                  {editing ? "Save changes" : reach > 0 ? `Send to ${reach}` : "Send"}
                </Button>
              </div>
            </div>
          </Panel>
        </form>

        {/* ── preview, then what's been sent ── */}
        <div className="min-w-0 space-y-5 xl:col-span-5">
          <Panel
            title="Preview"
            style={stagger(2)}
            action={
              <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
                <EyeIcon className="size-4" /> As students see it
              </span>
            }
          >
            <div className="rounded-[1.75rem] bg-secondary/60 p-3">
              <AnnouncementCard
                preview
                from={`${uni.university.name} · placement cell`}
                a={{
                  title: form.title,
                  body: form.body,
                  kind: form.kind,
                  pinned: form.pinned,
                  require_ack: form.requireAck,
                  acknowledged: false,
                  link_url: extras.has("link") ? form.linkUrl || "#" : "",
                  link_label: form.linkLabel,
                  event_at: extras.has("event") && form.eventAt ? toIso(form.eventAt) : null,
                  venue: extras.has("event") ? form.venue : "",
                  expires_at: extras.has("expiry") && form.expiresAt ? toIso(form.expiresAt) : null,
                  author_name: "",
                  created_at: "",
                  attachments: files.map((f) => ({ id: f.key, name: f.name, size: f.size })),
                }}
              />
            </div>
          </Panel>

          <SentFeed items={items} onOpen={setOpened} onEdit={startEdit} onReceipts={setReceipts} onChanged={load} />
        </div>
      </div>

      <AnnouncementDialog
        a={opened}
        from={`${uni.university.name} · ${opened?.author_name ?? "placement cell"}`}
        onClose={() => setOpened(null)}
        aside={
          opened && (
            <SentAside
              a={opened}
              onEdit={() => {
                setOpened(null);
                startEdit(opened);
              }}
              onReceipts={() => {
                setOpened(null);
                setReceipts(opened);
              }}
            />
          )
        }
      />

      <ReceiptsSheet a={receipts} onClose={() => setReceipts(null)} onChanged={load} />
    </div>
  );
}

// ── composer pieces ─────────────────────────────────────────────────────────

/** A composer line: the label sits inline with its control (like a mail "To:" field); anything below spans the full width. */
function Row({ label, first, control, children }: { label: string; first?: boolean; control: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className={cn("space-y-4 border-b border-(--hairline) px-(--card-spacing) py-4", first && "border-t")}>
      <div className="flex items-center gap-3">
        <span className="w-10 shrink-0 text-[0.75rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">{label}</span>
        <div className="min-w-0 flex-1">{control}</div>
      </div>
      {children}
    </div>
  );
}

/** Four-way switch with a thumb that glides (GSAP) to the chosen option. */
function Segmented({ value, onChange }: { value: AnnouncementAudience; onChange: (v: AnnouncementAudience) => void }) {
  const thumb = React.useRef<HTMLSpanElement>(null);
  const i = AUDIENCES.findIndex((a) => a.v === value);
  React.useEffect(() => {
    if (!thumb.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.to(thumb.current, { xPercent: i * 100, duration: reduce ? 0 : 0.55, ease: "expo.out", overwrite: "auto" });
  }, [i]);
  return (
    <div role="radiogroup" aria-label="Audience" className="relative inline-grid grid-cols-4 rounded-full bg-secondary p-1">
      <span ref={thumb} aria-hidden className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-full bg-card shadow-[0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_-4px_rgb(0_0_0/0.14)]" />
      {AUDIENCES.map(({ v, label, Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn("relative z-10 flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-medium whitespace-nowrap transition-colors duration-200 sm:px-4 sm:text-[0.875rem]", value === v ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          <Icon className="hidden size-4 shrink-0 sm:block" /> {label}
        </button>
      ))}
    </div>
  );
}

function Reveal({ k, children }: { k: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = gsap.fromTo(el, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power3.out", clearProps: "transform" });
    return () => {
      t.kill();
    };
  }, [k]);
  return <div ref={ref}>{children}</div>;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn("inline-flex h-8 items-center rounded-full px-3 text-[0.8125rem] font-medium transition-colors duration-150", on ? "bg-foreground text-background" : "bg-secondary/80 hover:bg-secondary")}
    >
      {children}
    </button>
  );
}

function ChipLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-14 text-[0.8125rem] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function DriveAudience({
  drives,
  drive,
  segment,
  counts,
  onDrive,
  onSegment,
}: {
  drives: Drive[];
  drive: number | null;
  segment: DriveSegment;
  counts?: Record<DriveSegment, number>;
  onDrive: (id: number) => void;
  onSegment: (s: DriveSegment) => void;
}) {
  if (drives.length === 0) return <p className="text-[0.9375rem] text-muted-foreground">No drives yet — create one under Placement drives.</p>;
  const items = Object.fromEntries(drives.map((d) => [String(d.id), d.title]));
  const segItems = Object.fromEntries(SEGMENTS.map((s) => [s.v, counts ? `${SHORT[s.v] ?? s.label} · ${counts[s.v]}` : SHORT[s.v] ?? s.label]));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
      <Select value={drive ? String(drive) : null} items={items} onValueChange={(v) => v && onDrive(Number(v))}>
        <SelectTrigger aria-label="Drive">
          <SelectValue placeholder="Choose a drive" className="!block min-w-0 truncate" />
        </SelectTrigger>
        <SelectContent>
          {drives.map((d) => (
            <SelectItem key={d.id} value={String(d.id)}>
              <span className="flex min-w-0 items-center gap-2.5">
                <OrgAvatar name={d.company_display || d.title} className="size-7 shrink-0" />
                <span className="min-w-0 flex-1 whitespace-normal">
                  <span className="line-clamp-2 block">{d.title}</span>
                  <span className="block text-[0.75rem] font-normal text-muted-foreground">
                    {fmtDate(d.drive_date)} · {d.registrations_count} registered
                  </span>
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={segment} items={segItems} disabled={drive === null} onValueChange={(v) => v && onSegment(v as DriveSegment)}>
        <SelectTrigger aria-label="Who in this drive">
          <SelectValue className="!block min-w-0 truncate" />
        </SelectTrigger>
        <SelectContent>
          {SEGMENTS.map(({ v, label, hint, Icon }) => {
            const n = counts?.[v];
            return (
              <SelectItem key={v} value={v} disabled={n === 0}>
                <span className="flex min-w-0 flex-1 items-center gap-2.5">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block">{label}</span>
                    <span className="block text-[0.75rem] font-normal text-muted-foreground">{hint}</span>
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.75rem] font-medium tabular-nums">{n ?? "–"}</span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      </div>
    </div>
  );
}

const SHORT: Partial<Record<DriveSegment, string>> = { selected: "Next round", pending: "Awaiting result" };

function Tool({ icon: Icon, on, onClick, children }: { icon: IconT; on?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[0.8125rem] font-medium transition-colors duration-150",
        on ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
      )}
    >
      <Icon className="size-4" /> {children}
    </button>
  );
}

function SwitchPill({ on, onClick, icon: Icon, children }: { on: boolean; onClick: () => void; icon: IconT; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={cn("inline-flex h-9 items-center gap-2 rounded-full pr-1 pl-2.5 text-[0.8125rem] font-medium transition-colors duration-150", on ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
    >
      <Icon className="size-4" /> {children}
      <span className={cn("relative h-5 w-8 rounded-full transition-colors duration-200", on ? "bg-foreground" : "bg-foreground/15")}>
        <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-background shadow-sm transition-transform duration-200 ease-out", on && "translate-x-3")} />
      </span>
    </button>
  );
}

function ExtraLine({ icon: Icon, label, onRemove, children }: { icon: IconT; label: string; onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[1rem] bg-secondary/50 p-2 pl-3">
      <span className="flex w-24 shrink-0 items-center gap-1.5 text-[0.8125rem] font-medium text-muted-foreground">
        <Icon className="size-4" /> {label}
      </span>
      {children}
      <button type="button" aria-label={`Remove ${label.toLowerCase()}`} onClick={onRemove} className="ml-auto rounded-full p-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground">
        <CloseCircleIcon className="size-[1.125rem]" />
      </button>
    </div>
  );
}

function TemplatesMenu({ items, onPick }: { items: Template[]; onPick: (t: Template) => void }) {
  if (items.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" className="px-4" />}>Templates</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
        <DropdownMenuLabel>Start from</DropdownMenuLabel>
        {items.map((t) => {
          const k = KIND_META[t.kind];
          return (
            <DropdownMenuItem key={t.label} onClick={() => onPick(t)} className="items-start gap-2.5 py-2">
              <k.Icon className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                <span className="block font-medium">{t.label}</span>
                <span className="block truncate text-[0.75rem] text-muted-foreground">{t.title}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Head-count with a few faces; the number rolls to each new value. */
function Reach({ preview }: { preview: AudiencePreview | null }) {
  const num = React.useRef<HTMLSpanElement>(null);
  const last = React.useRef(0);
  const count = preview?.error ? 0 : preview?.count ?? 0;
  React.useEffect(() => {
    const el = num.current;
    if (!el) return;
    const o = { v: last.current };
    last.current = count;
    const t = gsap.to(o, { v: count, duration: 0.6, ease: "power3.out", onUpdate: () => (el.textContent = String(Math.round(o.v))) });
    return () => {
      t.kill();
    };
  }, [count]);
  const names = preview?.sample ?? [];
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="flex -space-x-1.5">
        {names.slice(0, 3).map((n) => (
          <OrgAvatar key={n} name={n} className="size-8 ring-2 ring-card [&>*]:text-[0.6875rem]" />
        ))}
      </div>
      <div className="min-w-0">
        <p className="text-[0.9375rem] font-medium">
          <span ref={num} className="tabular-nums">
            0
          </span>{" "}
          student{count === 1 ? "" : "s"}
        </p>
        <p className="truncate text-[0.8125rem] text-muted-foreground">
          {preview?.error || (names.length ? `${names.slice(0, 2).join(", ")}${count > 2 ? ` +${count - 2} more` : ""}` : "Nobody matches yet")}
        </p>
      </div>
    </div>
  );
}

// ── sent ────────────────────────────────────────────────────────────────────

const SENT_TABS = [
  ["all", "All"],
  ["drive", "Drives"],
  ["ack", "Receipts"],
  ["pinned", "Pinned"],
] as const;
type SentTab = (typeof SENT_TABS)[number][0];

/** Everything sent, as a compact list under the preview. */
function SentFeed({ items, onOpen, onEdit, onReceipts, onChanged }: { items: Announcement[]; onOpen: (a: Announcement) => void; onEdit: (a: Announcement) => void; onReceipts: (a: Announcement) => void; onChanged: () => void }) {
  const [filter, setFilter] = React.useState<SentTab>("all");
  const [all, setAll] = React.useState(false);
  const matched = items.filter((a) => (filter === "all" ? true : filter === "drive" ? a.audience === "drive" : filter === "ack" ? a.require_ack : a.pinned));
  const shown = all ? matched : matched.slice(0, 5);
  const ref = React.useRef<HTMLUListElement>(null);
  const key = shown.map((a) => a.id).join(",");
  React.useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = gsap.fromTo(el.children, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power3.out", stagger: 0.04, clearProps: "transform" });
    return () => {
      t.kill();
    };
  }, [key]);

  return (
    <Panel
      title="Sent"
      style={stagger(3)}
      action={<span className="rounded-full bg-secondary px-2.5 py-0.5 text-[0.8125rem] font-medium tabular-nums">{items.length}</span>}
      contentClassName="space-y-3"
    >
      <div className="flex gap-1 rounded-full bg-secondary p-1">
        {SENT_TABS.map(([v, label]) => (
          <TabPill key={v} on={filter === v} onClick={() => setFilter(v)}>
            {label}
          </TabPill>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="py-8 text-center text-[0.875rem] text-muted-foreground">{items.length ? "Nothing here yet." : "Nothing sent yet — your first announcement will show here."}</p>
      ) : (
        <ul ref={ref} className="-mx-2 space-y-0.5">
          {shown.map((a) => (
            <SentItem key={a.id} a={a} onOpen={onOpen} onEdit={onEdit} onReceipts={onReceipts} onChanged={onChanged} />
          ))}
        </ul>
      )}
      {matched.length > 5 && (
        <button type="button" onClick={() => setAll((x) => !x)} className="w-full rounded-full py-2 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          {all ? "Show fewer" : `Show all ${matched.length}`}
        </button>
      )}
    </Panel>
  );
}

function TabPill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn("h-8 flex-1 rounded-full px-3 text-[0.8125rem] font-medium whitespace-nowrap transition-colors", on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
    >
      {children}
    </button>
  );
}

function SentItem({ a, onOpen, onEdit, onReceipts, onChanged }: { a: Announcement; onOpen: (a: Announcement) => void; onEdit: (a: Announcement) => void; onReceipts: (a: Announcement) => void; onChanged: () => void }) {
  const k = KIND_META[a.kind] ?? KIND_META.update;
  const total = a.recipient_count;
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const extras = [a.attachments.length > 0 && `${a.attachments.length} file${a.attachments.length === 1 ? "" : "s"}`, a.event_at && fmtDate(a.event_at), a.link_url && (a.link_label || "Link")].filter(Boolean);

  return (
    <li className={cn(`tone-${k.tone}`, "group flex cursor-pointer items-center gap-3 rounded-[1rem] p-2 transition-colors duration-150 hover:bg-secondary/60")}>
      <button type="button" onClick={() => onOpen(a)} aria-label={`Open “${a.title}”`} className="flex min-w-0 flex-1 items-center gap-3 rounded-[0.75rem] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[0.8125rem] bg-(--t-bg) text-(--t-fg) transition-transform duration-200 group-hover:scale-105">
        <k.Icon className="size-[1.125rem]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5">
          <span className="truncate text-[0.9375rem] font-medium">{a.title}</span>
          {a.pinned && <PinIcon aria-label="Pinned" className="size-3.5 shrink-0 -rotate-45 text-(--t-fg)" />}
        </p>
        <p className="truncate text-[0.8125rem] text-muted-foreground">
          {a.audience_label}
          {total > 0 && ` · ${total}`} · {timeAgo(a.created_at)}
          {extras.length > 0 && ` · ${extras.join(" · ")}`}
        </p>
      </div>
      </button>
      {a.require_ack && total > 0 && <AckRing done={a.ack_count} total={total} onClick={() => onReceipts(a)} />}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" size="icon-sm" variant="ghost" className="size-8 shrink-0 text-muted-foreground" aria-label="More actions" />}>
          <MenuDotsIcon className="size-[1.125rem]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onOpen(a)}>
            <EyeIcon /> Open
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(a)}>
            <PenIcon /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run(() => saveAnnouncement({ title: a.title, body: a.body, pinned: !a.pinned }, a.id), a.pinned ? "Unpinned" : "Pinned")}>
            <PinIcon /> {a.pinned ? "Unpin" : "Pin to top"}
          </DropdownMenuItem>
          {a.require_ack && (
            <DropdownMenuItem onClick={() => onReceipts(a)}>
              <CheckReadIcon /> Read receipts
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => run(() => deleteAnnouncement(a.id), "Announcement deleted")}>
            <TrashIcon /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/** Footer of the opened post: who it reached, receipts, and what you can do with it. */
function SentAside({ a, onEdit, onReceipts }: { a: Announcement; onEdit: () => void; onReceipts: () => void }) {
  const AudIcon = AUDIENCES.find((x) => x.v === a.audience)?.Icon ?? GlobalIcon;
  const k = KIND_META[a.kind] ?? KIND_META.update;
  return (
    <div className={cn(`tone-${k.tone}`, "flex flex-wrap items-center gap-x-4 gap-y-3")}>
      <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:flex-1">
        {a.require_ack && a.recipient_count > 0 ? (
          <AckRing done={a.ack_count} total={a.recipient_count} onClick={onReceipts} />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-(--hairline)">
            <AudIcon className="size-[1.125rem]" />
          </span>
        )}
        <div className="min-w-0 text-[0.875rem] leading-snug">
          <p className="font-medium">
            {a.audience_label}
            <span className="font-normal text-muted-foreground">
              {" "}
              · {a.recipient_count} student{a.recipient_count === 1 ? "" : "s"}
            </span>
          </p>
          <p className="text-[0.8125rem] text-muted-foreground">
            {a.require_ack ? `${a.ack_count} of ${a.recipient_count} tapped Got it · ` : ""}
            {fmtDateTime(a.created_at)}
          </p>
        </div>
      </div>
      <div className="ml-auto flex gap-2">
        {a.require_ack && (
          <Button type="button" variant="outline" onClick={onReceipts}>
            Receipts
          </Button>
        )}
        <Button type="button" onClick={onEdit}>
          <PenIcon className="size-4" /> Edit
        </Button>
      </div>
    </div>
  );
}

/** Read receipts at a glance: a thin ring that fills as students tap "Got it"; it turns mint once everyone has. */
function AckRing({ done, total, onClick }: { done: number; total: number; onClick: () => void }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, done / total);
  const arc = React.useRef<SVGCircleElement>(null);
  React.useEffect(() => {
    if (!arc.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = gsap.fromTo(arc.current, { strokeDashoffset: c }, { strokeDashoffset: c * (1 - frac), duration: reduce ? 0 : 0.9, ease: "power3.out" });
    return () => {
      t.kill();
    };
  }, [c, frac]);
  const full = frac >= 1;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${done} of ${total} have read it — see who`}
      aria-label={`Read receipts: ${done} of ${total}`}
      className={cn("relative flex size-10 shrink-0 items-center justify-center rounded-full transition-transform duration-150 hover:scale-105 active:scale-95", full ? "text-(--mint-fg)" : "text-(--t-fg)")}
    >
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="2.5" className="stroke-foreground/10" />
        <circle ref={arc} cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c} />
      </svg>
      <span className="text-[0.625rem] leading-none font-semibold text-foreground tabular-nums">
        {done}
        <span className="text-muted-foreground">/{total}</span>
      </span>
    </button>
  );
}

type Receipts = { id: number; acknowledged: { id: number; name: string; at: string }[]; pending: { id: number; name: string }[] };

function ReceiptsSheet({ a, onClose, onChanged }: { a: Announcement | null; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = React.useState<Receipts | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!a) return;
    getAnnouncementAcks(a.id)
      .then((d) => setData({ id: a.id, ...d }))
      .catch((err) => toast.error(errorMessage(err)));
  }, [a]);
  const d = data && a && data.id === a.id ? data : null;

  const remind = async () => {
    if (!a) return;
    setBusy(true);
    try {
      const r = await remindAnnouncement(a.id);
      toast.success(`Reminded ${r.reminded} student${r.reminded === 1 ? "" : "s"}`);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!a} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-lg">
        {a && (
          <div className="space-y-6 p-6 sm:p-8">
            <SheetHeader className="p-0 pr-8">
              <SheetTitle className="text-[1.375rem] font-medium tracking-[-0.01em]">Read receipts</SheetTitle>
              <p className="text-[0.875rem] text-muted-foreground">{a.title}</p>
            </SheetHeader>
            {!d ? (
              <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[1.125rem] bg-(--mint-bg) p-4 text-(--mint-fg)">
                    <p className="text-[2rem] leading-none font-light tabular-nums">{d.acknowledged.length}</p>
                    <p className="mt-1.5 text-[0.8125rem] font-medium">Acknowledged</p>
                  </div>
                  <div className="rounded-[1.125rem] bg-(--peach-bg) p-4 text-(--peach-fg)">
                    <p className="text-[2rem] leading-none font-light tabular-nums">{d.pending.length}</p>
                    <p className="mt-1.5 text-[0.8125rem] font-medium">Still to read</p>
                  </div>
                </div>
                {d.pending.length > 0 && (
                  <Button className="w-full" size="lg" disabled={busy} onClick={remind}>
                    {busy ? <Loader2 className="animate-spin" /> : <SendIcon className="size-[1.125rem]" />} Remind the {d.pending.length} who haven&apos;t
                  </Button>
                )}
                <PeopleList title="Still to read" people={d.pending.map((p) => ({ ...p, meta: "" }))} />
                <PeopleList title="Acknowledged" people={d.acknowledged.map((p) => ({ ...p, meta: timeAgo(p.at) }))} />
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PeopleList({ title, people }: { title: string; people: { id: number; name: string; meta: string }[] }) {
  if (people.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-[0.75rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {title} · {people.length}
      </h3>
      <ul className="overflow-hidden rounded-[1rem] ring-1 ring-(--hairline)">
        {people.map((p, i) => (
          <li key={p.id} className={cn("flex items-center gap-3 px-3 py-2.5", i > 0 && "border-t border-(--hairline)")}>
            <OrgAvatar name={p.name} className="size-8" />
            <span className="min-w-0 flex-1 truncate text-[0.9375rem]">{p.name}</span>
            {p.meta && <span className="text-[0.75rem] text-muted-foreground">{p.meta}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
