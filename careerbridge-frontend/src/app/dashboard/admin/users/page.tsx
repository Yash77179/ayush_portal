"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";

import { errorMessage } from "@/lib/api";
import {
  fmtDay,
  getAdminUser,
  getAdminUsers,
  ROLE_LABEL,
  setAdminUserPassword,
  updateAdminUser,
  type AdminUser,
  type AdminUserDetail,
  type Role,
} from "@/lib/admin";
import { BuildingsIcon, GraduateIcon, PeopleIcon, ProfileIcon, SearchIcon, VerifiedIcon } from "@/components/icons";
import { DashboardSkeleton, Field, OrgAvatar, PageHeader, Panel, StatTile, stagger } from "@/components/kit";
import { FilterSelect } from "@/components/admin/filter-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Admin · Users: everyone on CareerBridge. Search and filter, then open someone to edit their details, change their
 * role, deactivate or reactivate them, or give them a new password. Same database as Django's /admin/ panel.
 */

const ROLES = { any: "All roles", student: "Students", company: "Recruiters", university: "Universities", admin: "Admins" };
const STATUS = { any: "Any status", yes: "Active", no: "Deactivated" };
const ROLE_TONE: Record<Role, "default" | "violet" | "success" | "warning"> = { student: "default", company: "violet", university: "success", admin: "warning" };

function RoleBadge({ role }: { role: Role }) {
  return <Badge variant={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Badge>;
}

export default function AdminUsersPage() {
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getAdminUsers>> | null>(null);
  const [filters, setFilters] = React.useState({ q: "", role: "any", active: "any" });
  const [openId, setOpenId] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    try {
      setData(await getAdminUsers({ q: filters.q, role: filters.role === "any" ? "" : filters.role, active: filters.active === "any" ? "" : filters.active }));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }, [filters]);

  React.useEffect(() => {
    const t = setTimeout(load, filters.q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, filters.q]);

  if (!data) return <DashboardSkeleton />;
  const set = (k: keyof typeof filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-8">
      <PageHeader title="Users" subtitle="Everyone on CareerBridge. Open someone to edit them, change their role or reset their password." />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile index={1} tone="blue" icon={<GraduateIcon />} title="Students" value={data.roles.student} caption="Looking for internships" />
        <StatTile index={2} tone="violet" icon={<BuildingsIcon />} title="Recruiters" value={data.roles.company} caption="Hiring for companies" />
        <StatTile index={3} tone="mint" icon={<PeopleIcon />} title="Universities" value={data.roles.university} caption="Placement-cell staff" />
        <StatTile index={4} tone="amber" icon={<ProfileIcon />} title="Deactivated" value={data.inactive} caption={`${data.roles.admin} admin${data.roles.admin === 1 ? "" : "s"}`} />
      </div>

      <Panel title={`People · ${data.count}`} style={stagger(5)} contentClassName="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem_12rem]">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filters.q} onChange={(e) => set("q", e.target.value)} placeholder="Search by name, username or email" className="pl-10" />
          </div>
          <FilterSelect value={filters.role} items={ROLES} onChange={(v) => set("role", v)} />
          <FilterSelect value={filters.active} items={STATUS} onChange={(v) => set("active", v)} />
        </div>

        {data.results.length === 0 ? (
          <p className="py-12 text-center text-[15px] text-muted-foreground">Nobody matches those filters.</p>
        ) : (
          <Table containerClassName="max-h-[min(44rem,70svh)]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Person</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Company / university</TableHead>
                <TableHead className="hidden lg:table-cell">Joined</TableHead>
                <TableHead className="hidden lg:table-cell">Last sign-in</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.results.map((u) => (
                <UserRow key={u.id} u={u} onOpen={() => setOpenId(u.id)} />
              ))}
            </TableBody>
          </Table>
        )}
        {data.count > data.results.length && <p className="text-[13.5px] text-muted-foreground">Showing the newest {data.results.length} of {data.count}. Search to find someone older.</p>}
      </Panel>

      <UserSheet id={openId} onClose={() => setOpenId(null)} onChanged={load} />
    </div>
  );
}

function UserRow({ u, onOpen }: { u: AdminUser; onOpen: () => void }) {
  return (
    <TableRow className={cn("cursor-pointer border-border/60", !u.is_active && "opacity-60")} onClick={onOpen}>
      <TableCell className="py-3.5">
        <div className="flex items-center gap-3">
          <OrgAvatar name={u.name} />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-medium">{u.name}</p>
            <p className="truncate text-[13.5px] text-muted-foreground">{u.email || `@${u.username}`}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <RoleBadge role={u.role} />
      </TableCell>
      <TableCell className="hidden max-w-[16rem] truncate text-muted-foreground md:table-cell">{u.org || "—"}</TableCell>
      <TableCell className="hidden text-muted-foreground lg:table-cell">{fmtDay(u.date_joined)}</TableCell>
      <TableCell className="hidden text-muted-foreground lg:table-cell">{fmtDay(u.last_login)}</TableCell>
      <TableCell>{u.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Deactivated</Badge>}</TableCell>
    </TableRow>
  );
}

