"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { getMyApplications, withdrawApplication } from "@/lib/api";
import { DEMO_ENABLED, demoApplications, type ApplicationRow } from "@/lib/demo";
import { ApplicationsIcon, ClockIcon, CloseCircleIcon, TrashIcon, TrophyIcon } from "@/components/icons";
import {
  DashboardSkeleton, HeroCard, OrgAvatar, PageHeader, Panel, SegBars, StatTile, StatusBadge, stagger, statusLabel,
} from "@/components/kit";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionCenter, ApplicationSheet } from "@/components/ats/student-actions";

const ACTIVE = ["applied", "review", "shortlisted", "interview", "offered"];
const STAGES = ["applied", "review", "shortlisted", "interview", "offered", "selected", "rejected"];

export default function StudentApplicationsPage() {
  const { user } = useAuth();
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [tab, setTab] = useState("all");
  const [reload, setReload] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    getMyApplications()
      .then((data) => {
        if (!alive) return;
        const list = (Array.isArray(data) ? data : (data as { results?: ApplicationRow[] }).results ?? []) as ApplicationRow[];
        if (list.length === 0 && DEMO_ENABLED) {
          setApps(demoApplications);
          setIsDemo(true);
        } else setApps(list);
      })
      .catch(() => {
        if (!alive || !DEMO_ENABLED) return;
        setApps(demoApplications);
        setIsDemo(true);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [reload]);

  const handleWithdraw = async (id: number) => {
    try {
      if (!isDemo) await withdrawApplication(id);
      toast.success("Application withdrawn.");
      setApps((prev) => prev.filter((a) => a.id !== id));
    } catch {
      toast.error("Could not withdraw — the application may already be progressing.");
    }
  };

  if (loading) return <DashboardSkeleton />;

  const inTab = (s: string, t: string) => (t === "all" ? true : t === "active" ? ACTIVE.includes(s) : s === t);
  const visible = apps.filter((a) => inTab(a.status, tab));
  const count = (t: string) => apps.filter((a) => inTab(a.status, t)).length;
  const total = apps.length;
  const selected = count("selected");
  const successRate = total ? (selected / total) * 100 : 0;
  const fullName = user?.full_name || user?.username || "Student";
  const bars = STAGES.map((s) => ({ label: statusLabel(s), value: count(s) }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Applications"
        subtitle="Track every internship you've applied to."
        demo={isDemo}
        actions={
          <Button size="lg" render={<Link href="/internships" />} nativeButton={false}>
            Browse internships
          </Button>
        }
      />

      <ActionCenter apps={apps as Parameters<typeof ActionCenter>[0]["apps"]} demo={isDemo} onChanged={() => setReload((n) => n + 1)} />

      <div className="grid gap-5 lg:grid-cols-12">
        <HeroCard
          className="lg:col-span-5"
          name={fullName}
          role="Student"
          kicker="Sent"
          value={String(total)}
          progress={{ label: "Success rate", value: successRate }}
          nextLabel="Browse internships"
          nextHref="/internships"
        />
        <Panel className="lg:col-span-7" title="Status breakdown" style={stagger(1)} action={<Badge variant="violet">{total} total</Badge>}>
          <SegBars data={bars} emptyText="Apply to an internship to see your breakdown" />
        </Panel>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile index={2} tone="blue" icon={<ApplicationsIcon />} title="Total" value={total} caption="Applications sent" />
        <StatTile index={3} tone="amber" icon={<ClockIcon />} title="In progress" value={count("active")} caption="Awaiting a decision" />
        <StatTile index={4} tone="mint" icon={<TrophyIcon />} title="Hired" value={selected} caption={`${count("offered")} offer${count("offered") === 1 ? "" : "s"} waiting`} />
        <StatTile index={5} tone="pink" icon={<CloseCircleIcon />} title="Rejected" value={count("rejected")} caption="Not this time" />
      </div>

      <Panel title="All applications" style={stagger(6)} contentClassName="space-y-5">
        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList className="max-w-full justify-start overflow-x-auto [scrollbar-width:none]">
            {[["all", "All"], ["active", "Active"], ["selected", statusLabel("selected")], ["rejected", statusLabel("rejected")]].map(([v, label]) => (
              <TabsTrigger key={v} value={v}>
                {label}
                <span className="opacity-60 tabular-nums">{count(v)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Company</TableHead>
                <TableHead className="hidden sm:table-cell">Role</TableHead>
                <TableHead className="hidden lg:table-cell">Mode</TableHead>
                <TableHead className="hidden md:table-cell">Applied</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((a) => (
                <TableRow key={a.id} className="border-border/60">
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-3">
                      <OrgAvatar name={a.internship.company_name} />
                      <span className="font-medium">{a.internship.company_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{a.internship.title}</TableCell>
                  <TableCell className="hidden text-muted-foreground capitalize lg:table-cell">{a.internship.work_mode}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {new Date(a.applied_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={a.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {!isDemo && (
                      <Button size="sm" variant="ghost" onClick={() => setOpenId(a.id)}>
                        Details
                      </Button>
                    )}
                    {(a.status === "applied" || a.status === "review") && (
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={<Button size="icon-sm" variant="ghost" className="text-destructive hover:bg-destructive/10" aria-label="Withdraw application" />}
                        >
                          <TrashIcon />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Withdraw application?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This removes your application for &quot;{a.internship.title}&quot;. You can reapply later if it&apos;s still open.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep it</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleWithdraw(a.id)} className="bg-destructive text-white hover:bg-destructive/90">
                              Withdraw
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
      <ApplicationSheet id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
