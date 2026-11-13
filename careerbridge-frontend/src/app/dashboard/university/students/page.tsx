"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";

import { errorMessage } from "@/lib/api";
import {
  getCampusStudent,
  getCampusStudents,
  verifyStudent,
  verifyStudentsBulk,
  fmtDate,
  fmtMoney,
  exportPlacementReport,
  type CampusStudent,
  type CampusStudentDetail,
} from "@/lib/ats";
import { useUniversity } from "@/components/org-gate";
import { DownloadIcon, GraduateIcon, SearchIcon, TrophyIcon, VerifiedIcon } from "@/components/icons";
import { DashboardSkeleton, Field, OrgAvatar, PageHeader, Panel, StatTile, StatusBadge, stagger } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const VERIFY = { any: "Any status", unverified: "Not verified", verified: "Verified", rejected: "Needs fix" };
const PLACED = { any: "Everyone", yes: "Placed", no: "Not placed" };

function VerificationBadge({ status }: { status: string }) {
  if (status === "verified")
    return (
      <Badge variant="success">
        <VerifiedIcon className="size-3.5" /> Verified
      </Badge>
    );
  if (status === "rejected") return <Badge variant="danger">Needs fix</Badge>;
  return <Badge variant="warning">Not verified</Badge>;
}

export default function UniversityStudentsPage() {
  const { data: uni } = useUniversity();
  const [rows, setRows] = React.useState<CampusStudent[] | null>(null);
  const [branches, setBranches] = React.useState<string[]>([]);
  const [filters, setFilters] = React.useState({ q: "", branch: "any", year: "", verification: "any", placed: "any" });
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [openId, setOpenId] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (filters.q) params.q = filters.q;
      if (filters.branch !== "any") params.branch = filters.branch;
      if (filters.year) params.year = filters.year;
      if (filters.verification !== "any") params.verification = filters.verification;
      if (filters.placed !== "any") params.placed = filters.placed;
      const d = await getCampusStudents(params);
      setRows(d.results);
      setBranches(d.branches);
    } catch (err) {
      toast.error(errorMessage(err));
      setRows([]);
    }
  }, [filters]);

  React.useEffect(() => {
    const t = setTimeout(load, filters.q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, filters.q]);

  if (rows === null) return <DashboardSkeleton />;

  const set = (k: keyof typeof filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const ids = [...selected].filter((id) => rows.some((r) => r.id === id));
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const verified = rows.filter((r) => r.verification_status === "verified").length;
  const placed = rows.filter((r) => r.placed).length;
  const active = rows.filter((r) => r.active > 0).length;

  const bulkVerify = async () => {
    try {
      const r = await verifyStudentsBulk(ids);
      toast.success(`Verified ${r.verified} student${r.verified === 1 ? "" : "s"}`);
      setSelected(new Set());
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Students"
        subtitle={`Everyone who listed ${uni.university.name} on their profile.`}
        actions={
          <Button variant="outline" size="lg" onClick={() => exportPlacementReport().catch((e) => toast.error(errorMessage(e)))}>
            <DownloadIcon /> Export CSV
          </Button>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile index={1} tone="blue" icon={<GraduateIcon />} title="Students" value={rows.length} caption="Matching the filters" />
        <StatTile index={2} tone="mint" icon={<VerifiedIcon />} title="Verified" value={verified} caption={`${rows.length - verified} still to check`} />
        <StatTile index={3} tone="amber" icon={<SearchIcon />} title="Job hunting" value={active} caption="With live applications" />
        <StatTile index={4} tone="violet" icon={<TrophyIcon />} title="Placed" value={placed} caption={rows.length ? `${Math.round((placed / rows.length) * 100)}% placed` : "—"} />
      </div>

      <Panel title="All students" style={stagger(5)} contentClassName="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filters.q} onChange={(e) => set("q", e.target.value)} placeholder="Search students" className="pl-10" />
          </div>
          <FilterSelect value={filters.branch} items={{ any: "All branches", ...Object.fromEntries(branches.map((b) => [b, b])) }} onChange={(v) => set("branch", v)} />
          <Input type="number" placeholder="Batch (e.g. 2027)" value={filters.year} onChange={(e) => set("year", e.target.value)} />
          <FilterSelect value={filters.verification} items={VERIFY} onChange={(v) => set("verification", v)} />
          <FilterSelect value={filters.placed} items={PLACED} onChange={(v) => set("placed", v)} />
        </div>

        {ids.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-[20px] bg-secondary p-2.5 pl-4">
            <span className="mr-2 text-[15px] font-medium tabular-nums">{ids.length} selected</span>
            <Button size="sm" onClick={bulkVerify}>
              <VerifiedIcon /> Verify all
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}

        {rows.length === 0 ? (
          <p className="py-12 text-center text-[15px] text-muted-foreground">
            No students found. Students appear here once they pick {uni.university.name} on their CareerBridge profile.
          </p>
        ) : (
          <Table containerClassName="max-h-[min(42rem,70svh)]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox aria-label="Select all" checked={allOn} onCheckedChange={(on) => setSelected(on ? new Set(rows.map((r) => r.id)) : new Set())} />
                </TableHead>
                <TableHead>Student</TableHead>
                <TableHead className="hidden md:table-cell">Branch · batch</TableHead>
                <TableHead className="hidden sm:table-cell">CGPA</TableHead>
                <TableHead className="hidden lg:table-cell">Applications</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className={cn("cursor-pointer border-border/60", selected.has(r.id) && "bg-secondary/60")} onClick={() => setOpenId(r.id)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      aria-label={`Select ${r.name}`}
                      checked={selected.has(r.id)}
                      onCheckedChange={() =>
                        setSelected((s) => {
                          const n = new Set(s);
                          if (n.has(r.id)) n.delete(r.id);
                          else n.add(r.id);
                          return n;
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-3">
                      <OrgAvatar name={r.name} />
                      <div className="min-w-0">
                        <p className="truncate text-[17px] font-medium">{r.name}</p>
                        <p className="truncate text-[13.5px] text-muted-foreground">{r.enrollment_number || r.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {r.branch || "—"} · {r.graduation_year ?? "—"}
                  </TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">{r.cgpa ?? "—"}</TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {r.applications} total{r.active ? ` · ${r.active} active` : ""}
                    {r.offers ? ` · ${r.offers} offer` : ""}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <VerificationBadge status={r.verification_status} />
                      {r.placed && <Badge variant="violet">Placed</Badge>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <StudentSheet id={openId} onClose={() => setOpenId(null)} onChanged={load} />
    </div>
  );
}

function FilterSelect({ value, items, onChange }: { value: string; items: Record<string, string>; onChange: (v: string) => void }) {
  return (
    <div>
      <Select value={value} items={items} onValueChange={(v) => v && onChange(String(v))}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(items).map(([k, v]) => (
            <SelectItem key={k} value={k}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StudentSheet({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const [loaded, setLoaded] = React.useState<CampusStudentDetail | null>(null);
  const s = loaded && loaded.id === id ? loaded : null;
  const [form, setForm] = React.useState({ enrollment_number: "", cgpa: "", note: "" });
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (id === null) return;
    getCampusStudent(id)
      .then((d) => {
        setLoaded(d);
        setForm({ enrollment_number: d.enrollment_number, cgpa: d.cgpa ?? "", note: d.verification_note });
      })
      .catch((err) => toast.error(errorMessage(err)));
  }, [id]);

  const verify = async (status: "verified" | "rejected" | "unverified") => {
    if (!s) return;
    setBusy(true);
    try {
      await verifyStudent(s.id, { status, note: form.note, enrollment_number: form.enrollment_number, cgpa: form.cgpa });
      toast.success(status === "verified" ? `${s.name} is verified` : status === "rejected" ? "Sent back to the student to fix" : "Verification cleared");
      onChanged();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
        {!s ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 p-6">
            <SheetHeader className="p-0">
              <div className="flex items-center gap-4">
                <OrgAvatar name={s.name} className="size-14" />
                <div className="min-w-0">
                  <SheetTitle className="truncate text-2xl font-medium">{s.name}</SheetTitle>
                  <p className="truncate text-[15px] text-muted-foreground">{s.email}{s.phone && ` · ${s.phone}`}</p>
                </div>
              </div>
            </SheetHeader>

            <div className="flex flex-wrap items-center gap-2">
              <VerificationBadge status={s.verification_status} />
              {s.placed && <Badge variant="violet">Placed</Badge>}
              <span className="text-[15px] text-muted-foreground">Profile {s.profile_completion}% complete</span>
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl bg-secondary p-4 text-[15px]">
              <dt className="text-muted-foreground">Degree</dt>
              <dd>{[s.degree, s.branch].filter(Boolean).join(" · ") || "—"}</dd>
              <dt className="text-muted-foreground">Graduates</dt>
              <dd>{s.graduation_year ?? "—"}</dd>
              <dt className="text-muted-foreground">Resume</dt>
              <dd>{s.resume ? <a href={s.resume} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">Open</a> : "—"}</dd>
              <dt className="text-muted-foreground">Skills</dt>
              <dd>{s.skill_list.map((k) => k.name).join(", ") || "—"}</dd>
            </dl>

            <section className="space-y-4 rounded-[24px] border border-(--hairline) p-5">
              <h3 className="text-lg font-medium">Verify enrolment & grades</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Enrollment no.">
                  <Input value={form.enrollment_number} onChange={(e) => setForm({ ...form, enrollment_number: e.target.value })} />
                </Field>
                <Field label="CGPA (official)">
                  <Input type="number" step="0.01" min={0} max={10} value={form.cgpa} onChange={(e) => setForm({ ...form, cgpa: e.target.value })} />
                </Field>
              </div>
              <Field label="Note to student" hint="Required when sending back for a fix.">
                <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. CGPA doesn't match our records — please update." />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => verify("verified")} disabled={busy}>
                  {busy && <Loader2 className="animate-spin" />} <VerifiedIcon /> Verify
                </Button>
                <Button variant="outline" onClick={() => verify("rejected")} disabled={busy || !form.note.trim()}>
                  Needs a fix
                </Button>
                {s.verification_status !== "unverified" && (
                  <Button variant="ghost" onClick={() => verify("unverified")} disabled={busy}>
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-[13.5px] text-muted-foreground">Recruiters see a “Verified” mark next to verified students. If the student edits these details later, verification resets.</p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-medium">Applications · {s.application_list.length}</h3>
              {s.application_list.length === 0 && <p className="text-[15px] text-muted-foreground">No applications yet.</p>}
              {s.application_list.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
                  <OrgAvatar name={a.company} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{a.internship}</p>
                    <p className="truncate text-[13.5px] text-muted-foreground">
                      {a.company} · {fmtMoney(a.stipend)}/mo · {fmtDate(a.applied_at)}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </section>

            {s.drives.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-lg font-medium">Campus drives</h3>
                {s.drives.map((d) => (
                  <p key={d.id} className="text-[15px]">
                    {d.title} · {fmtDate(d.date)} · <span className="capitalize text-muted-foreground">{d.outcome.replace("_", " ")}</span>
                  </p>
                ))}
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
