"use client";

import * as React from "react";
import { toast } from "sonner";

import { errorMessage, getMyInternships } from "@/lib/api";
import { exportApplicants, getAnalytics, type Analytics } from "@/lib/ats";
import { CalendarIcon, ClockIcon, DownloadIcon, PeopleIcon, TrophyIcon } from "@/components/icons";
import { DashboardSkeleton, Funnel, PageHeader, Panel, ProgressBar, SegBars, StatTile, stagger } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const FUNNEL_COLORS = ["#60a5fa", "#fbbf24", "#a78bfa", "#3b82f6", "#fb923c", "#22c55e"];

export default function AnalyticsPage() {
  const [internship, setInternship] = React.useState("all");
  const [listings, setListings] = React.useState<{ id: number; title: string }[]>([]);
  const [result, setResult] = React.useState<{ key: string; data: Analytics } | null>(null);

  React.useEffect(() => {
    getMyInternships()
      .then((d) => setListings((Array.isArray(d) ? d : ((d as { results?: { id: number; title: string }[] }).results ?? [])) as { id: number; title: string }[]))
      .catch(() => setListings([]));
  }, []);

  React.useEffect(() => {
    getAnalytics(internship === "all" ? undefined : internship)
      .then((d) => setResult({ key: internship, data: d }))
      .catch((err) => toast.error(errorMessage(err)));
  }, [internship]);
  const data = result?.key === internship ? result.data : null;

  const listingItems = { all: "All internships", ...Object.fromEntries(listings.map((l) => [String(l.id), l.title])) };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        subtitle="How candidates move through your hiring funnel, and how long it takes."
        actions={
          <>
            <div className="w-60">
              <Select value={internship} items={listingItems} onValueChange={(v) => v && setInternship(String(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(listingItems).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="lg" onClick={() => exportApplicants(internship === "all" ? undefined : { internship }).catch((e) => toast.error(errorMessage(e)))}>
              <DownloadIcon /> CSV
            </Button>
          </>
        }
      />

      {!data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile index={1} tone="blue" icon={<PeopleIcon />} title="Applicants" value={data.total} caption={`${data.rejected} rejected`} />
            <StatTile index={2} tone="mint" icon={<TrophyIcon />} title="Hired" value={data.funnel.at(-1)?.count ?? 0} caption={data.total ? `${(((data.funnel.at(-1)?.count ?? 0) / data.total) * 100).toFixed(1)}% of applicants` : "—"} />
            <StatTile index={3} tone="amber" icon={<ClockIcon />} title="Time to hire" value={data.time_to_hire_days ?? "—"} unit={data.time_to_hire_days !== null ? "days" : undefined} caption="Applied → hired, average" />
            <StatTile index={4} tone="violet" icon={<CalendarIcon />} title="Interviews" value={data.upcoming_interviews} caption="Coming up" />
          </div>

          <Panel title="Funnel" style={stagger(5)} contentClassName="space-y-6">
            <div className="overflow-x-auto pb-2">
              <Funnel className="min-w-[44rem]" stages={data.funnel.map((f, i) => ({ label: f.label, value: f.count, color: FUNNEL_COLORS[i] }))} />
            </div>
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.funnel.slice(1).map((f, i) => (
                <ProgressBar key={f.stage} label={`${data.funnel[i].label} → ${f.label}`} value={f.conversion} />
              ))}
            </div>
            <p className="text-[14.5px] text-muted-foreground">Counts include everyone who ever reached a stage, so people rejected later still show how far they got.</p>
          </Panel>

          <div className="grid items-start gap-5 lg:grid-cols-2">
            <Panel title="Time in each stage" style={stagger(6)}>
              <SegBars
                data={data.time_in_stage_days.map((t) => ({ label: t.label, value: t.avg_days ?? 0 }))}
                emptyText="Appears once candidates start moving"
              />
              <p className="mt-3 text-[14.5px] text-muted-foreground">Average days before moving on.</p>
            </Panel>
            <Panel title="Where applicants come from" style={stagger(7)} contentClassName="space-y-4">
              {data.sources.length === 0 && <p className="text-[15px] text-muted-foreground">No applicants yet.</p>}
              {data.sources.map((s) => (
                <ProgressBar key={s.source} label={`${s.label} · ${s.count}`} value={data.total ? (s.count / data.total) * 100 : 0} />
              ))}
              <div className="rounded-2xl bg-secondary p-4 text-[15px]">
                <p className="text-[17px] font-medium">Offers</p>
                <p className="mt-1 text-muted-foreground">
                  {data.offers.sent} sent · {data.offers.accepted} accepted
                  {data.offers.acceptance_rate !== null && ` · ${data.offers.acceptance_rate}% acceptance`}
                </p>
              </div>
            </Panel>
          </div>

          <Panel title="By listing" style={stagger(8)}>
            {data.per_listing.length === 0 ? (
              <p className="py-8 text-center text-[15px] text-muted-foreground">No applications yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Internship</TableHead>
                    <TableHead className="text-right">Applicants</TableHead>
                    <TableHead className="text-right">In process</TableHead>
                    <TableHead className="text-right">Hired</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Rejected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.per_listing.map((r) => (
                    <TableRow key={r.id} className="border-border/60">
                      <TableCell className="py-3 font-medium">{r.title}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.applicants}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.active}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.hired}</TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{r.rejected}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
