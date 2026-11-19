"use client";

/**
 * One announcement as a student sees it on their Campus page. The placement cell's composer renders the same card
 * as its live preview, so what they see while writing is exactly what arrives.
 */

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "cn";

import { fmtDateTime, timeAgo, type Announcement, type AnnouncementKind } from "@/lib/ats";
import {
  ArrowRightUpIcon,
  CalendarIcon,
  DownloadIcon,
  FileTextIcon,
  FlagIcon,
  GalleryIcon,
  HourglassIcon,
  LocationIcon,
  MegaphoneIcon,
  PinIcon,
  ReminderIcon,
  UrgentIcon,
} from "@/components/icons";

export const KIND_META: Record<AnnouncementKind, { label: string; tone: string; Icon: React.ComponentType<{ className?: string }> }> = {
  update: { label: "Update", tone: "blue", Icon: MegaphoneIcon },
  round: { label: "Drive round", tone: "violet", Icon: FlagIcon },
  reminder: { label: "Reminder", tone: "amber", Icon: ReminderIcon },
  urgent: { label: "Urgent", tone: "pink", Icon: UrgentIcon },
};

export const fileSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** A coloured file-type tile: PDF red, Word blue, sheets green, slides orange, images violet. */
export function FileGlyph({ name, className }: { name: string; className?: string }) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const map: Record<string, [string, string]> = {
    pdf: ["PDF", "bg-[oklch(0.94_0.04_25)] text-[oklch(0.5_0.17_27)] dark:bg-[oklch(0.33_0.07_25)] dark:text-[oklch(0.85_0.09_25)]"],
    doc: ["DOC", "bg-[oklch(0.94_0.035_255)] text-[oklch(0.45_0.15_258)] dark:bg-[oklch(0.32_0.06_258)] dark:text-[oklch(0.85_0.08_255)]"],
    docx: ["DOC", "bg-[oklch(0.94_0.035_255)] text-[oklch(0.45_0.15_258)] dark:bg-[oklch(0.32_0.06_258)] dark:text-[oklch(0.85_0.08_255)]"],
    xls: ["XLS", "bg-[oklch(0.94_0.04_155)] text-[oklch(0.45_0.12_155)] dark:bg-[oklch(0.32_0.06_155)] dark:text-[oklch(0.85_0.1_155)]"],
    xlsx: ["XLS", "bg-[oklch(0.94_0.04_155)] text-[oklch(0.45_0.12_155)] dark:bg-[oklch(0.32_0.06_155)] dark:text-[oklch(0.85_0.1_155)]"],
    csv: ["CSV", "bg-[oklch(0.94_0.04_155)] text-[oklch(0.45_0.12_155)] dark:bg-[oklch(0.32_0.06_155)] dark:text-[oklch(0.85_0.1_155)]"],
    ppt: ["PPT", "bg-[oklch(0.95_0.045_55)] text-[oklch(0.52_0.14_50)] dark:bg-[oklch(0.34_0.06_55)] dark:text-[oklch(0.86_0.09_60)]"],
    pptx: ["PPT", "bg-[oklch(0.95_0.045_55)] text-[oklch(0.52_0.14_50)] dark:bg-[oklch(0.34_0.06_55)] dark:text-[oklch(0.86_0.09_60)]"],
    zip: ["ZIP", "bg-secondary text-muted-foreground"],
    txt: ["TXT", "bg-secondary text-muted-foreground"],
  };
  const image = ["png", "jpg", "jpeg", "webp"].includes(ext);
  const [label, cls] = map[ext] ?? ["FILE", "bg-secondary text-muted-foreground"];
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-[0.75rem] text-[0.625rem] font-semibold tracking-[0.04em]",
        image ? "bg-[oklch(0.94_0.035_295)] text-[oklch(0.48_0.15_295)] dark:bg-[oklch(0.32_0.07_295)] dark:text-[oklch(0.86_0.08_295)]" : cls,
        className
      )}
    >
      {image ? <GalleryIcon className="size-[1.125rem]" /> : label === "FILE" ? <FileTextIcon className="size-[1.125rem]" /> : label}
    </span>
  );
}

export type CardData = Pick<
  Announcement,
  "title" | "body" | "kind" | "pinned" | "link_url" | "link_label" | "event_at" | "venue" | "expires_at" | "require_ack" | "acknowledged" | "author_name" | "created_at"
> & { attachments: { id: number | string; name: string; size: number; url?: string }[] };

