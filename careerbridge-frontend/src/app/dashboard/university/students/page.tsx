"use client";

import * as React from "react";
import { createPortal } from "react-dom";
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
import { CloseCircleIcon, DownloadIcon, GraduateIcon, PeopleIcon, SearchIcon, TrophyIcon, VerifiedIcon } from "@/components/icons";
import { VerifiedBadge } from "@/components/verified-badge";
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

// Status tags in the table and the sheet: a size up from the default badge so they read at a glance.
const TAG = "h-8 px-3.5 text-[0.875rem] [&>svg]:size-3.5!";
// The select column: wide enough that the checkbox isn't pressed against the row edge.
const CHECK_COL = "w-[4.5rem] min-w-[4.5rem] px-0 text-center";

function VerificationBadge({ status }: { status: string }) {
  if (status === "verified")
    return (
      <Badge variant="success" className={TAG}>
        <VerifiedBadge tone="teal" className="-ml-1 size-[1.125rem]!" /> Verified
      </Badge>
    );
  if (status === "rejected") return <Badge variant="danger" className={TAG}>Needs fix</Badge>;
  return <Badge variant="warning" className={TAG}>Not verified</Badge>;
}

function RowCheckbox(props: React.ComponentProps<typeof Checkbox>) {
  return (
    <div className="flex justify-center">
      <Checkbox className="size-5 rounded-[0.375rem] [&_svg]:size-4!" {...props} />
    </div>
  );
}

