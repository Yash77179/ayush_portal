"use client";

/**
 * The top of a student's Campus page: a one-line verification status, and three at-a-glance cards —
 * the next drive on a two-week calendar, the drives you can join (and whether you have), and your latest notices.
 * Every figure is real data.
 */

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";

import { timeAgo, type Announcement, type StudentCampus } from "@/lib/ats";
import { KIND_META } from "@/components/announcement-card";
import { ArrowRightIcon, ArrowRightUpIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, GraduateIcon, MegaphoneIcon } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { OrgAvatar, stagger } from "@/components/kit";

type CampusDrive = StudentCampus["drives"][number];

export const CARD =
  "rise relative isolate overflow-hidden rounded-[1.5rem] border border-(--hairline) bg-[linear-gradient(180deg,color-mix(in_oklab,var(--violet-bg)_70%,var(--card))_0%,var(--card)_62%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.75),0_1px_2px_rgb(0_0_0/0.03),0_18px_40px_-28px_oklch(0.25_0.06_280/0.35)] dark:bg-[linear-gradient(180deg,color-mix(in_oklab,var(--violet-bg)_45%,var(--card))_0%,var(--card)_62%)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_18px_40px_-28px_rgb(0_0_0/0.8)]";
/** frosted inset that holds a card's detail, floating over the card's colour glow */
export const WELL = "rounded-[1.125rem] bg-[color-mix(in_oklab,var(--card)_62%,transparent)] p-1.5 shadow-[inset_0_0_0_1px_var(--hairline)] backdrop-blur-xl";
/** small caps label — the quietest level of the hierarchy */
export const LABEL = "text-[0.6875rem] font-medium tracking-[0.09em] text-muted-foreground uppercase";
const DAY = 86_400_000;
const startOfDay = (d: Date | number | string) => new Date(new Date(d).setHours(0, 0, 0, 0)).getTime();
const short = (d: string | number) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

// ── verification: one quiet line ────────────────────────────────────────────

