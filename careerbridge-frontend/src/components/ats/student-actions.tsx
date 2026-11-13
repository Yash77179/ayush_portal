"use client";

/** Student side of the hiring loop: confirm interviews, answer offers, read an application's timeline. */

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";

import { errorMessage } from "@/lib/api";
import {
  STAGE_LABEL,
  downloadIcs,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  getStudentApplication,
  respondToInterview,
  respondToOffer,
  type Offer,
  type StudentApplication,
  type StudentInterview,
} from "@/lib/ats";
import { CalendarIcon, PhoneIcon, VideoIcon } from "@/components/icons";
import { OrgAvatar, Panel, StatusBadge, stagger } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type AppLike = Pick<StudentApplication, "id" | "status" | "internship"> & { interviews?: StudentInterview[]; offer?: Offer | null };

function ModeIcon({ mode }: { mode: string }) {
  return mode === "video" ? <VideoIcon className="size-5" /> : mode === "phone" ? <PhoneIcon className="size-5" /> : <CalendarIcon className="size-5" />;
}

export function ActionCenter({ apps, demo, onChanged }: { apps: AppLike[]; demo?: boolean; onChanged: () => void }) {
  const [reschedule, setReschedule] = React.useState<StudentInterview | null>(null);
  const [decline, setDecline] = React.useState<Offer | null>(null);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [now, setNow] = React.useState(0);
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setNow(Date.now()));
    return () => cancelAnimationFrame(raf);
  }, []);

  const offers = apps.filter((a) => a.offer && a.offer.status === "pending" && !a.offer.is_expired).map((a) => ({ app: a, offer: a.offer! }));
  const interviews = apps
    .flatMap((a) => (a.interviews ?? []).map((i) => ({ app: a, i })))
    .filter(({ i }) => i.status === "scheduled" && new Date(i.scheduled_at).getTime() > now - 2 * 3600_000)
    .sort((x, y) => +new Date(x.i.scheduled_at) - +new Date(y.i.scheduled_at));

  if (demo || (offers.length === 0 && interviews.length === 0)) return null;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      onChanged();
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={cn("grid items-start gap-5", offers.length > 0 && interviews.length > 0 && "lg:grid-cols-2")}>
        {offers.length > 0 && (
          <Panel title="Offers to answer" tone="mint" style={stagger(1)} contentClassName="space-y-3">
            {offers.map(({ app, offer }) => (
              <div key={offer.id} className="flex flex-col gap-3 rounded-[22px] bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <OrgAvatar name={app.internship.company_name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-medium">{offer.role_title}</p>
                    <p className="truncate text-[14.5px] text-muted-foreground">
                      {app.internship.company_name} · {fmtMoney(offer.stipend)}/mo · starts {fmtDate(offer.start_date)}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[14.5px] text-muted-foreground">Reply by {fmtDate(offer.expires_on)}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button disabled={busy} onClick={() => run(() => respondToOffer(offer.id, "accept"), "Offer accepted — congratulations! 🎉")}>
                    Accept
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => { setNote(""); setDecline(offer); }}>
                    Decline
                  </Button>
                  <Button variant="ghost" render={<Link href={`/offers/${offer.id}`} target="_blank" />} nativeButton={false}>
                    Offer letter
                  </Button>
                </div>
              </div>
            ))}
          </Panel>
        )}
        {interviews.length > 0 && (
          <Panel title="Upcoming interviews" tone="blue" style={stagger(2)} contentClassName="space-y-3">
            {interviews.map(({ app, i }) => (
              <div key={i.id} className="rounded-[22px] bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary">
                    <ModeIcon mode={i.mode} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-medium">
                      {i.round_name} · {app.internship.company_name}
                    </p>
                    <p className="text-[14.5px] text-muted-foreground">
                      {fmtDateTime(i.scheduled_at)} · {i.duration_minutes} min
                    </p>
                    {i.location && <p className="text-[14.5px]">{i.location}</p>}
                    {i.instructions && <p className="mt-1 text-[14.5px] whitespace-pre-wrap text-muted-foreground">{i.instructions}</p>}
                  </div>
                  {i.candidate_response !== "pending" && (
                    <Badge variant={i.candidate_response === "confirmed" ? "success" : "warning"}>
                      {i.candidate_response === "confirmed" ? "Confirmed" : "Reschedule asked"}
                    </Badge>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {i.candidate_response !== "confirmed" && (
                    <Button size="sm" disabled={busy} onClick={() => run(() => respondToInterview(i.id, "confirmed"), "Confirmed — good luck!")}>
                      Confirm
                    </Button>
                  )}
                  {i.candidate_response !== "reschedule" && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => { setNote(""); setReschedule(i); }}>
                      Ask to reschedule
                    </Button>
                  )}
                  {i.meeting_link && (
                    <Button size="sm" variant="ghost" render={<a href={i.meeting_link} target="_blank" rel="noreferrer" />} nativeButton={false}>
                      Meeting link
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => downloadIcs(i.id).catch((e) => toast.error(errorMessage(e)))}>
                    Add to calendar
                  </Button>
                </div>
              </div>
            ))}
          </Panel>
        )}
      </div>

      <Dialog open={!!reschedule} onOpenChange={(o) => !o && setReschedule(null)}>
        <DialogContent className="max-w-md rounded-[32px] p-7">
          <DialogHeader>
            <DialogTitle className="text-2xl font-medium tracking-tight">Ask to reschedule</DialogTitle>
            <DialogDescription>Tell the recruiter which days and times work for you.</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="I have an exam that morning — any time after 2 pm on Thu or Fri works." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReschedule(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !note.trim()}
              onClick={async () => {
                if (reschedule && (await run(() => respondToInterview(reschedule.id, "reschedule", note), "Request sent to the recruiter"))) setReschedule(null);
              }}
            >
              {busy && <Loader2 className="animate-spin" />} Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!decline} onOpenChange={(o) => !o && setDecline(null)}>
        <DialogContent className="max-w-md rounded-[32px] p-7">
          <DialogHeader>
            <DialogTitle className="text-2xl font-medium tracking-tight">Decline this offer?</DialogTitle>
            <DialogDescription>This can’t be undone. A short note helps the company (optional).</DialogDescription>
          </DialogHeader>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="I've accepted another offer — thank you for the opportunity." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecline(null)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (decline && (await run(() => respondToOffer(decline.id, "decline", note), "Offer declined"))) setDecline(null);
              }}
            >
              Decline offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const TIMELINE_TEXT = (e: NonNullable<StudentApplication["timeline"]>[number]) => {
  if (e.kind === "applied") return "You applied";
  if (e.kind === "moved") return `Moved to ${STAGE_LABEL[e.to_status] ?? e.to_status}`;
  if (e.kind === "emailed") return `Message: ${e.detail}`;
  return e.detail || e.kind;
};

