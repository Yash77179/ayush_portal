"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/contexts/auth-context";
import { getCompanyStats, getMyInternships } from "@/lib/api";
import { DEMO_ENABLED, demoCompany, demoInternships, isEmptyCompany, type CompanyStats, type InternshipRow } from "@/lib/demo";
import { ActivityFeed, YourListings, type ActivityItem } from "@/components/widgets";
import { useDashboardData } from "@/lib/use-dashboard-data";
import { InternshipsIcon, PeopleIcon, StarIcon, TrophyIcon } from "@/components/icons";
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

export default function CompanyDashboard() {
  const { user } = useAuth();
  const { data: stats, loading, isDemo } = useDashboardData<CompanyStats>(getCompanyStats, demoCompany, isEmptyCompany);
  const [tab, setTab] = useState("all");
  const [listings, setListings] = useState<InternshipRow[]>([]);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setNow(Date.now()));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    let alive = true;
    getMyInternships()
      .then((d) => {
        if (!alive) return;
        const list = (Array.isArray(d) ? d : ((d as { results?: InternshipRow[] }).results ?? [])) as InternshipRow[];
        setListings(list.length === 0 && DEMO_ENABLED ? demoInternships : list);
      })
      .catch(() => alive && DEMO_ENABLED && setListings(demoInternships));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <DashboardSkeleton />;

  const applicants = stats?.total_applicants ?? 0;
  const published = stats?.published_internships ?? 0;
  const shortlisted = stats?.shortlisted ?? 0;
  const selected = stats?.selected ?? 0;
  const recent = stats?.recent_applications ?? [];
  const firstName = user?.first_name || user?.username || "there";
  const fullName = user?.full_name || user?.username || "Recruiter";

  const counts = Object.fromEntries(
    STAGES.map((s) => [s, stats?.status_breakdown.find((b) => b.status === s)?.count ?? 0])
  );
  const chartData = STAGES.map((s) => ({ label: statusLabel(s), value: counts[s] }));

  const tasks: TaskItem[] = [
    { title: "Post an internship", description: published ? `${published} live listing${published === 1 ? "" : "s"}` : "No live listings yet", progress: Math.min(published / 3, 1), href: "/dashboard/company/internships/create" },
    { title: "Review applicants", description: `${counts.applied} new application${counts.applied === 1 ? "" : "s"} waiting`, progress: applicants ? (applicants - counts.applied) / applicants : 0, href: "/dashboard/company/applicants" },
    { title: "Shortlist candidates", description: `${shortlisted} shortlisted so far`, progress: applicants ? Math.min(shortlisted / applicants, 1) : 0, href: "/dashboard/company/applicants" },
    { title: "Make offers", description: selected ? `${selected} offer${selected === 1 ? "" : "s"} made` : "No offers yet", progress: selected ? 1 : 0, href: "/dashboard/company/applicants" },
  ];
  const next = tasks.find((t) => t.progress < 1) ?? tasks[3];
  const nextTask = Math.max(0, tasks.indexOf(next));
  const offerRate = applicants ? (selected / applicants) * 100 : 0;

  const visible = recent.filter((a) => (tab === "all" ? true : a.status === tab));
  const tabCount = (t: string) => (t === "all" ? recent.length : recent.filter((a) => a.status === t).length);

  const activity: ActivityItem[] = recent.map((a) => ({
    id: a.id,
    status: a.status,
    at: a.applied_at,
    text:
      a.status === "selected" ? <>You selected <b className="font-medium">{a.student_name}</b> for {a.internship_title}</>
      : a.status === "shortlisted" ? <>You shortlisted <b className="font-medium">{a.student_name}</b> for {a.internship_title}</>
      : a.status === "rejected" ? <>You closed <b className="font-medium">{a.student_name}</b>&apos;s application for {a.internship_title}</>
      : <><b className="font-medium">{a.student_name}</b> applied to {a.internship_title}</>,
  }));

  return (
    <div className="space-y-8">
      <GreetingHeader
        name={firstName}
        subtitle="Your hiring pipeline at a glance."
        demo={isDemo}
        actions={
          <Button size="lg" render={<Link href="/dashboard/company/internships/create" />} nativeButton={false}>
            Post internship
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-12">
        <HeroCard
          className="lg:col-span-5"
          name={fullName}
          role="Recruiter"
          title="Hiring"
          kicker="Live listings:"
          value={String(published)}
          progress={{ label: "Offer rate", value: offerRate }}
          nextLabel={next.title}
          nextHref={next.href}
        />
        <Panel className="lg:col-span-7" title="Hiring pipeline" style={stagger(1)} action={<Badge variant="violet">All listings</Badge>}>
          <SegBars data={chartData} emptyText="Applications will appear once students apply" />
        </Panel>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile index={2} tone="amber" icon={<InternshipsIcon />} title="Internships" value={stats?.total_internships ?? 0} pill={{ text: `${published} live`, variant: "lime" }} caption="Posted by you" />
        <StatTile index={3} tone="blue" icon={<PeopleIcon />} title="Applicants" value={applicants} caption="Across all listings" />
        <StatTile index={4} tone="violet" icon={<StarIcon />} title="Shortlisted" value={shortlisted} caption="Moving forward" />
        <StatTile index={5} tone="mint" icon={<TrophyIcon />} title="Selected" value={selected} href="/dashboard/company/applicants" caption="Offers made" />
      </div>

      {now > 0 && (
        <div className="grid items-stretch gap-5 lg:grid-cols-12">
          <YourListings className="lg:col-span-7" items={listings} now={now} />
          <ActivityFeed className="lg:col-span-5" items={activity} now={now} title="Recent activity" />
        </div>
      )}

      <div className="grid items-stretch gap-5 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col lg:col-span-8 [&>*]:flex-1">
          <Panel
            title="Recent applicants"
            style={stagger(6)}
            action={
              <Link href="/dashboard/company/applicants" className="text-[16px] font-medium underline-offset-4 hover:underline">
                View all
              </Link>
            }
            contentClassName="space-y-5"
          >
            <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
              <TabsList className="max-w-full justify-start overflow-x-auto [scrollbar-width:none]">
                {["all", "applied", "shortlisted", "selected", "rejected"].map((v) => (
                  <TabsTrigger key={v} value={v}>
                    {v === "all" ? "All" : statusLabel(v)}
                    <span className="opacity-60 tabular-nums">{tabCount(v)}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {visible.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No applicants here yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Candidate</TableHead>
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
                          <OrgAvatar name={a.student_name} />
                          <span className="font-medium">{a.student_name}</span>
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
          <Panel title="Priority tasks" style={stagger(7)}>
            <TaskList items={tasks} highlight={nextTask} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
