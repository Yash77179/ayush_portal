"use client";

import Link from "next/link";

import { useAuth } from "@/contexts/auth-context";
import { getUniversityStats } from "@/lib/api";
import { timeAgo } from "@/lib/ats";
import { demoUniversity, isEmptyUniversity, type UniversityStats } from "@/lib/demo";
import { useDashboardData } from "@/lib/use-dashboard-data";
import { useUniversity } from "@/components/org-gate";
import { CalendarIcon, GraduateIcon, TrophyIcon, VerifiedIcon } from "@/components/icons";
import { DashboardSkeleton, GreetingHeader, HeroCard, OrgAvatar, Panel, QuickTile, SegBars, StatTile, StatusBadge, stagger } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function UniversityDashboard() {
  const { user } = useAuth();
  const { data: uni } = useUniversity();
  const { data: stats, loading, isDemo } = useDashboardData<UniversityStats>(getUniversityStats, demoUniversity, isEmptyUniversity);

  if (loading) return <DashboardSkeleton />;

  const firstName = user?.first_name || user?.username || "there";
  const rate = stats?.placement_rate ?? 0;
  const skills = (stats?.top_skills ?? []).map((s) => ({ label: s.skill__name, value: s.count }));
  const pending = stats?.pending_verification ?? 0;

  return (
    <div className="space-y-8">
      <GreetingHeader
        name={firstName}
        subtitle={`${uni.university.name} placement cell`}
        demo={isDemo}
        actions={
          <Button size="lg" render={<Link href="/dashboard/university/drives" />} nativeButton={false}>
            New drive
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-12">
        <HeroCard
          className="lg:col-span-5"
          name={uni.university.name}
          role={uni.title || "Placement cell"}
          title="Placements"
          kicker="Students placed:"
          value={String(stats?.total_placements ?? 0)}
          progress={{ label: "Placement rate", value: rate }}
          nextLabel="Full report"
          nextHref="/dashboard/university/reports"
        />
        <Panel className="lg:col-span-7" title="Top skills among your students" style={stagger(1)} action={<Badge variant="violet">Top 10</Badge>}>
          <SegBars data={skills.slice(0, 6)} emptyText="Skill data appears as students add skills" />
        </Panel>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile index={2} tone="blue" icon={<GraduateIcon />} title="Students" value={stats?.total_students ?? 0} caption="Linked to your university" href="/dashboard/university/students" />
        <StatTile
          index={3}
          tone="amber"
          icon={<VerifiedIcon />}
          title="To verify"
          value={pending}
          pill={pending ? { text: "Action", variant: "warning" } : undefined}
          caption={`${stats?.verified_students ?? 0} verified so far`}
          href="/dashboard/university/students"
        />
        <StatTile index={4} tone="violet" icon={<CalendarIcon />} title="Interviewing" value={stats?.in_interviews ?? 0} caption={`${stats?.offers_pending ?? 0} offers waiting`} />
        <StatTile index={5} tone="mint" icon={<TrophyIcon />} title="Placed" value={stats?.total_placements ?? 0} caption={`${rate}% of students`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-7" title="Latest from your students" style={stagger(6)} contentClassName="space-y-2">
          {(stats?.recent_activity ?? []).length === 0 && <p className="py-6 text-[15px] text-muted-foreground">Application updates for your students appear here.</p>}
          {(stats?.recent_activity ?? []).map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-[18px] p-2.5 hover:bg-secondary/60">
              <OrgAvatar name={a.student_name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-medium">{a.student_name}</p>
                <p className="truncate text-[14.5px] text-muted-foreground">
                  {a.internship_title} · {a.company} · {timeAgo(a.updated_at)}
                </p>
              </div>
              <StatusBadge status={a.status} />
            </div>
          ))}
        </Panel>
        <div className="grid gap-5 lg:col-span-5">
          <QuickTile tone="sage" label="Placement drives" hint="Schedule a company visit and notify eligible students." href="/dashboard/university/drives" />
          <QuickTile tone="peach" label="Announce" hint="Post an update to every student at once." href="/dashboard/university/announcements" />
        </div>
      </div>
    </div>
  );
}