function UserSheet({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const [loaded, setLoaded] = React.useState<AdminUserDetail | null>(null);
  const u = loaded && loaded.id === id ? loaded : null;
  const [form, setForm] = React.useState({ first_name: "", last_name: "", email: "", phone: "", role: "student" as Role });
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [confirmOff, setConfirmOff] = React.useState(false);

  const fill = (d: AdminUserDetail) => {
    setLoaded(d);
    setForm({ first_name: d.first_name, last_name: d.last_name, email: d.email, phone: d.phone, role: d.role });
    setConfirmOff(false);
    setPassword("");
  };

  React.useEffect(() => {
    if (id === null) return;
    getAdminUser(id).then(fill).catch((err) => toast.error(errorMessage(err)));
  }, [id]);

  const run = async (what: string, fn: () => Promise<AdminUserDetail | void>, done: string) => {
    setBusy(what);
    try {
      const d = await fn();
      if (d) fill(d);
      toast.success(done);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const dirty = u && (form.first_name !== u.first_name || form.last_name !== u.last_name || form.email !== u.email || form.phone !== u.phone || form.role !== u.role);
  const locked = !!u && u.is_superuser && !u.is_you;

  return (
    <Sheet open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
        {!u ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 p-6">
            <SheetHeader className="p-0">
              <div className="flex items-center gap-4">
                <OrgAvatar name={u.name} className="size-14" />
                <div className="min-w-0">
                  <SheetTitle className="truncate text-2xl font-medium">{u.name}</SheetTitle>
                  <p className="truncate text-[15px] text-muted-foreground">
                    @{u.username} · joined {fmtDay(u.date_joined)}
                  </p>
                </div>
              </div>
            </SheetHeader>

            <div className="flex flex-wrap items-center gap-2">
              <RoleBadge role={u.role} />
              {u.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Deactivated</Badge>}
              {u.is_superuser && (
                <Badge variant="warning">
                  <VerifiedIcon className="size-3.5" /> Superuser
                </Badge>
              )}
              {u.is_you && <Badge>You</Badge>}
              {!u.profile_completed && <Badge variant="warning">Profile not finished</Badge>}
            </div>

            {(u.student || u.memberships.length > 0 || u.university_staff) && (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl bg-secondary p-4 text-[15px]">
                {u.student && (
                  <>
                    <dt className="text-muted-foreground">University</dt>
                    <dd>{u.student.university || "—"}</dd>
                    <dt className="text-muted-foreground">Studies</dt>
                    <dd>{[u.student.degree, u.student.branch, u.student.graduation_year].filter(Boolean).join(" · ") || "—"}</dd>
                    <dt className="text-muted-foreground">Applications</dt>
                    <dd>
                      {u.student.applications} · {u.student.selected} hired
                    </dd>
                  </>
                )}
                {u.memberships.map((m) => (
                  <React.Fragment key={m.company_id}>
                    <dt className="text-muted-foreground">Company</dt>
                    <dd>
                      {m.company} <span className="text-muted-foreground capitalize">· {m.role}{m.is_active ? "" : " (removed)"}</span>
                    </dd>
                  </React.Fragment>
                ))}
                {u.university_staff && (
                  <>
                    <dt className="text-muted-foreground">Placement cell</dt>
                    <dd>{u.university_staff}</dd>
                  </>
                )}
              </dl>
            )}

            {locked && <p className="rounded-2xl bg-secondary p-4 text-[15px] text-muted-foreground">This is a superuser. Only another superuser can change it.</p>}

            <section className="space-y-4 rounded-[24px] border border-(--hairline) p-5">
              <h3 className="text-lg font-medium">Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="First name">
                  <Input value={form.first_name} disabled={locked} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </Field>
                <Field label="Last name">
                  <Input value={form.last_name} disabled={locked} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </Field>
              </div>
              <Field label="Email">
                <Input type="email" value={form.email} disabled={locked} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Phone">
                  <Input value={form.phone} disabled={locked} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </Field>
                <Field label="Role" hint={u.is_you ? "You can't remove your own admin role." : undefined}>
                  <Select value={form.role} items={ROLE_LABEL} disabled={locked || u.is_you} onValueChange={(v) => v && setForm({ ...form, role: v as Role })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Button disabled={!dirty || locked || busy !== null} onClick={() => run("save", () => updateAdminUser(u.id, form), "Saved")}>
                {busy === "save" && <Loader2 className="animate-spin" />} Save changes
              </Button>
            </section>

            <section className="space-y-4 rounded-[24px] border border-(--hairline) p-5">
              <h3 className="text-lg font-medium">New password</h3>
              <Field label="Password" hint="At least 8 characters, not too common. Tell them; they can change it after signing in.">
                <Input type="text" autoComplete="off" value={password} disabled={locked} onChange={(e) => setPassword(e.target.value)} placeholder="e.g. Welcome@2026" />
              </Field>
              <Button variant="outline" disabled={password.length < 8 || locked || busy !== null} onClick={() => run("password", () => setAdminUserPassword(u.id, password).then(() => setPassword("")), `New password set for ${u.name}`)}>
                {busy === "password" && <Loader2 className="animate-spin" />} Set password
              </Button>
            </section>

            {!u.is_you && !locked && (
              <section className="space-y-3 rounded-[24px] border border-(--hairline) p-5">
                <h3 className="text-lg font-medium">{u.is_active ? "Deactivate account" : "Reactivate account"}</h3>
                <p className="text-[15px] text-muted-foreground">
                  {u.is_active
                    ? "They won't be able to sign in. Nothing is deleted: their profile, applications and history stay, and you can reactivate them any time."
                    : "They'll be able to sign in again, with everything as they left it."}
                </p>
                {u.is_active ? (
                  confirmOff ? (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="destructive" disabled={busy !== null} onClick={() => run("active", () => updateAdminUser(u.id, { is_active: false }), `${u.name} is deactivated`)}>
                        {busy === "active" && <Loader2 className="animate-spin" />} Yes, deactivate
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmOff(false)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" onClick={() => setConfirmOff(true)}>
                      Deactivate
                    </Button>
                  )
                ) : (
                  <Button disabled={busy !== null} onClick={() => run("active", () => updateAdminUser(u.id, { is_active: true }), `${u.name} can sign in again`)}>
                    {busy === "active" && <Loader2 className="animate-spin" />} Reactivate
                  </Button>
                )}
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