export function VerifyCard({ status, note, checklist }: { status?: string; note?: string; checklist: { key: string; label: string; done: boolean }[] }) {
  const missing = checklist.filter((c) => !c.done);
  const rejected = status === "rejected";
  const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

  const [title, detail] = rejected
    ? ["Your placement cell sent your profile back", `“${note}”`]
    : missing.length
      ? [`Add your ${list(missing.map((m) => m.label))} to get verified`, `${checklist.length - missing.length} of ${checklist.length} details in`]
      : ["Your placement cell is reviewing your profile", `All ${checklist.length} details are in. We’ll notify you the moment you’re verified.`];

  const kicker = rejected ? "Changes requested" : missing.length ? "Not verified yet" : "Verification pending";

  return (
    <div className={cn(CARD, "flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 sm:px-6")} style={stagger(1)}>
      <div className="min-w-0 flex-1">
        <p className={cn(LABEL, rejected ? "text-(--pink-fg)" : "text-(--verify)")}>{kicker}</p>
        <p className="mt-1 text-[1.0625rem] leading-snug font-medium tracking-[-0.01em]">{title}</p>
        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{detail}</p>
      </div>
      <Link
        href="/dashboard/student/profile"
        className="group inline-flex h-9 items-center gap-1.5 rounded-full bg-card/70 px-4 text-[0.8125rem] font-medium shadow-[inset_0_0_0_1px_var(--hairline),0_1px_2px_rgb(0_0_0/0.04)] backdrop-blur transition-colors hover:bg-card"
      >
        {missing.length || rejected ? "Update profile" : "Review profile"}
        <ArrowRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

// ── cards ───────────────────────────────────────────────────────────────────

function Tile({
  i,
  tone,
  icon: Icon,
  label,
  value,
  unit,
  pill,
  href,
  children,
}: {
  i: number;
  tone: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  unit?: string;
  pill?: React.ReactNode;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(CARD, "group/tile flex flex-col p-5")} style={stagger(i)}>
      {/* the card's colour, as a soft glow in the top corner */}
      <header className="flex items-center gap-2.5">
        <span className={cn(`tone-${tone}`, "flex size-8 items-center justify-center rounded-[0.625rem] bg-(--t-bg) text-(--t-fg) shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--t-fg)_14%,transparent)]")}>
          <Icon className="size-4" />
        </span>
        <h3 className={cn(LABEL, "flex-1")}>{label}</h3>
        {href && (
          <Link href={href} aria-label={`Open ${label.toLowerCase()}`} className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground">
            <ArrowRightUpIcon className="size-4" />
          </Link>
        )}
      </header>
      <div className="mt-4 flex items-end gap-2">
        <span className="bg-[linear-gradient(180deg,var(--foreground)_30%,color-mix(in_oklab,var(--foreground)_55%,transparent))] bg-clip-text pb-0.5 text-[2.75rem] leading-none font-light tracking-[-0.05em] text-transparent tabular-nums">
          {value}
        </span>
        {unit && <span className="pb-1.5 text-[0.875rem] text-muted-foreground">{unit}</span>}
        {pill && <span className="ml-auto pb-1.5">{pill}</span>}
      </div>
      <div className={cn(WELL, "mt-4 flex flex-1 flex-col")}>{children}</div>
    </section>
  );
}

/** A status tag: a rounded square of tinted glass, a shade deeper than the card's colours. */
export function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        `tone-${tone}`,
        "inline-flex h-6 shrink-0 items-center rounded-[0.4375rem] px-2 text-[0.75rem] font-medium whitespace-nowrap backdrop-blur-md",
        "bg-[color-mix(in_oklab,var(--t-fg)_11%,transparent)] text-[color-mix(in_oklab,var(--t-fg)_68%,white)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--t-fg)_24%,transparent),inset_0_1px_0_rgb(255_255_255/0.45)]",
        "dark:bg-[color-mix(in_oklab,var(--t-fg)_18%,transparent)] dark:text-(--t-fg) dark:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--t-fg)_30%,transparent),inset_0_1px_0_rgb(255_255_255/0.06)]"
      )}
    >
      {children}
    </span>
  );
}

/** A row inside a card: leading visual, two lines, trailing status. */
function Row({ lead, title, meta, trail, onClick, href }: { lead: React.ReactNode; title: string; meta: string; trail?: React.ReactNode; onClick?: () => void; href?: string }) {
  const body = (
    <>
      {lead}
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[0.875rem] font-medium tracking-[-0.005em]">{title}</span>
        <span className="mt-0.5 block truncate text-[0.75rem] text-muted-foreground">{meta}</span>
      </span>
      {trail}
    </>
  );
  const cls = "flex items-center gap-2.5 rounded-[0.8125rem] px-2 py-2 text-left transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--foreground)_3.5%,transparent)]";
  if (href)
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    );
  return <div className={cn(cls, "hover:bg-transparent")}>{body}</div>;
}

function More({ n, onClick }: { n: number; onClick?: () => void }) {
  if (n <= 0) return null;
  return (
    <button type="button" onClick={onClick} className="mt-0.5 self-start rounded-full px-2 py-1 text-[0.75rem] font-medium text-muted-foreground transition-colors hover:text-foreground">
      +{n} more
    </button>
  );
}

const toSection = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/** where you stand with a drive → the colour it gets everywhere (calendar, tags) */
const driveTone = (d: CampusDrive) => (d.registered ? "mint" : d.eligible ? "violet" : "mist");
const dayTone = (list: CampusDrive[]) => (list.some((d) => d.registered) ? "mint" : list.some((d) => d.eligible) ? "violet" : "mist");
const statusLabel = (d: CampusDrive) => (d.registered ? "Registered" : !d.eligible ? "Not eligible" : d.registration_open ? "Open" : "Closed");
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const GLASS_DAY =
  "bg-[color-mix(in_oklab,var(--t-fg)_14%,transparent)] font-semibold text-[color-mix(in_oklab,var(--t-fg)_72%,white)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--t-fg)_30%,transparent),inset_0_1px_0_rgb(255_255_255/0.5)] backdrop-blur-md dark:bg-[color-mix(in_oklab,var(--t-fg)_22%,transparent)] dark:text-(--t-fg)";