export function AnnouncementCard({
  a,
  from,
  onAck,
  acking,
  preview,
  full,
  className,
}: {
  a: CardData;
  from?: string;
  onAck?: () => void;
  acking?: boolean;
  /** composer preview: placeholders for empty fields, nothing is clickable */
  preview?: boolean;
  /** opened on its own (the detail popup): everything shown, nothing clamped, roomier type */
  full?: boolean;
  className?: string;
}) {
  const k = KIND_META[a.kind] ?? KIND_META.update;
  const [open, setOpen] = React.useState(false);
  const long = !full && a.body.length > 260;
  const hasEvent = !!a.event_at || !!a.venue;

  return (
    <article className={cn(`tone-${k.tone}`, "relative overflow-hidden rounded-[1.375rem] bg-card ring-1 ring-(--hairline)", className)}>
      {/* the type's colour as a soft wash along the top edge */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-(--t-bg) to-transparent" />
      <div className={cn("relative space-y-3.5", full ? "space-y-5 p-6 sm:p-8" : "p-5")}>
        <header className={cn("flex items-center gap-2.5", full && "pr-11")}>
          <span className="flex size-8 items-center justify-center rounded-full bg-card text-(--t-fg) ring-1 ring-[color-mix(in_oklab,var(--t-fg)_18%,transparent)]">
            <k.Icon className="size-4" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[0.8125rem] font-medium">{from ?? a.author_name}</p>
            <p className="text-[0.75rem] text-muted-foreground">
              {k.label} · {preview ? "now" : timeAgo(a.created_at)}
            </p>
          </div>
          {a.pinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-lime px-2 py-0.5 text-[0.6875rem] font-medium text-(--on-lime)">
              <PinIcon className="size-3 -rotate-45" /> Pinned
            </span>
          )}
        </header>

        <div>
          <h3 className={cn("leading-snug font-medium tracking-[-0.01em]", full ? "pr-8 text-[1.5rem] leading-tight tracking-[-0.02em]" : "text-[1.0625rem]", !a.title && "text-muted-foreground/50")}>{a.title || "Your title"}</h3>
          <p className={cn("mt-1.5 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]", full ? "mt-3 text-[1rem]" : "text-[0.9375rem]", a.body ? "text-foreground/80" : "text-muted-foreground/50", long && !open && "line-clamp-5")}>
            {a.body || "Your message shows here — exactly as students will read it."}
          </p>
          {long && !preview && (
            <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-[0.8125rem] font-medium underline-offset-4 hover:underline">
              {open ? "Show less" : "Read more"}
            </button>
          )}
        </div>

        {hasEvent && (
          <div className="flex items-stretch overflow-hidden rounded-[1rem] bg-(--t-bg)">
            {a.event_at && (
              <div className="flex w-16 shrink-0 flex-col items-center justify-center bg-[color-mix(in_oklab,var(--t-fg)_10%,transparent)] py-2.5 text-(--t-fg)">
                <span className="text-[1.375rem] leading-none font-light tabular-nums">{new Date(a.event_at).getDate()}</span>
                <span className="mt-1 text-[0.625rem] font-semibold tracking-[0.12em] uppercase">{new Date(a.event_at).toLocaleDateString("en-IN", { month: "short" })}</span>
              </div>
            )}
            <div className="min-w-0 space-y-0.5 px-3.5 py-2.5 text-[0.875rem]">
              {a.event_at && (
                <p className="flex items-center gap-1.5 font-medium">
                  <CalendarIcon className="size-4 shrink-0 text-(--t-fg)" /> {fmtDateTime(a.event_at)}
                </p>
              )}
              {a.venue && (
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <LocationIcon className="size-4 shrink-0" /> <span className="truncate">{a.venue}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {a.attachments.length > 0 && (
          <ul className="space-y-1.5">
            {a.attachments.map((f) => {
              const row = (
                <>
                  <FileGlyph name={f.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.875rem] font-medium">{f.name}</span>
                    <span className="block text-[0.75rem] text-muted-foreground">{fileSize(f.size)}</span>
                  </span>
                  <DownloadIcon className="size-[1.125rem] text-muted-foreground transition-transform duration-200 group-hover/file:translate-y-0.5" />
                </>
              );
              return (
                <li key={f.id}>
                  {f.url && !preview ? (
                    <a href={f.url} target="_blank" rel="noreferrer" className="group/file flex items-center gap-3 rounded-[0.875rem] bg-secondary/60 p-2 pr-3 transition-colors hover:bg-secondary">
                      {row}
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 rounded-[0.875rem] bg-secondary/60 p-2 pr-3">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {(a.link_url || a.require_ack) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {a.require_ack &&
              (a.acknowledged ? (
                <span className="inline-flex h-10 items-center gap-2 rounded-full bg-(--mint-bg) px-4 text-[0.875rem] font-medium text-(--mint-fg)">
                  <span aria-hidden className="size-1.5 rounded-full bg-current" /> Marked as seen
                </span>
              ) : (
                <button
                  type="button"
                  disabled={preview || acking || !onAck}
                  onClick={onAck}
                  className="relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-full bg-(--t-bg) px-5 text-[0.875rem] font-medium text-(--t-fg) shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--t-fg)_28%,transparent),0_1px_2px_rgb(0_0_0/0.04)] transition-[transform,box-shadow,background-color] duration-150 hover:bg-[color-mix(in_oklab,var(--t-fg)_14%,var(--t-bg))] active:scale-[0.97] disabled:cursor-default"
                >
                  {acking && <Loader2 className="size-4 animate-spin" />} Got it
                </button>
              ))}
            {a.link_url && (
              <a
                href={preview ? undefined : a.link_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-card px-4 text-[0.875rem] font-medium ring-1 ring-(--hairline) transition-colors hover:bg-secondary"
              >
                {a.link_label || "Open link"} <ArrowRightUpIcon className="size-4" />
              </a>
            )}
          </div>
        )}

        {a.expires_at && (
          <p className="flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
            <HourglassIcon className="size-3.5" /> Visible until {fmtDateTime(a.expires_at)}
          </p>
        )}
      </div>
    </article>
  );
}
