"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/contexts/auth-context";
import { errorMessage, getMyInternships } from "@/lib/api";
import { saveInternship } from "@/lib/ats";
import { useCompany } from "@/components/org-gate";
import { toast } from "sonner";
import { DEMO_ENABLED, demoInternships, type InternshipRow } from "@/lib/demo";
import { CheckCircleIcon, CloseCircleIcon, InternshipsIcon, PenIcon } from "@/components/icons";
import { DashboardSkeleton, HeroCard, OrgAvatar, PageHeader, Panel, SegBars, StatTile, stagger } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger"> = {
  published: "success",
  draft: "warning",
  closed: "danger",
};

export default function CompanyInternshipsPage() {
  const { user } = useAuth();
  const { canManage } = useCompany();
  const [items, setItems] = useState<InternshipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let alive = true;
    getMyInternships()
      .then((d) => {
        if (!alive) return;
        const list = (Array.isArray(d) ? d : ((d as { results?: InternshipRow[] }).results ?? [])) as InternshipRow[];
        if (list.length === 0 && DEMO_ENABLED) {
          setItems(demoInternships);
          setIsDemo(true);
        } else setItems(list);
      })
      .catch(() => {
        if (!alive || !DEMO_ENABLED) return;
        setItems(demoInternships);
        setIsDemo(true);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const setStatus = async (row: InternshipRow, status: string) => {
    try {
      await saveInternship({ status }, row.id);
      setItems((list) => list.map((i) => (i.id === row.id ? { ...i, status } : i)));
      toast.success(status === "published" ? "Listing is live" : status === "closed" ? "Listing closed" : "Moved to drafts");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (loading) return <DashboardSkeleton />;

  const live = items.filter((i) => i.status === "published").length;
  const drafts = items.filter((i) => i.status === "draft").length;
  const closed = items.filter((i) => i.status === "closed").length;
  const openings = items.filter((i) => i.status === "published").reduce((n, i) => n + i.openings, 0);
  const fullName = user?.full_name || user?.username || "Recruiter";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Internships"
        subtitle="Manage every listing your company has posted."
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
          kicker="Listings"
          value={String(items.length)}
          progress={{ label: "Live rate", value: items.length ? (live / items.length) * 100 : 0 }}
          nextLabel="Post internship"
          nextHref="/dashboard/company/internships/create"
        />
        <Panel className="lg:col-span-7" title="By status" style={stagger(1)} action={<Badge variant="violet">{items.length} listings</Badge>}>
          <SegBars
            data={[
              { label: "Published", value: live, tone: 3 },
              { label: "Draft", value: drafts, tone: 1 },
              { label: "Closed", value: closed, tone: 4 },
            ]}
            emptyText="Post your first internship"
          />
        </Panel>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile index={2} tone="mint" icon={<CheckCircleIcon />} title="Live" value={live} caption="Accepting applications" />
        <StatTile index={3} tone="amber" icon={<PenIcon />} title="Drafts" value={drafts} caption="Not published yet" />
        <StatTile index={4} tone="pink" icon={<CloseCircleIcon />} title="Closed" value={closed} caption="No longer open" />
        <StatTile index={5} tone="blue" icon={<InternshipsIcon />} title="Open positions" value={openings} caption="Across live listings" />
      </div>

      <Panel title={`All listings · ${items.length}`} style={stagger(6)}>
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <p className="mb-4">No internships yet.</p>
            <Button render={<Link href="/dashboard/company/internships/create" />} nativeButton={false}>
              Post your first
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Location</TableHead>
                <TableHead className="hidden sm:table-cell">Stipend</TableHead>
                <TableHead className="hidden lg:table-cell">Deadline</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Applicants</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="w-52" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id} className="border-border/60">
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-3">
                      <OrgAvatar name={i.title} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{i.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {i.openings} opening{i.openings === 1 ? "" : "s"} · {i.skills_count} skills
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {i.location || "Remote"} · <span className="capitalize">{i.work_mode}</span>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">₹{Number(i.stipend).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {new Date(i.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {i.applicants !== undefined ? (
                      <Link href={`/dashboard/company/pipeline?internship=${i.id}`} className="hover:underline">
                        {i.applicants}
                        {!!i.active_applicants && <span className="text-muted-foreground"> · {i.active_applicants} active</span>}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={STATUS_VARIANT[i.status] ?? "violet"} className="capitalize">
                      <span className="size-1.5 rounded-full bg-current" />
                      {i.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {canManage && !isDemo && (
                        <Button size="sm" variant="outline" render={<Link href={`/dashboard/company/internships/${i.id}/edit`} />} nativeButton={false}>
                          Edit
                        </Button>
                      )}
                      {canManage && !isDemo && i.status === "draft" && (
                        <Button size="sm" onClick={() => setStatus(i, "published")}>
                          Publish
                        </Button>
                      )}
                      {canManage && !isDemo && i.status === "published" && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(i, "closed")}>
                          Close
                        </Button>
                      )}
                      {i.status === "published" && (
                        <Button size="sm" variant="ghost" render={<Link href={`/internships/${i.id}`} />} nativeButton={false}>
                          View
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
