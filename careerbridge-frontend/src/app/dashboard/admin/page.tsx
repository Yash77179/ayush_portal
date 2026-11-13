"use client";

import * as React from "react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { API_URL, errorMessage, getAdminStats, type AdminStats } from "@/lib/api";
import { ApplicationsIcon, ArrowRightUpIcon, BuildingsIcon, GraduateIcon, InternshipsIcon, PeopleIcon, TrophyIcon } from "@/components/icons";
import { DashboardSkeleton, GreetingHeader, Panel, ProgressBar, StatTile, stagger } from "@/components/kit";
import { Button } from "@/components/ui/button";

/** The Django admin panel lives on the API host, next to /api. */
const DJANGO_ADMIN = API_URL.replace(/\/api\/?$/, "") + "/admin/";

const LINKS = [
  { label: "Verify companies", hint: "Tick “Is verified” so students see the badge", path: "institutions/company/?is_verified__exact=0" },
  { label: "Users", hint: "Reset passwords, change roles, deactivate accounts", path: "accounts/user/" },
  { label: "Internships", hint: "Edit or take down listings", path: "internships/internship/" },
  { label: "Applications", hint: "See every application and its history", path: "applications/application/" },
  { label: "Universities", hint: "Fix names, merge duplicates", path: "institutions/university/" },
  { label: "Student verification", hint: "Profiles and their university check", path: "institutions/studentprofile/" },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = React.useState<AdminStats | null>(null);

  React.useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch((err) => toast.error(errorMessage(err)));
  }, []);

  if (!stats) return <DashboardSkeleton />;

  const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

  return (
    <div className="space-y-8">
      <GreetingHeader
        name={user?.first_name || user?.username || "Admin"}
        subtitle="Everything happening across CareerBridge."
        actions={
          <Button size="lg" render={<a href={DJANGO_ADMIN} target="_blank" rel="noreferrer" />} nativeButton={false}>
            Open admin panel <ArrowRightUpIcon />
          </Button>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile index={1} tone="blue" icon={<PeopleIcon />} title="Users" value={stats.total_users} caption={`${stats.total_students} students`} />
        <StatTile index={2} tone="amber" icon={<BuildingsIcon />} title="Companies" value={stats.total_companies} caption={`${stats.verified_companies} verified`} />
        <StatTile index={3} tone="violet" icon={<InternshipsIcon />} title="Internships" value={stats.total_internships} caption={`${stats.published_internships} live now`} />
        <StatTile index={4} tone="mint" icon={<TrophyIcon />} title="Hired" value={stats.total_selected} caption={`of ${stats.total_applications} applications`} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-5" title="Platform health" style={stagger(5)} contentClassName="space-y-5">
          <ProgressBar label={`Companies verified · ${stats.verified_companies}/${stats.total_companies}`} value={pct(stats.verified_companies, stats.total_companies)} />
          <ProgressBar label={`Listings live · ${stats.published_internships}/${stats.total_internships}`} value={pct(stats.published_internships, stats.total_internships)} />
          <ProgressBar label={`Applications that ended in a hire · ${stats.total_selected}/${stats.total_applications}`} value={pct(stats.total_selected, stats.total_applications)} />
          <div className="grid grid-cols-2 gap-4 pt-1 text-[15px]">
            <div className="rounded-2xl bg-secondary p-4">
              <p className="text-muted-foreground">Students</p>
              <p className="mt-1 text-2xl font-light tabular-nums">{stats.total_students}</p>
            </div>
            <div className="rounded-2xl bg-secondary p-4">
              <p className="text-muted-foreground">Skills in catalogue</p>
              <p className="mt-1 text-2xl font-light tabular-nums">{stats.total_skills}</p>
            </div>
          </div>
        </Panel>

        <Panel className="lg:col-span-7" title="Manage" style={stagger(6)} contentClassName="grid gap-3 sm:grid-cols-2">
          {LINKS.map((l) => (
            <a
              key={l.path}
              href={DJANGO_ADMIN + l.path}
              target="_blank"
              rel="noreferrer"
              className="group flex items-start gap-3 rounded-[22px] border border-(--hairline) p-4 transition-colors hover:bg-secondary/60"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary [&_svg]:size-5">
                {l.label.startsWith("Verify") ? <BuildingsIcon /> : l.label === "Users" ? <PeopleIcon /> : l.label === "Applications" ? <ApplicationsIcon /> : l.label.startsWith("Student") || l.label === "Universities" ? <GraduateIcon /> : <InternshipsIcon />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-medium">{l.label}</span>
                <span className="mt-0.5 block text-[14.5px] text-muted-foreground">{l.hint}</span>
              </span>
              <ArrowRightUpIcon className="mt-1 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
            </a>
          ))}
        </Panel>
      </div>
    </div>
  );
}
