"use client";

import * as React from "react";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api";
import { STAGE_LABEL, exportPlacementReport, fmtDateTime, fmtMoney, getPlacementReport, type PlacementReport } from "@/lib/ats";
import { DownloadIcon, GraduateIcon, PrinterIcon, TrophyIcon, VerifiedIcon, WalletIcon } from "@/components/icons";
import { DashboardSkeleton, Gauge, PageHeader, Panel, ProgressBar, SegBars, StatTile, stagger } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ReportsPage() {
  const [r, setR] = React.useState<PlacementReport | null>(null);

  React.useEffect(() => {
    getPlacementReport()
      .then(setR)
      .catch((err) => toast.error(errorMessage(err)));
  }, []);

  if (!r) return <DashboardSkeleton />;

  return (
    <div className="space-y-8 print:space-y-5">
      <PageHeader
        title="Placement report"
        subtitle={`${r.university} · generated ${fmtDateTime(r.generated_at)}`}
        actions={
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="lg" onClick={() => window.print()}>
              <PrinterIcon /> PDF
            </Button>
            <Button size="lg" onClick={() => exportPlacementReport().catch((e) => toast.error(errorMessage(e)))}>
              <DownloadIcon /> Student-wise CSV
            </Button>
          </div>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile index={1} tone="blue" icon={<GraduateIcon />} title="Students" value={r.total_students} caption={`${r.students_applied} have applied`} />
        <StatTile index={2} tone="mint" icon={<TrophyIcon />} title="Placed" value={r.students_placed} caption={`${r.placement_rate}% placement rate`} />
        <StatTile index={3} tone="amber" icon={<WalletIcon />} title="Median stipend" value={r.stipend.median !== null ? fmtMoney(r.stipend.median) : "—"} caption={r.stipend.highest !== null ? `Highest ${fmtMoney(r.stipend.highest)}` : "No placements yet"} />
        <StatTile index={4} tone="violet" icon={<VerifiedIcon />} title="Verified" value={r.verified_students} caption="Profiles checked by you" />
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-5" title="Placement rate" style={stagger(5)}>
          <Gauge className="my-4" value={r.placement_rate} label="of students placed" />
          <div className="mt-4 grid grid-cols-2 gap-4 text-[15px]">
            <div className="rounded-2xl bg-secondary p-4">
              <p className="text-muted-foreground">In interviews</p>
              <p className="mt-1 text-2xl font-light tabular-nums">{r.in_interviews}</p>
            </div>
            <div className="rounded-2xl bg-secondary p-4">
              <p className="text-muted-foreground">Offers pending</p>
              <p className="mt-1 text-2xl font-light tabular-nums">{r.offers_pending}</p>
            </div>
          </div>
        </Panel>
        <Panel className="lg:col-span-7" title="Top recruiters" style={stagger(6)}>
          <SegBars data={r.top_recruiters.map((t) => ({ label: t.company, value: t.hires }))} emptyText="Shows companies once students are hired" />
        </Panel>
      </div>

      <Panel title="Branch-wise" style={stagger(7)}>
        {r.branches.length === 0 ? (
          <p className="py-6 text-[15px] text-muted-foreground">No students yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Applied</TableHead>
                <TableHead className="text-right">Placed</TableHead>
                <TableHead className="w-[30%]">Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.branches.map((b) => (
                <TableRow key={b.branch} className="border-border/60">
                  <TableCell className="py-3 font-medium">{b.branch}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.students}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{b.applied}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.placed}</TableCell>
                  <TableCell>
                    <ProgressBar label={`${b.rate}%`} value={b.rate} track="muted" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Where applications stand" style={stagger(8)}>
          <SegBars data={r.pipeline.map((p) => ({ label: STAGE_LABEL[p.status] ?? p.status, value: p.count }))} emptyText="No applications yet" />
        </Panel>
        <Panel title="By batch" style={stagger(9)} contentClassName="space-y-4">
          {r.years.map((y) => (
            <ProgressBar key={y.year} label={`${y.year} · ${y.placed}/${y.students} placed`} value={y.students ? (y.placed / y.students) * 100 : 0} />
          ))}
          {r.years.length === 0 && <p className="text-[15px] text-muted-foreground">No students yet.</p>}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Campus drives" style={stagger(10)}>
          <dl className="grid grid-cols-2 gap-4 text-[15px]">
            {[
              ["Drives", r.drives.total],
              ["Upcoming", r.drives.upcoming],
              ["Registrations", r.drives.registrations],
              ["Selected at drives", r.drives.selected],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-secondary p-4">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="mt-1 text-2xl font-light tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Top student skills" style={stagger(11)}>
          <SegBars data={r.top_skills.slice(0, 6).map((s) => ({ label: s.skill, value: s.count }))} emptyText="Appears as students add skills" />
        </Panel>
      </div>
    </div>
  );
}