/**
 * Next drive, and a two-week calendar you can page through. Drive days take the colour of where you stand
 * (registered, open to you, not eligible); hover one for its details, tap it to list that day's drives below.
 */
export function NextDriveTile({ drives }: { drives: CampusDrive[] }) {
  const [today] = React.useState(() => startOfDay(Date.now()));
  const [page, setPage] = React.useState(0);
  const [picked, setPicked] = React.useState<number | null>(null);
  const next = drives.find((d) => d.registered) ?? drives[0];
  const inDays = next ? Math.max(0, Math.round((startOfDay(next.drive_date) - today) / DAY)) : null;

  const last = drives.reduce((m, d) => Math.max(m, startOfDay(d.drive_date)), today);
  const pages = Math.max(1, Math.ceil((last - today + DAY) / (14 * DAY)));
  const start = today + page * 14 * DAY;
  const days = Array.from({ length: 14 }, (_, k) => {
    const t = start + k * DAY;
    return { t, list: drives.filter((d) => startOfDay(d.drive_date) === t) };
  });
  const focus = picked ?? (next ? startOfDay(next.drive_date) : null);
  const focusList = focus === null ? [] : drives.filter((d) => startOfDay(d.drive_date) === focus);
  const range = `${short(start)} – ${short(start + 13 * DAY)}`;

  return (
    <Tile
      i={2}
      tone="violet"
      icon={CalendarIcon}
      label="Next drive"
      value={inDays === null ? "—" : inDays === 0 ? "Today" : inDays}
      unit={inDays ? `day${inDays === 1 ? "" : "s"} to go` : undefined}
      pill={next ? <Pill tone={driveTone(next)}>{statusLabel(next)}</Pill> : undefined}
    >
      <div className="flex items-center gap-1 px-1 pt-0.5 pb-1.5">
        <span className="flex-1 text-[0.75rem] font-medium text-muted-foreground tabular-nums">{range}</span>
        <button type="button" aria-label="Earlier two weeks" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className={NAV}>
          <ChevronLeftIcon className="size-4" />
        </button>
        <button type="button" aria-label="Next two weeks" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className={NAV}>
          <ChevronRightIcon className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 px-1" aria-label={`Drives, ${range}`}>
        {days.map(({ t, list }) => {
          const d = new Date(t);
          const isToday = t === today;
          const on = focus === t && list.length > 0;
          const face = (
            <>
              <span className="text-[0.5625rem] font-medium uppercase opacity-60">{d.toLocaleDateString("en-IN", { weekday: "narrow" })}</span>
              <span className="mt-1 text-[0.8125rem] font-medium">{d.getDate()}</span>
            </>
          );
          const base = "flex h-10 flex-col items-center justify-center rounded-[0.625rem] leading-none tabular-nums transition-[box-shadow,transform] duration-150";
          if (!list.length)
            return (
              <span
                key={t}
                className={cn(
                  base,
                  "bg-[color-mix(in_oklab,var(--card)_75%,transparent)] text-muted-foreground shadow-[inset_0_0_0_1px_var(--hairline)]",
                  isToday && "tone-violet font-semibold text-foreground shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--t-fg)_45%,transparent)]"
                )}
              >
                {face}
              </span>
            );
          return (
            <Tooltip key={t}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={`${d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}: ${list.map((x) => `${x.company_display}, ${statusLabel(x)}`).join("; ")}`}
                    onClick={() => setPicked(t)}
                    className={cn(`tone-${dayTone(list)}`, base, GLASS_DAY, "hover:-translate-y-px", on && "ring-2 ring-[color-mix(in_oklab,var(--t-fg)_55%,transparent)] ring-offset-1 ring-offset-card")}
                  />
                }
              >
                {face}
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8} className="max-w-[16rem] flex-col items-stretch gap-2 rounded-[0.875rem] bg-popover p-3 text-popover-foreground shadow-[0_12px_32px_-12px_rgb(0_0_0/0.35)] ring-1 ring-(--hairline) [&>:last-child]:hidden">
                <div className="space-y-2.5">
                  <p className={LABEL}>{d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</p>
                  {list.map((x) => (
                    <div key={x.id} className="space-y-1">
                      <p className="flex items-center gap-2 text-[0.875rem] font-medium">
                        <span className="min-w-0 flex-1 truncate">{x.company_display}</span>
                        <Pill tone={driveTone(x)}>{statusLabel(x)}</Pill>
                      </p>
                      <p className="text-[0.75rem] text-muted-foreground">{x.internship_title || x.title}</p>
                      <p className="text-[0.75rem] text-muted-foreground">
                        {timeOf(x.drive_date)}
                        {x.venue && ` · ${x.venue}`}
                      </p>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 pt-2.5 pb-1 text-[0.6875rem] text-muted-foreground">
        {(
          [
            ["mint", "Registered"],
            ["violet", "Open to you"],
            ["mist", "Not eligible"],
          ] as const
        ).map(([tone, label]) => (
          <span key={tone} className="inline-flex items-center gap-1.5">
            <span className={cn(`tone-${tone}`, "size-2.5 rounded-[0.1875rem]", GLASS_DAY)} /> {label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="tone-violet size-2.5 rounded-[0.1875rem] shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--t-fg)_45%,transparent)]" /> Today
        </span>
      </div>

      <div className="mt-auto border-t border-(--hairline) pt-1.5">
        {focusList.length ? (
          focusList.map((x) => (
            <Row
              key={x.id}
              href={`/dashboard/student/campus?drive=${x.id}`}
              lead={<OrgAvatar name={x.company_display} className="size-8 shrink-0 [&>*]:text-[0.6875rem]" />}
              title={x.company_display}
              meta={`${new Date(x.drive_date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · ${timeOf(x.drive_date)}${x.venue ? ` · ${x.venue}` : ""}`}
              trail={<Pill tone={driveTone(x)}>{statusLabel(x)}</Pill>}
            />
          ))
        ) : (
          <p className="px-2 py-2.5 text-[0.8125rem] text-muted-foreground">{drives.length ? "Tap a coloured day to see its drives." : "No drives scheduled yet."}</p>
        )}
      </div>
    </Tile>
  );
}

const NAV =
  "flex size-7 items-center justify-center rounded-[0.5rem] text-muted-foreground transition-colors hover:bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] hover:text-foreground disabled:pointer-events-none disabled:opacity-30";

/** The drives you can join, each with where you stand. */
export function RegisteredTile({ drives }: { drives: CampusDrive[] }) {
  const open = drives.filter((d) => d.eligible || d.registered);
  const mine = open.filter((d) => d.registered).length;
  const left = open.length - mine;

  return (
    <Tile
      i={3}
      tone="mint"
      icon={GraduateIcon}
      label="Registered"
      value={mine}
      unit={`of ${open.length} drive${open.length === 1 ? "" : "s"}`}
      pill={open.length ? left ? <Pill tone="amber">{left} to register</Pill> : <Pill tone="mint">All in</Pill> : undefined}
    >
      {open.length === 0 ? (
        <p className="px-2 py-2 text-[0.8125rem] text-muted-foreground">No drives you can join right now.</p>
      ) : (
        <div className="flex flex-col">
          {open.slice(0, 3).map((d) => (
            <Row
              key={d.id}
              href={`/dashboard/student/campus?drive=${d.id}`}
              lead={<OrgAvatar name={d.company_display} className="size-8 shrink-0 [&>*]:text-[0.6875rem]" />}
              title={d.company_display}
              meta={`${short(d.drive_date)} · ${d.internship_title || d.title}`}
              trail={
                d.registered ? (
                  <Pill tone="mint">Registered</Pill>
                ) : d.registration_open ? (
                  <Pill tone="violet">{d.registration_deadline ? `Open · by ${short(d.registration_deadline)}` : "Open"}</Pill>
                ) : (
                  <Pill tone="mist">Closed</Pill>
                )
              }
            />
          ))}
          <More n={open.length - 3} onClick={toSection("placement-drives")} />
        </div>
      )}
    </Tile>
  );
}

/** Latest notices; the ones still waiting for your "Got it" come first and are marked. */
export function NoticesTile({ items, onOpen }: { items: Announcement[]; onOpen: (a: Announcement) => void }) {
  const waiting = items.filter((a) => a.require_ack && !a.acknowledged);
  const rows = [...waiting, ...items.filter((a) => !waiting.includes(a))].slice(0, 3);

  return (
    <Tile
      i={4}
      tone="amber"
      icon={MegaphoneIcon}
      label="Needs your OK"
      value={waiting.length}
      unit={waiting.length ? "waiting on you" : `of ${items.length} notices`}
      pill={items.length ? waiting.length ? <Pill tone="amber">Tap Got it</Pill> : <Pill tone="mint">All read</Pill> : undefined}
    >
      {rows.length === 0 ? (
        <p className="px-2 py-2 text-[0.8125rem] text-muted-foreground">No notices yet.</p>
      ) : (
        <div className="flex flex-col">
          {rows.map((a) => {
            const k = KIND_META[a.kind] ?? KIND_META.update;
            return (
              <Row
                key={a.id}
                onClick={() => onOpen(a)}
                lead={
                  <span className={cn(`tone-${k.tone}`, "flex size-8 shrink-0 items-center justify-center rounded-[0.625rem] bg-(--t-bg) text-(--t-fg)")}>
                    <k.Icon className="size-4" />
                  </span>
                }
                title={a.title}
                meta={`${k.label} · ${timeAgo(a.created_at)}`}
                trail={a.require_ack && !a.acknowledged ? <Pill tone="amber">Waiting</Pill> : undefined}
              />
            );
          })}
          <More n={items.length - rows.length} onClick={toSection("notice-board")} />
        </div>
      )}
    </Tile>
  );
}

// ── big sections (Notice board, Placement drives) in the same glass ─────────

/** A full section card: colour glow, icon + small-caps kicker, a real heading, an action on the right. */
export function GlassSection({
  i,
  tone,
  icon: Icon,
  kicker,
  title,
  action,
  className,
  children,
}: {
  i: number;
  tone: string;
  icon: React.ComponentType<{ className?: string }>;
  kicker: string;
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(CARD, "group/tile p-5 sm:p-6", className)} style={stagger(i)}>
      <header className="flex items-center gap-3">
        <span className={cn(`tone-${tone}`, "flex size-10 shrink-0 items-center justify-center rounded-[0.8125rem] bg-(--t-bg) text-(--t-fg) shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--t-fg)_14%,transparent)]")}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className={LABEL}>{kicker}</p>
          <h2 className="mt-1 truncate text-[1.25rem] font-medium tracking-[-0.02em]">{title}</h2>
        </div>
        {action}
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Segmented filter in frosted glass. */
export function GlassTabs<T extends string>({ tabs, value, onChange }: { tabs: readonly (readonly [T, string, number?])[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-[color-mix(in_oklab,var(--secondary)_70%,transparent)] p-1 shadow-[inset_0_0_0_1px_var(--hairline)] backdrop-blur">
      {tabs.map(([v, label, n]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "inline-flex h-8 flex-1 shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-[0.8125rem] font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-200",
            value === v ? "bg-card text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_-6px_rgb(0_0_0/0.18)]" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
          {n !== undefined && n > 0 && <span className="rounded-full bg-foreground/8 px-1.5 text-[0.6875rem] tabular-nums">{n}</span>}
        </button>
      ))}
    </div>
  );
}
