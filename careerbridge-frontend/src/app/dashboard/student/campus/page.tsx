"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";

import { errorMessage } from "@/lib/api";
import {
  acknowledgeAnnouncement,
  fmtDate,
  fmtDateTime,
  getStudentCampus,
  registerForDrive,
  timeAgo,
  unregisterFromDrive,
  type Announcement,
  type StudentCampus,
} from "@/lib/ats";
import { KIND_META } from "@/components/announcement-card";
import { AnnouncementDialog } from "@/components/announcement-dialog";
import { AttachIcon, CalendarIcon, ClockIcon, GraduateIcon, LinkIcon, LocationIcon, MegaphoneIcon, PinIcon, VerifiedIcon } from "@/components/icons";
import { DashboardSkeleton, OrgAvatar, PageHeader, Panel, stagger } from "@/components/kit";
import { GlassSection, GlassTabs, LABEL, NextDriveTile, NoticesTile, Pill, RegisteredTile, VerifyCard, WELL } from "@/components/campus-overview";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type CampusDrive = StudentCampus["drives"][number];

const NOTICE_TABS = [
  ["all", "All"],
  ["todo", "Needs you"],
  ["round", "Drive rounds"],
  ["pinned", "Pinned"],
] as const;
type NoticeTab = (typeof NOTICE_TABS)[number][0];

