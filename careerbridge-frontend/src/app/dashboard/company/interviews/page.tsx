"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "cn";

import { useAuth } from "@/contexts/auth-context";
import { errorMessage } from "@/lib/api";
import { downloadIcs, fmtDateTime, getCompanyInterviews, type Interview } from "@/lib/ats";
import { FeedbackDialog, RECOMMENDATION } from "@/components/ats/ats-ui";
import { CalendarIcon, PhoneIcon, VideoIcon } from "@/components/icons";
import { DashboardSkeleton, PageHeader, Panel, StatTile, stagger } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Scope = "upcoming" | "mine" | "past";

const dayKey = (d: string) => new Date(d).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

export default function InterviewsPage() {
  const { user } = useAuth();
  const [scope, setScope] = React.useState<Scope>("upcoming");
  const [result, setResult] = React.useState<{ scope: Scope; items: Interview[] } | null>(null);
  const [scoring, setScoring] = React.useState<Interview | null>(null);

  const load = React.useCallback(
    () =>
      getCompanyInterviews(scope)
        .then((items) => setResult({ scope, items }))
        .catch((err) => {
          toast.error(errorMessage(err));
          setResult({ scope, items: [] });
        }),
    [scope]
  );

  React.useEffect(() => {
    load();
  }, [load]);

  const items = result?.scope === scope ? result.items : null;

  if (items === null) return <DashboardSkeleton />;

  const groups = items.reduce<Record<string, Interview[]>>((acc, i) => {
    (acc[dayKey(i.scheduled_at)] ??= []).push(i);
    return acc;
  }, {});
  const today = items.filter((i) => new Date(i.scheduled_at).toDateString() === new Date().toDateString()).length;
  const waiting = items.filter((i) => i.status === "scheduled" && i.candidate_response === "pending").length;
  const resched = items.filter((i) => i.candidate_response === "reschedule").length;
  const needScore = items.filter((i) => i.status !== "cancelled" && new Date(i.scheduled_at) < new Date() && i.feedback.length === 0).length;

  return (
    <div className="space-y-8">
      <PageHeader title="Interviews" subtitle="Everything on your team's interview calendar, with replies and scorecards." />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile index={1} tone="blue" icon={<CalendarIcon />} title="Today" value={today} caption="Interviews today" />
        <StatTile index={2} tone="amber" icon={<CalendarIcon />} title="Awaiting reply" value={waiting} caption="Candidate hasn't confirmed" />
        <StatTile index={3} tone="pink" icon={<CalendarIcon />} title="Reschedule" value={resched} caption="Asked for a new time" />
        <StatTile index={4} tone="violet" icon={<CalendarIcon />} title="Needs scorecard" value={needScore} caption="Done, no feedback yet" />
      </div>

      <Panel style={stagger(5)} contentClassName="space-y-6 pt-6">
        <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="mine">I’m interviewing</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>
        </Tabs>

        {items.length === 0 && (
          <p className="py-12 text-center text-[15px] text-muted-foreground">
            {scope === "past" ? "No past interviews yet." : "Nothing scheduled. Open a candidate and choose Interview to send an invite."}
          </p>
        )}

        {Object.entries(groups).map(([day, list]) => (
          <section key={day} className="space-y-2.5">
            <h2 className="text-[14.5px] font-medium tracking-[0.06em] text-muted-foreground uppercase">{day}</h2>
            {list.map((i) => {
              const mine = i.feedback.find((f) => f.author_id === user?.id);
              const past = new Date(i.scheduled_at) < new Date();
              return (
                <div key={i.id} className={cn("flex flex-wrap items-center gap-4 rounded-[22px] border border-(--hairline) p-4", i.status === "cancelled" && "opacity-60")}>
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary">
                    {i.mode === "video" ? <VideoIcon className="size-5" /> : i.mode === "phone" ? <PhoneIcon className="size-5" /> : <CalendarIcon className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/company/applicants/${i.application_id}`} className="font-medium hover:underline">
                      {i.candidate_name}
                    </Link>
                    <p className="truncate text-[14.5px] text-muted-foreground">
                      {new Date(i.scheduled_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} · {i.round_name} · {i.internship_title}
                    </p>
                    {i.interviewers.length > 0 && <p className="text-[13.5px] text-muted-foreground">Panel: {i.interviewers.map((p) => p.name).join(", ")}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {i.feedback.map((f) => (
                      <span key={f.id} title={f.author_name} className={cn("rounded-full px-2 py-0.5 text-[12.5px] font-semibold", RECOMMENDATION[f.recommendation]?.cls)}>
                        {RECOMMENDATION[f.recommendation]?.label}
                      </span>
                    ))}
                    {i.status === "scheduled" ? (
                      <Badge variant={i.candidate_response === "confirmed" ? "success" : i.candidate_response === "reschedule" ? "danger" : "warning"}>
                        {i.candidate_response === "confirmed" ? "Confirmed" : i.candidate_response === "reschedule" ? "Reschedule" : "Awaiting reply"}
                      </Badge>
                    ) : (
                      <Badge variant={i.status === "completed" ? "success" : "danger"} className="capitalize">
                        {i.status}
                      </Badge>
                    )}
                    {i.meeting_link && i.status === "scheduled" && !past && (
                      <Button size="sm" render={<a href={i.meeting_link} target="_blank" rel="noreferrer" />} nativeButton={false}>
                        Join
                      </Button>
                    )}
                    {i.status !== "cancelled" && (past || i.status === "completed") && (
                      <Button size="sm" variant={mine ? "ghost" : "outline"} onClick={() => setScoring(i)}>
                        {mine ? "Edit scorecard" : "Scorecard"}
                      </Button>
                    )}
                    {i.status === "scheduled" && (
                      <Button size="sm" variant="ghost" onClick={() => downloadIcs(i.id).catch((e) => toast.error(errorMessage(e)))}>
                        .ics
                      </Button>
                    )}
                  </div>
                  {i.candidate_note && <p className="w-full rounded-2xl bg-secondary p-3 text-[14.5px]">Candidate: “{i.candidate_note}”</p>}
                </div>
              );
            })}
          </section>
        ))}
      </Panel>

      <FeedbackDialog
        open={!!scoring}
        onOpenChange={(o) => !o && setScoring(null)}
        interview={scoring}
        mine={scoring?.feedback.find((f) => f.author_id === user?.id)}
        onSaved={() => load()}
      />
    </div>
  );
}
