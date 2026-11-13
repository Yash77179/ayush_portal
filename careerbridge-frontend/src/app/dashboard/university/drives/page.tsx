"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";

import { errorMessage } from "@/lib/api";
import {
  deleteDrive,
  fmtDate,
  fmtDateTime,
  getDrive,
  getDriveOptions,
  getDrives,
  saveDrive,
  toLocalInput,
  updateRegistration,
  type Drive,
  type DriveRegistration,
} from "@/lib/ats";
import { CalendarIcon, LocationIcon, PeopleIcon, PlusIcon, TrashIcon, TrophyIcon } from "@/components/icons";
import { DashboardSkeleton, Field, OrgAvatar, PageHeader, Panel, StatTile, stagger } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const STATUS: Record<Drive["status"], { label: string; variant: "info" | "warning" | "success" | "danger" }> = {
  upcoming: { label: "Upcoming", variant: "info" },
  ongoing: { label: "Ongoing", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "danger" },
};
const OUTCOME = { pending: "Pending", selected: "Selected", not_selected: "Not selected" };
type Options = Awaited<ReturnType<typeof getDriveOptions>>;

export default function DrivesPage() {
  const [drives, setDrives] = React.useState<Drive[] | null>(null);
  const [editing, setEditing] = React.useState<Drive | "new" | null>(null);
  const [openId, setOpenId] = React.useState<number | null>(null);

  const load = React.useCallback(() => {
    getDrives()
      .then(setDrives)
      .catch((err) => {
        toast.error(errorMessage(err));
        setDrives([]);
      });
  }, []);
  React.useEffect(load, [load]);

  if (drives === null) return <DashboardSkeleton />;

  const upcoming = drives.filter((d) => d.status === "upcoming" && new Date(d.drive_date) >= new Date());
  const regs = drives.reduce((n, d) => n + d.registrations_count, 0);
  const completed = drives.filter((d) => d.status === "completed").length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Placement drives"
        subtitle="Bring companies to campus. Eligible students are notified automatically and can register in one tap."
        actions={
          <Button size="lg" onClick={() => setEditing("new")}>
            <PlusIcon /> New drive
          </Button>
        }
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <StatTile index={1} tone="blue" icon={<CalendarIcon />} title="Upcoming" value={upcoming.length} caption="Scheduled drives" />
        <StatTile index={2} tone="amber" icon={<PeopleIcon />} title="Registrations" value={regs} caption="Across all drives" />
        <StatTile index={3} tone="mint" icon={<TrophyIcon />} title="Completed" value={completed} caption="Drives run" />
      </div>

      <Panel title="All drives" style={stagger(4)} contentClassName="space-y-3">
        {drives.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-[15px] text-muted-foreground">No drives yet. Create one to invite eligible students.</p>
            <Button className="mt-4" onClick={() => setEditing("new")}>
              New drive
            </Button>
          </div>
        )}
        {drives.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setOpenId(d.id)}
            className={cn("flex w-full flex-wrap items-center gap-4 rounded-[22px] border border-(--hairline) p-4 text-left transition-colors hover:bg-secondary/50", d.status === "cancelled" && "opacity-60")}
          >
            <div className="flex w-16 shrink-0 flex-col items-center rounded-2xl bg-secondary py-2">
              <span className="text-[13.5px] text-muted-foreground uppercase">{new Date(d.drive_date).toLocaleDateString("en-IN", { month: "short" })}</span>
              <span className="text-2xl leading-none font-light tabular-nums">{new Date(d.drive_date).getDate()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-medium">{d.title}</p>
              <p className="text-[14.5px] text-muted-foreground">
                {d.company_display}
                {d.internship_title && ` · ${d.internship_title}`} · {fmtDateTime(d.drive_date)}
              </p>
              {d.venue && (
                <p className="mt-0.5 flex items-center gap-1 text-[14.5px] text-muted-foreground">
                  <LocationIcon className="size-3.5" /> {d.venue}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4 text-[15px]">
              <span className="text-muted-foreground tabular-nums">
                {d.registrations_count} registered{d.eligible_count !== undefined && ` / ${d.eligible_count} eligible`}
              </span>
              <Badge variant={STATUS[d.status].variant}>{STATUS[d.status].label}</Badge>
            </div>
          </button>
        ))}
      </Panel>

      <DriveForm
        open={editing !== null}
        drive={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
      <DriveSheet
        id={openId}
        onClose={() => setOpenId(null)}
        onEdit={(d) => {
          setOpenId(null);
          setEditing(d);
        }}
        onChanged={load}
      />
    </div>
  );
}