export default function StudentCampusPage() {
  const router = useRouter();
  const [data, setData] = React.useState<StudentCampus | null>(null);
  const [busy, setBusy] = React.useState<number | null>(null);
  const [acking, setAcking] = React.useState<number | null>(null);
  const [opened, setOpened] = React.useState<Announcement | null>(null);
  const [focusDrive, setFocusDrive] = React.useState<number | null>(null);

  const load = React.useCallback(() => {
    getStudentCampus()
      .then(setData)
      .catch((err) => {
        toast.error(errorMessage(err));
        setData({ university: null, drives: [], announcements: [] });
      });
  }, []);
  React.useEffect(load, [load]);

  // Deep links from notifications: ?a=<announcement>, ?q=<title> (older notifications), ?drive=<drive>
  const applyLink = React.useCallback((query: string, d: StudentCampus) => {
    const qs = new URLSearchParams(query);
    const a = Number(qs.get("a")) || null;
    const q = qs.get("q");
    const drive = Number(qs.get("drive")) || null;
    const hit = a ? d.announcements.find((x) => x.id === a) : q ? d.announcements.find((x) => x.title === q || q.endsWith(x.title)) : undefined;
    if (hit) setOpened(hit);
    else if (a || q) toast("That announcement is no longer on your board", { description: "It may have expired or been removed." });
    if (drive) setFocusDrive(drive);
    if (a || q || drive) window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const linked = React.useRef(false);
  React.useEffect(() => {
    if (!data || linked.current) return;
    linked.current = true;
    applyLink(window.location.search, data);
  }, [data, applyLink]);
  React.useEffect(() => {
    if (!data) return;
    const on = (e: Event) => applyLink((e as CustomEvent<string>).detail, data);
    window.addEventListener("cb:deeplink", on);
    return () => window.removeEventListener("cb:deeplink", on);
  }, [data, applyLink]);

  if (!data) return <DashboardSkeleton />;

  if (!data.university)
    return (
      <div className="space-y-8">
        <PageHeader title="Campus" subtitle="Placement drives and notices from your university." />
        <Panel style={stagger(1)} contentClassName="py-10 text-center">
          <p className="text-muted-foreground">Add your university to your profile to see its placement drives and announcements.</p>
          <Button className="mt-5" render={<Link href="/dashboard/student/profile" />} nativeButton={false}>
            Update profile
          </Button>
        </Panel>
      </div>
    );

  const register = async (id: number, on: boolean) => {
    setBusy(id);
    try {
      if (on) {
        const r = await registerForDrive(id);
        if (r.applied) toast.success("Registered — you've also been applied to the linked internship");
        else if (r.needs_questions && r.internship_id)
          toast.success("Registered! This role has a few screening questions", {
            action: { label: "Answer now", onClick: () => router.push(`/internships/${r.internship_id}`) },
          });
        else toast.success("You're registered");
      } else {
        await unregisterFromDrive(id);
        toast.success("Registration cancelled");
      }
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const ack = async (a: Announcement) => {
    setAcking(a.id);
    try {
      await acknowledgeAnnouncement(a.id);
      const done = (x: Announcement) => (x.id === a.id ? { ...x, acknowledged: true } : x);
      setData((d) => (d ? { ...d, announcements: d.announcements.map(done) } : d));
      setOpened((o) => (o ? done(o) : o));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAcking(null);
    }
  };

  const upcoming = data.drives.filter((d) => d.status === "upcoming" || d.status === "ongoing").sort((x, y) => +new Date(x.drive_date) - +new Date(y.drive_date));
  const past = data.drives.filter((d) => d.status === "completed");
  const registered = upcoming.filter((d) => d.registered);
  const open = upcoming.filter((d) => d.eligible || d.registered);
  const next = registered[0] ?? upcoming[0];
  const todo = data.announcements.filter((a) => a.require_ack && !a.acknowledged);
  const status = data.verification_status;
  const uni = data.university.name;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campus"
        subtitle={
          <>
            Placement drives and notices from {uni}.
            {status === "verified" && <span className="ml-1.5 font-medium text-(--verify)">Your profile is verified.</span>}
          </>
        }
      />

      {status !== "verified" && <VerifyCard status={status} note={data.verification_note} checklist={data.checklist ?? []} />}

      <div className="grid gap-4 md:grid-cols-3">
        <NextDriveTile drives={upcoming} />
        <RegisteredTile drives={upcoming} />
        <NoticesTile items={data.announcements} onOpen={setOpened} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <div id="notice-board" className="min-w-0 scroll-mt-24 lg:col-span-7">
          <NoticeBoard items={data.announcements} onOpen={setOpened} />
        </div>

        <div id="placement-drives" className="min-w-0 scroll-mt-24 lg:col-span-5">
          <GlassSection
            i={6}
            tone="violet"
            icon={GraduateIcon}
            kicker="Placement drives"
            title={upcoming.length ? `${upcoming.length} coming up` : "Nothing scheduled"}
            action={registered.length > 0 ? <Pill tone="mint">{registered.length} registered</Pill> : undefined}
          >
            <div className="space-y-3">
              {upcoming.length === 0 && <p className={cn(WELL, "px-4 py-8 text-center text-[0.875rem] text-muted-foreground")}>No upcoming drives right now. You’ll be notified when one opens for you.</p>}
              {upcoming.map((d) => (
                <DriveCard key={d.id} d={d} busy={busy === d.id} focused={focusDrive === d.id} onRegister={(on) => register(d.id, on)} />
              ))}
            </div>
            {past.length > 0 && (
              <div className="mt-5">
                <p className={cn(LABEL, "mb-2 px-1")}>Past drives · {past.length}</p>
                <ul className={cn(WELL, "space-y-0.5")}>
                  {past.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 rounded-[0.8125rem] px-2 py-2">
                      <OrgAvatar name={d.company_display} className="size-8 shrink-0 [&>*]:text-[0.6875rem]" />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-[0.875rem] font-medium">{d.company_display}</span>
                        <span className="mt-0.5 block truncate text-[0.75rem] text-muted-foreground">
                          {fmtDate(d.drive_date)} · {d.internship_title || d.title}
                        </span>
                      </span>
                      {d.outcome === "selected" ? (
                        <Pill tone="mint">Selected</Pill>
                      ) : d.outcome === "not_selected" ? (
                        <Pill tone="mist">Not selected</Pill>
                      ) : d.registered ? (
                        <Pill tone="amber">Result awaited</Pill>
                      ) : (
                        <Pill tone="mist">Didn’t register</Pill>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </GlassSection>
        </div>
      </div>

      <AnnouncementDialog
        a={opened}
        from={`${uni} · ${opened?.author_name ?? "placement cell"}`}
        onClose={() => setOpened(null)}
        acking={acking === opened?.id}
        onAck={opened ? () => ack(opened) : undefined}
      />
    </div>
  );
}

function daysUntil(iso: string) {
  const ms = new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(ms / 86_400_000));
}

// ── notice board ────────────────────────────────────────────────────────────

function NoticeBoard({ items, onOpen }: { items: Announcement[]; onOpen: (a: Announcement) => void }) {
  const [tab, setTab] = React.useState<NoticeTab>("all");
  const [all, setAll] = React.useState(false);
  const todo = items.filter((a) => a.require_ack && !a.acknowledged).length;
  const counts: Record<NoticeTab, number> = {
    all: items.length,
    todo,
    round: items.filter((a) => a.kind === "round").length,
    pinned: items.filter((a) => a.pinned).length,
  };
  const matched = items.filter((a) => (tab === "todo" ? a.require_ack && !a.acknowledged : tab === "round" ? a.kind === "round" : tab === "pinned" ? a.pinned : true));
  const shown = all ? matched : matched.slice(0, 6);
  const list = React.useRef<HTMLUListElement>(null);
  const key = shown.map((a) => a.id).join(",");
  React.useEffect(() => {
    const el = list.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = gsap.fromTo(el.children, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out", stagger: 0.04, clearProps: "transform" });
    return () => {
      t.kill();
    };
  }, [key]);

  return (
    <GlassSection
      i={5}
      tone="amber"
      icon={MegaphoneIcon}
      kicker="Notice board"
      title={todo ? `${todo} waiting for your OK` : items.length ? "You’re all caught up" : "No notices yet"}
      action={todo > 0 ? <Pill tone="amber">Tap Got it</Pill> : undefined}
    >
      <GlassTabs tabs={NOTICE_TABS.map(([v, label]) => [v, label, v === "all" ? undefined : counts[v]] as const)} value={tab} onChange={setTab} />

      {shown.length === 0 ? (
        <p className={cn(WELL, "mt-4 px-4 py-10 text-center text-[0.875rem] text-muted-foreground")}>{items.length ? "Nothing here." : "Notices from your placement cell will show up here."}</p>
      ) : (
        <ul ref={list} className={cn(WELL, "mt-4 space-y-0.5")}>
          {shown.map((a) => (
            <NoticeRow key={a.id} a={a} onOpen={() => onOpen(a)} />
          ))}
        </ul>
      )}
      {matched.length > 6 && (
        <button type="button" onClick={() => setAll((x) => !x)} className="mt-3 w-full rounded-full py-2 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground">
          {all ? "Show fewer" : `Show all ${matched.length}`}
        </button>
      )}
    </GlassSection>
  );
}

function NoticeRow({ a, onOpen }: { a: Announcement; onOpen: () => void }) {
  const k = KIND_META[a.kind] ?? KIND_META.update;
  const needs = a.require_ack && !a.acknowledged;
  return (
    <li>
      <button
        type="button"
        data-ann-open
        onClick={onOpen}
        className={cn(
          "group flex w-full items-start gap-3.5 rounded-[0.9375rem] p-3 text-left transition-colors duration-200 outline-none hover:bg-[color-mix(in_oklab,var(--foreground)_3.5%,transparent)] focus-visible:ring-2 focus-visible:ring-ring",
          needs && "bg-[color-mix(in_oklab,var(--amber-bg)_45%,transparent)]"
        )}
      >
        <span className={cn(`tone-${k.tone}`, "relative flex size-10 shrink-0 items-center justify-center rounded-[0.8125rem] bg-(--t-bg) text-(--t-fg) shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--t-fg)_12%,transparent)] transition-colors duration-200")}>
          <k.Icon className="size-[1.125rem]" />
          {needs && <span aria-label="Needs your OK" className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-(--amber-fg) ring-2 ring-card" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn(`tone-${k.tone}`, LABEL, "text-(--t-fg)")}>{k.label}</span>
            {a.pinned && <PinIcon aria-label="Pinned" className="size-3.5 -rotate-45 text-muted-foreground" />}
            <span className="ml-auto shrink-0 text-[0.75rem] text-muted-foreground">{timeAgo(a.created_at)}</span>
          </span>
          <span className="mt-1 line-clamp-2 block text-[0.9688rem] leading-snug font-medium tracking-[-0.01em] [overflow-wrap:anywhere]">{a.title}</span>
          <span className="mt-1 line-clamp-2 block text-[0.8125rem] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{a.body}</span>
          {(a.event_at || a.venue || a.attachments.length > 0 || a.link_url || needs) && (
            <span className="mt-2.5 flex flex-wrap gap-1.5">
              {a.event_at && <Chip icon={CalendarIcon}>{fmtDateTime(a.event_at)}</Chip>}
              {a.venue && <Chip icon={LocationIcon}>{a.venue}</Chip>}
              {a.attachments.length > 0 && <Chip icon={AttachIcon}>{a.attachments.length === 1 ? a.attachments[0].name : `${a.attachments.length} files`}</Chip>}
              {a.link_url && <Chip icon={LinkIcon}>{a.link_label || "Link"}</Chip>}
              {needs && <Pill tone="amber">Waiting for your OK</Pill>}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function Chip({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 max-w-full min-w-0 items-center gap-1 rounded-full bg-card/80 px-2.5 text-[0.75rem] font-medium shadow-[inset_0_0_0_1px_var(--hairline)]">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{children}</span>
    </span>
  );
}

// ── drives ──────────────────────────────────────────────────────────────────

/** compact action buttons inside a drive card */
const ACT = "h-8 rounded-[0.625rem] px-3.5 text-[0.8125rem]";

function DriveCard({ d, busy, focused, onRegister }: { d: CampusDrive; busy: boolean; focused: boolean; onRegister: (on: boolean) => void }) {
  const ref = React.useRef<HTMLElement>(null);
  const [more, setMore] = React.useState(false);
  const date = new Date(d.drive_date);
  const tone = d.registered ? "mint" : !d.eligible ? "mist" : "violet";
  React.useEffect(() => {
    if (!focused || !ref.current) return;
    ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focused]);
  const deadline = d.registration_deadline && new Date(d.registration_deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <article
      ref={ref}
      className={cn(
        WELL,
        "p-4 transition-shadow duration-500",
        !d.eligible && !d.registered && "opacity-[0.92]",
        focused && "shadow-[inset_0_0_0_1px_var(--hairline),0_0_0_2px_var(--violet-fg),0_18px_40px_-24px_var(--violet-fg)]"
      )}
    >
      <div className="flex gap-3.5">
        <div className={cn(`tone-${tone}`, "flex w-12 shrink-0 flex-col self-start overflow-hidden rounded-[0.875rem] bg-card text-center shadow-[inset_0_0_0_1px_var(--hairline),0_1px_2px_rgb(0_0_0/0.04),0_6px_14px_-10px_rgb(0_0_0/0.25)]")}>
          <span className="bg-[color-mix(in_oklab,var(--t-fg)_12%,transparent)] py-[0.1875rem] text-[0.5625rem] font-semibold tracking-[0.14em] text-[color-mix(in_oklab,var(--t-fg)_75%,white)] uppercase dark:text-(--t-fg)">
            {date.toLocaleDateString("en-IN", { month: "short" })}
          </span>
          <span className="py-1.5 text-[1.25rem] leading-none font-medium tracking-[-0.03em] tabular-nums">{date.getDate()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[1rem] font-medium tracking-[-0.01em]">{d.company_display}</span>
              <span className="mt-0.5 block truncate text-[0.8125rem] text-muted-foreground">{d.internship_title || d.title}</span>
            </p>
            {d.registered ? <Pill tone="mint">Registered</Pill> : !d.eligible ? <Pill tone="mist">Not eligible</Pill> : d.status === "ongoing" ? <Pill tone="amber">Today</Pill> : <Pill tone="violet">Open</Pill>}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.75rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="size-3.5" /> {date.toLocaleDateString("en-IN", { weekday: "short" })}, {date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
            </span>
            {d.venue && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <LocationIcon className="size-3.5 shrink-0" /> <span className="truncate">{d.venue}</span>
              </span>
            )}
          </p>
        </div>
      </div>

      {d.description && (
        <div className="mt-3">
          <p className={cn("text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-foreground/70 [overflow-wrap:anywhere]", !more && "line-clamp-2")}>{d.description}</p>
          {d.description.length > 110 && (
            <button type="button" onClick={() => setMore((m) => !m)} className="mt-0.5 text-[0.75rem] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              {more ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}

      {!d.eligible && !d.registered && d.reasons.length > 0 && (
        <div className="mt-3 flex items-start gap-2.5 rounded-[0.75rem] bg-[color-mix(in_oklab,var(--foreground)_3.5%,transparent)] px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--hairline)]">
          <Info className="mt-px size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 text-[0.8125rem] leading-snug">
            <span className="font-medium">Not open to you</span>
            <span className="text-muted-foreground"> — {d.reasons.join(" · ")}</span>
          </p>
        </div>
      )}

      <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-(--hairline) pt-3">
        {d.registered ? (
          d.status === "upcoming" && (
            <AlertDialog>
              <AlertDialogTrigger render={<Button size="sm" variant="ghost" className={cn(ACT, "text-muted-foreground")} disabled={busy} />}>
                {busy && <Loader2 className="animate-spin" />} Cancel registration
              </AlertDialogTrigger>
              <AlertDialogContent className="gap-5 rounded-[1.5rem] p-6 shadow-[0_40px_90px_-30px_rgb(0_0_0/0.45)] ring-(--hairline) data-[size=default]:sm:max-w-md">
                <AlertDialogHeader className="text-left">
                  <AlertDialogTitle className="text-[1.1875rem] font-medium tracking-[-0.015em]">Cancel your registration?</AlertDialogTitle>
                  <AlertDialogDescription className="text-[0.875rem] leading-relaxed">
                    You’ll give up your place at <b className="font-medium text-foreground">{d.company_display}</b> on {date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}.
                    {d.registration_open ? (deadline ? ` You can register again until ${deadline}.` : " You can register again while it’s open.") : " Registration is closed, so you won’t be able to sign up again."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2 sm:justify-end">
                  <AlertDialogCancel className="rounded-full">Keep my place</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onRegister(false)} className="rounded-full bg-destructive text-white hover:bg-destructive/90">
                    Cancel registration
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )
        ) : (
          <Button size="sm" className={ACT} disabled={!d.eligible || !d.registration_open || busy} onClick={() => onRegister(true)}>
            {busy && <Loader2 className="animate-spin" />} {d.registration_open ? "Register" : "Registration closed"}
          </Button>
        )}
        {d.internship && (
          <Button size="sm" variant="outline" className={ACT} render={<Link href={`/internships/${d.internship}`} />} nativeButton={false}>
            View role
          </Button>
        )}
        <span className="ml-auto text-[0.75rem] text-muted-foreground tabular-nums">
          {d.registrations_count} registered{deadline && ` · by ${deadline}`}
        </span>
      </div>
    </article>
  );
}
