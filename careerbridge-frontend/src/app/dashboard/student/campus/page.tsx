"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "cn";

import { errorMessage } from "@/lib/api";
import { fmtDateTime, getStudentCampus, registerForDrive, timeAgo, unregisterFromDrive, type StudentCampus } from "@/lib/ats";
import { LocationIcon, VerifiedIcon } from "@/components/icons";
import { DashboardSkeleton, OrgAvatar, PageHeader, Panel, stagger } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function StudentCampusPage() {
  const router = useRouter();
  const [data, setData] = React.useState<StudentCampus | null>(null);
  const [busy, setBusy] = React.useState<number | null>(null);

  const load = React.useCallback(() => {
    getStudentCampus()
      .then(setData)
      .catch((err) => {
        toast.error(errorMessage(err));
        setData({ university: null, drives: [], announcements: [] });
      });
  }, []);
  React.useEffect(load, [load]);

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

  const upcoming = data.drives.filter((d) => d.status === "upcoming" || d.status === "ongoing");
  const past = data.drives.filter((d) => d.status === "completed");

  return (
    <div className="space-y-8">
      <PageHeader title="Campus" subtitle={`Placement drives and notices from ${data.university.name}.`} />

      <div
        className={cn(
          "rise flex flex-wrap items-center gap-3 rounded-[24px] p-4 text-[15px]",
          data.verification_status === "verified" ? "bg-(--mint-bg) text-(--mint-fg)" : data.verification_status === "rejected" ? "bg-(--pink-bg) text-(--pink-fg)" : "bg-secondary"
        )}
      >
        <VerifiedIcon className="size-5" />
        {data.verification_status === "verified" && "Your profile is verified by your placement cell — recruiters see a Verified mark."}
        {data.verification_status === "rejected" && <>Your placement cell asked for a fix: “{data.verification_note}”. Update your profile and they’ll check again.</>}
        {data.verification_status === "unverified" && "Your placement cell hasn't verified your profile yet. Make sure your enrollment number, branch and CGPA are filled in."}
        {data.verification_status !== "verified" && (
          <Link href="/dashboard/student/profile" className="font-medium underline-offset-4 hover:underline sm:ml-auto">
            Open profile
          </Link>
        )}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-7" title="Placement drives" style={stagger(1)} contentClassName="space-y-3">
          {upcoming.length === 0 && <p className="py-8 text-center text-[15px] text-muted-foreground">No upcoming drives right now. You’ll be notified when one opens for you.</p>}
          {upcoming.map((d) => (
            <div key={d.id} className="rounded-[22px] border border-(--hairline) p-4">
              <div className="flex items-start gap-3">
                <OrgAvatar name={d.company_display} />
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-medium">{d.title}</p>
                  <p className="text-[14.5px] text-muted-foreground">
                    {d.company_display}
                    {d.internship_title && ` · ${d.internship_title}`}
                  </p>
                  <p className="mt-1 text-[14.5px]">{fmtDateTime(d.drive_date)}</p>
                  {d.venue && (
                    <p className="flex items-center gap-1 text-[14.5px] text-muted-foreground">
                      <LocationIcon className="size-3.5" /> {d.venue}
                    </p>
                  )}
                </div>
                {d.registered ? <Badge variant="success">Registered</Badge> : !d.eligible ? <Badge variant="danger">Not eligible</Badge> : null}
              </div>
              {d.description && <p className="mt-3 text-[15px] whitespace-pre-wrap text-muted-foreground">{d.description}</p>}
              {!d.eligible && !d.registered && (
                <ul className="mt-3 list-disc space-y-0.5 pl-5 text-[14.5px] text-muted-foreground">
                  {d.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {d.registered ? (
                  d.status === "upcoming" && (
                    <Button size="sm" variant="ghost" disabled={busy === d.id} onClick={() => register(d.id, false)}>
                      Cancel registration
                    </Button>
                  )
                ) : (
                  <Button size="sm" disabled={!d.eligible || !d.registration_open || busy === d.id} onClick={() => register(d.id, true)}>
                    {d.registration_open ? "Register" : "Registration closed"}
                  </Button>
                )}
                {d.internship && (
                  <Button size="sm" variant="ghost" render={<Link href={`/internships/${d.internship}`} />} nativeButton={false}>
                    View role
                  </Button>
                )}
                <span className="text-[13.5px] text-muted-foreground sm:ml-auto">
                  {d.registrations_count} registered{d.registration_deadline && ` · register by ${new Date(d.registration_deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                </span>
              </div>
            </div>
          ))}
          {past.length > 0 && (
            <details className="pt-2">
              <summary className="cursor-pointer text-[15px] text-muted-foreground">Past drives · {past.length}</summary>
              <ul className="mt-2 space-y-1.5 text-[15px]">
                {past.map((d) => (
                  <li key={d.id}>
                    {d.title} · {d.company_display}
                    {d.outcome && d.outcome !== "pending" && <span className="text-muted-foreground"> · {d.outcome === "selected" ? "Selected 🎉" : "Not selected"}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Panel>

        <Panel className="lg:col-span-5" title="Announcements" style={stagger(2)} contentClassName="-mr-2 max-h-[min(48rem,75svh)] space-y-3 overflow-y-auto overscroll-contain pr-2 [scrollbar-width:thin]">
          {data.announcements.length === 0 && <p className="py-8 text-center text-[15px] text-muted-foreground">No announcements yet.</p>}
          {data.announcements.map((a) => (
            <article key={a.id} className="rounded-[22px] bg-secondary/70 p-4">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{a.title}</h3>
                {a.pinned && <Badge variant="lime">Pinned</Badge>}
              </div>
              <p className="text-[13.5px] text-muted-foreground">
                {a.author_name} · {timeAgo(a.created_at)}
              </p>
              <p className="mt-2 text-[15px] whitespace-pre-wrap">{a.body}</p>
            </article>
          ))}
        </Panel>
      </div>
    </div>
  );
}