function DriveForm({ open, drive, onClose, onSaved }: { open: boolean; drive: Drive | null; onClose: () => void; onSaved: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92svh] max-w-2xl overflow-y-auto rounded-[32px] p-7">
        {open && <DriveFormBody key={drive?.id ?? "new"} drive={drive} onClose={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function blankDrive() {
  const d = new Date(Date.now() + 7 * 86400000);
  d.setHours(10, 0, 0, 0);
  return {
    title: "",
    company: "none",
    company_name: "",
    internship: "none",
    drive_date: toLocalInput(d),
    venue: "",
    registration_deadline: "",
    min_cgpa: "",
    allowed_branches: "",
    graduation_year: "",
    description: "",
    status: "upcoming" as string,
  };
}

function DriveFormBody({ drive, onClose, onSaved }: { drive: Drive | null; onClose: () => void; onSaved: () => void }) {
  const [options, setOptions] = React.useState<Options>([]);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState(() =>
    drive
      ? {
          title: drive.title,
          company: drive.company ? String(drive.company) : "none",
          company_name: drive.company_name,
          internship: drive.internship ? String(drive.internship) : "none",
          drive_date: toLocalInput(new Date(drive.drive_date)),
          venue: drive.venue,
          registration_deadline: drive.registration_deadline ?? "",
          min_cgpa: drive.min_cgpa ?? "",
          allowed_branches: drive.allowed_branches,
          graduation_year: drive.graduation_year ? String(drive.graduation_year) : "",
          description: drive.description,
          status: drive.status as string,
        }
      : blankDrive()
  );

  React.useEffect(() => {
    getDriveOptions()
      .then(setOptions)
      .catch(() => setOptions([]));
  }, []);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const company = options.find((c) => String(c.id) === form.company);
  const companyItems = { none: "Not on CareerBridge (type a name)", ...Object.fromEntries(options.map((c) => [String(c.id), c.name])) };
  const internshipItems = { none: "No linked internship", ...Object.fromEntries((company?.internships ?? []).map((i) => [String(i.id), i.title])) };

  const save = async () => {
    setSaving(true);
    try {
      await saveDrive(
        {
          title: form.title,
          description: form.description,
          company: form.company === "none" ? null : Number(form.company),
          company_name: form.company === "none" ? form.company_name : "",
          internship: form.internship === "none" ? null : Number(form.internship),
          drive_date: new Date(form.drive_date).toISOString(),
          venue: form.venue,
          registration_deadline: form.registration_deadline || null,
          min_cgpa: form.min_cgpa || null,
          allowed_branches: form.allowed_branches,
          graduation_year: form.graduation_year ? Number(form.graduation_year) : null,
          status: form.status,
        },
        drive?.id
      );
      toast.success(drive ? "Drive updated" : "Drive created — eligible students have been notified");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
        <DialogHeader>
          <DialogTitle className="text-2xl font-medium tracking-tight">{drive ? "Edit drive" : "New placement drive"}</DialogTitle>
          <DialogDescription>Link a company’s internship and registering students are applied to it automatically — they show up in the recruiter’s pipeline.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <Field label="Title *">
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Acme SDE Intern hiring day" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company">
              <Select value={form.company} items={companyItems} onValueChange={(v) => { set("company", String(v ?? "none")); set("internship", "none"); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(companyItems).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {form.company === "none" ? (
              <Field label="Company name *">
                <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
              </Field>
            ) : (
              <Field label="Internship">
                <Select value={form.internship} items={internshipItems} onValueChange={(v) => set("internship", String(v ?? "none"))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(internshipItems).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Date & time *">
              <Input type="datetime-local" value={form.drive_date} onChange={(e) => set("drive_date", e.target.value)} />
            </Field>
            <Field label="Register by">
              <Input type="date" value={form.registration_deadline} onChange={(e) => set("registration_deadline", e.target.value)} />
            </Field>
          </div>
          <Field label="Venue">
            <Input value={form.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Auditorium, Block 34 — or a meeting link" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Min CGPA">
              <Input type="number" step="0.01" min={0} max={10} value={form.min_cgpa} onChange={(e) => set("min_cgpa", e.target.value)} />
            </Field>
            <Field label="Batch">
              <Input type="number" min={2000} max={2100} value={form.graduation_year} onChange={(e) => set("graduation_year", e.target.value)} placeholder="Any" />
            </Field>
            <Field label="Branches">
              <Input value={form.allowed_branches} onChange={(e) => set("allowed_branches", e.target.value)} placeholder="CSE, IT" />
            </Field>
          </div>
          <Field label="Details for students">
            <Textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Rounds, what to bring, dress code…" />
          </Field>
          {drive && (
            <Field label="Status" hint="Cancelling emails everyone who registered.">
              <Select value={form.status} items={Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.label]))} onValueChange={(v) => v && set("status", String(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !form.title.trim() || !form.drive_date || (form.company === "none" && !form.company_name.trim())}>
            {saving && <Loader2 className="animate-spin" />} {drive ? "Save" : "Create & notify students"}
          </Button>
        </DialogFooter>
    </>
  );
}

function DriveSheet({ id, onClose, onEdit, onChanged }: { id: number | null; onClose: () => void; onEdit: (d: Drive) => void; onChanged: () => void }) {
  type Detail = Drive & { registrations: DriveRegistration[]; eligible_count: number };
  const [loaded, setLoaded] = React.useState<Detail | null>(null);
  React.useEffect(() => {
    if (id === null) return;
    getDrive(id)
      .then(setLoaded)
      .catch((err) => toast.error(errorMessage(err)));
  }, [id]);
  const d = loaded && loaded.id === id ? loaded : null;
  const setD = setLoaded;

  const update = async (r: DriveRegistration, data: { attended?: boolean; outcome?: string }) => {
    if (!d) return;
    try {
      const nr = await updateRegistration(d.id, r.id, data);
      setD({ ...d, registrations: d.registrations.map((x) => (x.id === r.id ? nr : x)) });
      if (data.outcome === "selected") toast.success(`${r.name} marked selected — they've been notified`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const exportCsv = () => {
    if (!d) return;
    const head = ["Name", "Email", "Branch", "CGPA", "Verified", "Registered", "Attended", "Outcome"];
    const lines = d.registrations.map((r) => [r.name, r.email, r.branch, r.cgpa ?? "", r.verification_status === "verified" ? "yes" : "no", fmtDate(r.registered_at), r.attended ? "yes" : "no", OUTCOME[r.outcome]]);
    const csv = [head, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `drive-${d.id}-registrations.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-2xl">
        {!d ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 p-6">
            <SheetHeader className="p-0">
              <div className="flex items-center gap-4">
                <OrgAvatar name={d.company_display} className="size-14" />
                <div className="min-w-0">
                  <SheetTitle className="text-2xl font-medium">{d.title}</SheetTitle>
                  <p className="text-[15px] text-muted-foreground">
                    {d.company_display} · {fmtDateTime(d.drive_date)}
                  </p>
                </div>
              </div>
            </SheetHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS[d.status].variant}>{STATUS[d.status].label}</Badge>
              <span className="text-[15px] text-muted-foreground tabular-nums">
                {d.registrations.length} registered · {d.eligible_count} eligible
              </span>
            </div>
            {d.description && <p className="text-[15px] whitespace-pre-wrap text-muted-foreground">{d.description}</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => onEdit(d)}>
                Edit
              </Button>
              <Button variant="outline" onClick={exportCsv} disabled={!d.registrations.length}>
                Export list
              </Button>
              {d.registrations.length === 0 && (
                <Button
                  variant="ghost"
                  className="text-destructive"
                  onClick={async () => {
                    try {
                      await deleteDrive(d.id);
                      toast.success("Drive deleted");
                      onChanged();
                      onClose();
                    } catch (err) {
                      toast.error(errorMessage(err));
                    }
                  }}
                >
                  <TrashIcon /> Delete
                </Button>
              )}
            </div>

            {d.registrations.length === 0 ? (
              <p className="rounded-2xl bg-secondary p-6 text-center text-[15px] text-muted-foreground">Nobody has registered yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Student</TableHead>
                    <TableHead className="hidden sm:table-cell">CGPA</TableHead>
                    <TableHead>Attended</TableHead>
                    <TableHead className="w-40">Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.registrations.map((r) => (
                    <TableRow key={r.id} className="border-border/60">
                      <TableCell className="py-3">
                        <p className="text-[17px] font-medium">{r.name}</p>
                        <p className="text-[13.5px] text-muted-foreground">{r.branch || r.email}</p>
                      </TableCell>
                      <TableCell className="hidden tabular-nums sm:table-cell">{r.cgpa ?? "—"}</TableCell>
                      <TableCell>
                        <Checkbox aria-label={`${r.name} attended`} checked={r.attended} onCheckedChange={(v) => update(r, { attended: !!v })} />
                      </TableCell>
                      <TableCell>
                        <Select value={r.outcome} items={OUTCOME} onValueChange={(v) => v && v !== r.outcome && update(r, { outcome: String(v) })}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(OUTCOME).map(([k, v]) => (
                              <SelectItem key={k} value={k}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