export function ApplicationSheet({ id, onClose }: { id: number | null; onClose: () => void }) {
  const [loaded, setLoaded] = React.useState<StudentApplication | null>(null);
  React.useEffect(() => {
    if (id === null) return;
    getStudentApplication(id)
      .then(setLoaded)
      .catch((err) => toast.error(errorMessage(err)));
  }, [id]);
  const app = loaded && loaded.id === id ? loaded : null;

  return (
    <Sheet open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-lg">
        {!app ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 p-6">
            <SheetHeader className="p-0">
              <div className="flex items-center gap-4">
                <OrgAvatar name={app.internship.company_name} className="size-14" />
                <div className="min-w-0">
                  <SheetTitle className="text-2xl font-medium">{app.internship.title}</SheetTitle>
                  <p className="text-[15px] text-muted-foreground">{app.internship.company_name}</p>
                </div>
              </div>
            </SheetHeader>
            <div className="flex items-center gap-2">
              <StatusBadge status={app.status} />
              {app.source === "drive" && <Badge variant="violet">Campus drive</Badge>}
            </div>
            {app.offer && (
              <div className="rounded-2xl bg-secondary p-4 text-[15px]">
                <p className="text-[17px] font-medium">Offer · {app.offer.is_expired ? "expired" : app.offer.status}</p>
                <p className="mt-1 text-muted-foreground">
                  {fmtMoney(app.offer.stipend)}/mo · starts {fmtDate(app.offer.start_date)} · {app.offer.duration_months} months
                </p>
                <Link href={`/offers/${app.offer.id}`} target="_blank" className="mt-2 inline-block underline-offset-4 hover:underline">
                  View offer letter
                </Link>
              </div>
            )}
            <section>
              <h3 className="mb-3 text-lg font-medium">Timeline</h3>
              <ol className="relative space-y-4 border-l border-border pl-5">
                {(app.timeline ?? []).map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-background bg-foreground/40" />
                    <p className="text-[15px]">{TIMELINE_TEXT(e)}</p>
                    <p className="text-[13.5px] text-muted-foreground">{fmtDateTime(e.created_at)}</p>
                  </li>
                ))}
              </ol>
            </section>
            <Button variant="outline" render={<Link href={`/internships/${app.internship.id}`} />} nativeButton={false}>
              View listing
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
