"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/contexts/auth-context";
import { getStudentStats } from "@/lib/api";
import { demoStudent, isEmptyStudent, type StudentStats } from "@/lib/demo";
import { useDashboardData } from "@/lib/use-dashboard-data";
import { useJobs } from "@/lib/use-jobs";
import { ActivityFeed, ClosingSoon, Interviews, RecommendedJobs, SavedJobs, SkillGap, type ActivityItem } from "@/components/widgets";
import { ApplicationsIcon, SkillsIcon, StarIcon, TrophyIcon } from "@/components/icons";
import {
  SegBars,
  DashboardSkeleton,
  HeroCard,
  OrgAvatar,
  GreetingHeader,
  Panel,
  StatTile,
  StatusBadge,
  TaskList,
  stagger,
  statusLabel,
  type TaskItem,
} from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STAGES = ["applied", "review", "shortlisted", "selected", "rejected"];
const ACTIVE = ["applied", "review", "shortlisted"];

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data: stats, loading, isDemo } = useDashboardData<StudentStats>(getStudentStats, demoStudent, isEmptyStudent);
  const [tab, setTab] = useState("all");
  const { jobs, isDemo: jobsDemo } = useJobs();
  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setNow(Date.now()));
    return () => cancelAnimationFrame(id);
  }, []);

  if (loading) return <DashboardSkeleton />;

  const total = stats?.total_applications ?? 0;
  const completion = stats?.profile_completion ?? 0;
  const skills = stats?.skills_count ?? 0;
  const selected = stats?.selected ?? 0;
  const recent = stats?.recent_applications ?? [];
  const firstName = user?.first_name || user?.username || "there";
  const fullName = user?.full_name || user?.username || "Student";

  const counts = Object.fromEntries(
    STAGES.map((s) => [s, stats?.status_breakdown.find((b) => b.status === s)?.count ?? 0])
  );
  const chartData = STAGES.map((s) => ({ label: statusLabel(s), value: counts[s] }));

  const tasks: TaskItem[] = [
    { title: "Complete your profile", description: `${completion}% complete`, progress: completion / 100, href: "/dashboard/student/profile" },
    { title: "Add your skills", description: `${skills} skill${skills === 1 ? "" : "s"} added`, progress: Math.min(skills / 5, 1), href: "/dashboard/student/skills" },
    { title: "Apply to internships", description: `${total} application${total === 1 ? "" : "s"} sent so far`, progress: Math.min(total / 3, 1), href: "/internships" },
    { title: "Track your offers", description: selected ? `${selected} offer${selected === 1 ? "" : "s"} received` : "No offers yet — keep going", progress: selected ? 1 : 0, href: "/dashboard/student/applications" },
  ];
  const next = tasks.find((t) => t.progress < 1) ?? tasks[3];
  const nextTask = Math.max(0, tasks.indexOf(next));

  const inTab = (status: string, t: string) => (t === "all" ? true : t === "active" ? ACTIVE.includes(status) : status === t);
  const visible = recent.filter((a) => inTab(a.status, tab));
  const tabCount = (t: string) => recent.filter((a) => inTab(a.status, t)).length;

  const activity: ActivityItem[] = recent.map((a) => ({
    id: a.id,
    status: a.status,
    at: a.applied_at,
    text:
      a.status === "selected" ? <>You received an offer from <b className="font-medium">{a.company}</b> for {a.internship_title}</>
      : a.status === "shortlisted" ? <>You were shortlisted for {a.internship_title} at <b className="font-medium">{a.company}</b></>
      : a.status === "review" ? <><b className="font-medium">{a.company}</b> is reviewing your application for {a.internship_title}</>
      : a.status === "rejected" ? <><b className="font-medium">{a.company}</b> closed your application for {a.internship_title}</>
      : <>You applied to {a.internship_title} at <b className="font-medium">{a.company}</b></>,
  }));

  return (
    <div className="space-y-8">
      <GreetingHeader
        name={firstName}
        subtitle="Here's how your internship journey is going."
        demo={isDemo}
        actions={
          <Button size="lg" render={<Link href="/internships" />} nativeButton={false}>
            Browse internships
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-12">
        <HeroCard
          className="lg:col-span-5"
          name={fullName}
          role="Student"
          title="Your profile"
          kicker="Applications sent:"
          value={String(total)}
          progress={{ label: "Profile completion", value: completion }}
          nextLabel={next.title}
          nextHref={next.href}
        />
        <Panel
          className="lg:col-span-7"
          title="Application pipeline"
          style={stagger(1)}
          action={<Badge variant="violet">All time</Badge>}
        >
          <SegBars data={chartData} emptyText="Apply to an internship to see your pipeline" />
        </Panel>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile index={2} tone="blue" icon={<ApplicationsIcon />} title="Applications" value={total} pill={{ text: stats?.applied ? `${stats.applied} new` : "None new", variant: "lime" }} caption="Across all internships" />
        <StatTile index={3} tone="violet" icon={<StarIcon />} title="Shortlisted" value={stats?.shortlisted ?? 0} caption="Recruiters are interested" />
        <StatTile index={4} tone="mint" icon={<TrophyIcon />} title="Selected" value={selected} caption="Offers received" />
        <StatTile index={5} tone="amber" icon={<SkillsIcon />} title="Skills" value={skills} href="/dashboard/student/skills" caption="Used for match scores" />
      </div>

      {now > 0 && (
        <div className="grid items-stretch gap-5 lg:grid-cols-12">
          <RecommendedJobs className="lg:col-span-7" jobs={jobs} isDemo={jobsDemo} />
          <ClosingSoon className="lg:col-span-5" jobs={jobs} now={now} />
        </div>
      )}

      <div className="grid items-stretch gap-5 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col lg:col-span-8 [&>*]:flex-1">
          <Panel
            title="Recent applications"
            style={stagger(6)}
            action={
              <Link href="/dashboard/student/applications" className="text-[16px] font-medium underline-offset-4 hover:underline">
                View all
              </Link>
            }
            contentClassName="space-y-5"
          >
            <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
              <TabsList className="flex-wrap">
                {[["all", "All"], ["active", "Active"], ["selected", "Selected"], ["rejected", "Rejected"]].map(([v, label]) => (
                  <TabsTrigger key={v} value={v}>
                    {label}
                    <span className="opacity-60 tabular-nums">{tabCount(v)}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {visible.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Nothing here yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Company</TableHead>
                    <TableHead className="hidden sm:table-cell">Role</TableHead>
                    <TableHead className="hidden 2xl:table-cell">Applied</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((a) => (
                    <TableRow key={a.id} className="border-border/60">
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-3">
                          <OrgAvatar name={a.company} />
                          <span className="font-medium">{a.company}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">{a.internship_title}</TableCell>
                      <TableCell className="hidden text-muted-foreground 2xl:table-cell">
                        {new Date(a.applied_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </TableCell>
                      <TableCell className="text-right">
                        <StatusBadge status={a.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col lg:col-span-4 [&>*]:flex-1">
          <Panel title="Next steps" style={stagger(7)}>
            <TaskList items={tasks} highlight={nextTask} />
          </Panel>
        </div>
      </div>

      {now > 0 && (
        <div className="grid items-stretch gap-5 lg:grid-cols-12">
          <ActivityFeed className={isDemo ? "lg:col-span-4" : "lg:col-span-7"} items={activity} now={now} />
          {isDemo ? (
            <>
              <SkillGap className="lg:col-span-4" />
              <div className="space-y-5 lg:col-span-4">
                <Interviews now={now} />
                <SavedJobs jobs={jobs} />
              </div>
            </>
          ) : (
            <SavedJobs className="lg:col-span-5" jobs={jobs} />
          )}
        </div>
      )}
    </div>
  );
}