export default function UniversityStudentsPage() {
  const { data: uni } = useUniversity();
  const [rows, setRows] = React.useState<CampusStudent[] | null>(null);
  const [branches, setBranches] = React.useState<string[]>([]);
  const [filters, setFilters] = React.useState({ q: "", branch: "any", year: "", verification: "any", placed: "any" });
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [openId, setOpenId] = React.useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = React.useState(false);

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

  // Only the selected students who aren't verified yet need the bulk action.
  const toVerify = rows.filter((r) => selected.has(r.id) && r.verification_status !== "verified").length;

  const bulkVerify = async () => {
    setBulkBusy(true);
    try {
      const r = await verifyStudentsBulk(ids);
      toast.success(`Verified ${r.verified} student${r.verified === 1 ? "" : "s"}`);
      setSelected(new Set());
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBulkBusy(false);
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
        <StatTile index={1} tone="blue" icon={<GraduateIcon />} title="Students" value={rows.length} meter={{ value: rows.filter((r) => r.applications > 0).length, max: rows.length }} caption={`${rows.filter((r) => r.applications > 0).length} have applied`} />
        <StatTile index={2} tone="mint" icon={<VerifiedIcon />} title="Verified" value={verified} meter={{ value: verified, max: rows.length }} caption={`${rows.length - verified} still to check`} />
        <StatTile index={3} tone="amber" icon={<SearchIcon />} title="Job hunting" value={active} meter={{ value: active, max: rows.length }} caption="With live applications" />
        <StatTile index={4} tone="violet" icon={<TrophyIcon />} title="Placed" value={placed} meter={{ value: placed, max: rows.length }} caption="Hired through CareerBridge" />
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

        {rows.length === 0 ? (
          <p className="py-12 text-center text-[0.9375rem] text-muted-foreground">
            No students found. Students appear here once they pick {uni.university.name} on their CareerBridge profile.
          </p>
        ) : (
          <Table containerClassName="max-h-[min(42rem,70svh)]" className="[&_td:not(:first-child)]:px-5 [&_th:not(:first-child)]:px-5">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={CHECK_COL}>
                  <RowCheckbox aria-label="Select all" checked={allOn} onCheckedChange={(on) => setSelected(on ? new Set(rows.map((r) => r.id)) : new Set())} />
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
                  <TableCell className={CHECK_COL} onClick={(e) => e.stopPropagation()}>
                    <RowCheckbox
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
                        <p className="truncate text-[1.0625rem] font-medium">{r.name}</p>
                        <p className="truncate text-[0.8438rem] text-muted-foreground">{r.enrollment_number || r.email}</p>
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
                    <div className="flex items-center gap-2">
                      <VerificationBadge status={r.verification_status} />
                      {r.placed && (
                        <Badge variant="violet" className={TAG}>
                          <TrophyIcon /> Placed
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {ids.length > 0 && (
          <SelectionBar
            count={ids.length}
            toVerify={toVerify}
            total={rows.length}
            busy={bulkBusy}
            onVerify={bulkVerify}
            onSelectAll={allOn ? undefined : () => setSelected(new Set(rows.map((r) => r.id)))}
            onClear={() => setSelected(new Set())}
          />
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

/** Floats at the bottom of the screen while students are selected, so the bulk action is always in reach. */
function SelectionBar({
  count,
  toVerify,
  total,
  busy,
  onVerify,
  onSelectAll,
  onClear,
}: {
  count: number;
  toVerify: number;
  total: number;
  busy: boolean;
  onVerify: () => void;
  onSelectAll?: () => void;
  onClear: () => void;
}) {
  const already = count - toVerify;
  // Fixed to the viewport (the panel clips overflow, so sticky can't work), lined up with the page's content column
  // rather than the whole window so it sits centred under the table, not under the sidebar.
  const [box, setBox] = React.useState<{ left: number; width: number } | null>(null);
  React.useLayoutEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const measure = () => {
      const r = main.getBoundingClientRect();
      setBox({ left: r.left, width: r.width });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(main);
    return () => ro.disconnect();
  }, []);
  if (!box) return null;
  // Portalled to <body>: the page animates in with a transform, which would make `fixed` relative to it.
  return createPortal(
    <div
      className="pointer-events-none fixed bottom-24 z-40 flex justify-center px-4 sm:bottom-6"
      style={{ left: box.left, width: box.width }}
    >
      <div
        role="toolbar"
        aria-label="Selected students"
        className="pointer-events-auto flex w-full max-w-2xl animate-in flex-wrap items-center gap-x-4 gap-y-3 rounded-[1.75rem] bg-popover p-2.5 pl-3 shadow-[0_2px_6px_oklch(0.2_0.02_280/0.06),0_24px_60px_-20px_oklch(0.2_0.04_280/0.4)] ring-1 ring-(--hairline) duration-300 ease-(--ease-out) fade-in-0 slide-in-from-bottom-4 sm:flex-nowrap sm:rounded-full"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lime text-(--on-lime)">
          <PeopleIcon className="size-[1.375rem]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1rem] font-medium">
            {count} {count === 1 ? "student" : "students"} selected
          </p>
          <p className="truncate text-[0.8438rem] text-muted-foreground">
            {toVerify === 0 ? "All already verified" : already > 0 ? `${toVerify} to verify · ${already} already verified` : `${toVerify} waiting for verification`}
            {onSelectAll && (
              <>
                {" · "}
                <button type="button" onClick={onSelectAll} className="font-medium text-foreground underline-offset-4 hover:underline">
                  Select all {total}
                </button>
              </>
            )}
          </p>
        </div>
        <div className="flex w-full items-center gap-1.5 sm:w-auto">
          <Button size="lg" variant="verify" className="flex-1 pl-4 sm:flex-none" onClick={onVerify} disabled={busy || toVerify === 0}>
            {busy ? <Loader2 className="animate-spin" /> : <VerifiedBadge tone="inverse" className="size-5!" />}
            Verify {toVerify > 0 ? toVerify : ""}
          </Button>
          <Button size="icon-lg" variant="ghost" aria-label="Clear selection" title="Clear selection" onClick={onClear}>
            <CloseCircleIcon className="size-[1.375rem]" />
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function InfoTile({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-[1.25rem] bg-secondary p-4", className)}>
      <dt className="text-[0.8438rem] text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-[1.0625rem] font-medium">{value}</dd>
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
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-2xl xl:max-w-3xl">
        {!s ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-8 p-6 sm:p-9">
            <SheetHeader className="p-0 pr-10">
              <div className="flex items-center gap-4 sm:gap-5">
                <OrgAvatar name={s.name} className="size-14 sm:size-16 [&_[data-slot=avatar-fallback]]:text-[1rem]" />
                <div className="min-w-0">
                  <SheetTitle className="truncate text-2xl font-medium tracking-[-0.02em] sm:text-[1.75rem]">{s.name}</SheetTitle>
                  <p className="truncate text-[0.9375rem] text-muted-foreground">{s.email}</p>
                  {s.phone && <p className="truncate text-[0.9375rem] text-muted-foreground">{s.phone}</p>}
                </div>
              </div>
            </SheetHeader>

            <div className="flex flex-wrap items-center gap-2">
              <VerificationBadge status={s.verification_status} />
              {s.placed && (
                <Badge variant="violet" className={TAG}>
                  <TrophyIcon /> Placed
                </Badge>
              )}
              <Badge variant="secondary" className={TAG}>
                Profile {s.profile_completion}% complete
              </Badge>
            </div>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <InfoTile className="col-span-2 sm:col-span-1" label="Degree" value={[s.degree, s.branch].filter(Boolean).join(" · ") || "—"} />
              <InfoTile label="Graduates" value={s.graduation_year ?? "—"} />
              <InfoTile
                label="Resume"
                value={
                  s.resume ? (
                    <a href={s.resume} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-muted-foreground">
                      Open resume
                    </a>
                  ) : (
                    "Not uploaded"
                  )
                }
              />
              <div className="col-span-2 rounded-[1.25rem] bg-secondary p-4 sm:col-span-3">
                <dt className="text-[0.8438rem] text-muted-foreground">Skills · {s.skill_list.length}</dt>
                <dd className="mt-2.5 flex flex-wrap gap-2">
                  {s.skill_list.length === 0 && <span className="text-[1rem]">—</span>}
                  {s.skill_list.map((k) => (
                    <span key={k.name} className="rounded-full bg-card px-3.5 py-1.5 text-[0.875rem] font-medium">
                      {k.name}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>

            <section className="space-y-5 rounded-[1.625rem] border border-(--hairline) p-5 sm:p-7">
              <div>
                <h3 className="text-[1.25rem] font-medium tracking-[-0.01em]">Verify enrolment & grades</h3>
                <p className="mt-1 text-[0.9063rem] text-muted-foreground">Check these against your records, then verify or send back with a note.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Enrollment no.">
                  <Input value={form.enrollment_number} onChange={(e) => setForm({ ...form, enrollment_number: e.target.value })} />
                </Field>
                <Field label="CGPA (official)">
                  <Input type="number" step="0.01" min={0} max={10} value={form.cgpa} onChange={(e) => setForm({ ...form, cgpa: e.target.value })} />
                </Field>
              </div>
              <Field label="Note to student" hint="Required when sending back for a fix.">
                <Textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. CGPA doesn't match our records — please update." />
              </Field>
              <div className="flex flex-wrap gap-2.5">
                <Button size="lg" variant="verify" className="pl-4" onClick={() => verify("verified")} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <VerifiedBadge tone="inverse" className="size-5!" />}
                  {s.verification_status === "verified" ? "Verify again" : "Verify student"}
                </Button>
                <Button size="lg" variant="outline" onClick={() => verify("rejected")} disabled={busy || !form.note.trim()}>
                  Needs a fix
                </Button>
                {s.verification_status !== "unverified" && (
                  <Button size="lg" variant="ghost" onClick={() => verify("unverified")} disabled={busy}>
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-[0.8438rem] text-muted-foreground">Recruiters see a “Verified” mark next to verified students. If the student edits these details later, verification resets.</p>
            </section>

            <section className="space-y-3">
              <h3 className="text-[1.25rem] font-medium tracking-[-0.01em]">Applications · {s.application_list.length}</h3>
              {s.application_list.length === 0 && <p className="rounded-[1.25rem] bg-secondary/60 p-5 text-[0.9375rem] text-muted-foreground">No applications yet.</p>}
              {s.application_list.map((a) => (
                <div key={a.id} className="flex items-center gap-4 rounded-[1.25rem] bg-secondary/60 p-4">
                  <OrgAvatar name={a.company} className="size-11" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[1.0313rem] font-medium">{a.internship}</p>
                    <p className="truncate text-[0.875rem] text-muted-foreground">
                      {a.company} · {fmtMoney(a.stipend)}/mo · applied {fmtDate(a.applied_at)}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </section>

            {s.drives.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-[1.25rem] font-medium tracking-[-0.01em]">Campus drives</h3>
                {s.drives.map((d) => (
                  <div key={d.id} className="flex items-center gap-4 rounded-[1.25rem] bg-secondary/60 p-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card">
                      <GraduateIcon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[1.0313rem] font-medium">{d.title}</p>
                      <p className="text-[0.875rem] text-muted-foreground">{fmtDate(d.date)}</p>
                    </div>
                    <Badge variant={d.outcome === "selected" ? "success" : "secondary"} className={cn(TAG, "capitalize")}>
                      {d.outcome.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
