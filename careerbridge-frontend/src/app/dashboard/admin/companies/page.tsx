"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api";
import { fmtDay, getAdminCompanies, getAdminCompany, updateAdminCompany, type AdminCompany, type AdminCompanyDetail } from "@/lib/admin";
import { ArrowRightUpIcon, BuildingsIcon, InternshipsIcon, SearchIcon, VerifiedIcon } from "@/components/icons";
import { FilterSelect } from "@/components/admin/filter-select";
import { DashboardSkeleton, Field, OrgAvatar, PageHeader, Panel, StatTile, StatusBadge, stagger } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

/**
 * Admin · Companies: every company on CareerBridge, unverified first. Open one to verify it (its team is told, and
 * students see the badge), edit its details, and see its team and openings. Same database as Django's /admin/ panel.
 */

const VERIFIED = { any: "All companies", no: "Not verified", yes: "Verified" };

export default function AdminCompaniesPage() {
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getAdminCompanies>> | null>(null);
  const [filters, setFilters] = React.useState({ q: "", verified: "any" });
  const [openId, setOpenId] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    try {
      setData(await getAdminCompanies({ q: filters.q, verified: filters.verified === "any" ? "" : filters.verified }));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }, [filters]);

  React.useEffect(() => {
    const t = setTimeout(load, filters.q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, filters.q]);

  if (!data) return <DashboardSkeleton />;
  const live = data.results.reduce((n, c) => n + c.live, 0);

  return (
    <div className="space-y-8">
      <PageHeader title="Companies" subtitle="Verify companies so students can trust them, and keep their details right." />

      <div className="grid gap-5 sm:grid-cols-3">
        <StatTile index={1} tone="amber" icon={<BuildingsIcon />} title="Waiting to verify" value={data.unverified} caption={data.unverified ? "Check and verify them" : "All caught up"} />
        <StatTile index={2} tone="mint" icon={<VerifiedIcon />} title="Verified" value={data.verified} caption="Shown with the badge" />
        <StatTile index={3} tone="violet" icon={<InternshipsIcon />} title="Live openings" value={live} caption="Across these companies" />
      </div>

      <Panel title={`Companies · ${data.count}`} style={stagger(4)} contentClassName="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Search by name, industry or city" className="pl-10" />
          </div>
          <FilterSelect value={filters.verified} items={VERIFIED} onChange={(v) => setFilters((f) => ({ ...f, verified: v }))} />
        </div>

        {data.results.length === 0 ? (
          <p className="py-12 text-center text-[15px] text-muted-foreground">No companies match those filters.</p>
        ) : (
          <Table containerClassName="max-h-[min(44rem,70svh)]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Company</TableHead>
                <TableHead className="hidden md:table-cell">Industry · city</TableHead>
                <TableHead className="hidden sm:table-cell">Team</TableHead>
                <TableHead className="hidden lg:table-cell">Openings</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.results.map((c) => (
                <CompanyRow key={c.id} c={c} onOpen={() => setOpenId(c.id)} />
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <CompanySheet id={openId} onClose={() => setOpenId(null)} onChanged={load} />
    </div>
  );
}

function Logo({ c, className = "" }: { c: Pick<AdminCompany, "name" | "logo">; className?: string }) {
  if (c.logo) {
    // eslint-disable-next-line @next/next/no-img-element -- uploaded logos, any host
    return <img src={c.logo} alt="" className={`size-10 shrink-0 rounded-2xl bg-white object-contain p-1 ring-1 ring-black/5 ${className}`} />;
  }
  return <OrgAvatar name={c.name} className={className} />;
}

function VerifiedBadge({ on }: { on: boolean }) {
  return on ? (
    <Badge variant="success">
      <VerifiedIcon className="size-3.5" /> Verified
    </Badge>
  ) : (
    <Badge variant="warning">Not verified</Badge>
  );
}

function CompanyRow({ c, onOpen }: { c: AdminCompany; onOpen: () => void }) {
  return (
    <TableRow className="cursor-pointer border-border/60" onClick={onOpen}>
      <TableCell className="py-3.5">
        <div className="flex items-center gap-3">
          <Logo c={c} />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-medium">{c.name}</p>
            <p className="truncate text-[13.5px] text-muted-foreground">Joined {fmtDay(c.created_at)}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">{[c.industry, c.location].filter(Boolean).join(" · ") || "—"}</TableCell>
      <TableCell className="hidden tabular-nums sm:table-cell">{c.members}</TableCell>
      <TableCell className="hidden text-muted-foreground lg:table-cell">
        {c.live} live · {c.internships} total
      </TableCell>
      <TableCell>
        <VerifiedBadge on={c.is_verified} />
      </TableCell>
    </TableRow>
  );
}

const EDIT = ["name", "industry", "location", "website", "linkedin_url", "size", "founded_year", "description", "culture"] as const;
type Form = Record<(typeof EDIT)[number], string>;
const toForm = (d: AdminCompanyDetail): Form => ({
  name: d.name,
  industry: d.industry,
  location: d.location,
  website: d.website,
  linkedin_url: d.linkedin_url,
  size: d.size,
  founded_year: d.founded_year ? String(d.founded_year) : "",
  description: d.description,
  culture: d.culture,
});

function CompanySheet({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const [loaded, setLoaded] = React.useState<AdminCompanyDetail | null>(null);
  const c = loaded && loaded.id === id ? loaded : null;
  const [form, setForm] = React.useState<Form | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const fill = (d: AdminCompanyDetail) => {
    setLoaded(d);
    setForm(toForm(d));
  };

  React.useEffect(() => {
    if (id === null) return;
    getAdminCompany(id).then(fill).catch((err) => toast.error(errorMessage(err)));
  }, [id]);

  const save = async (what: string, body: Record<string, unknown>, done: string) => {
    if (!c) return;
    setBusy(what);
    try {
      fill(await updateAdminCompany(c.id, body));
      toast.success(done);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const dirty = !!c && !!form && EDIT.some((k) => form[k] !== toForm(c)[k]);
  const field = (k: keyof Form) => ({ value: form?.[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f)) });

  return (
    <Sheet open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
        {!c || !form ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 p-6">
            <SheetHeader className="p-0">
              <div className="flex items-center gap-4">
                <Logo c={c} className="size-14" />
                <div className="min-w-0">
                  <SheetTitle className="truncate text-2xl font-medium">{c.name}</SheetTitle>
                  <p className="truncate text-[15px] text-muted-foreground">
                    {[c.industry, c.location].filter(Boolean).join(" · ") || "No details yet"} · joined {fmtDay(c.created_at)}
                  </p>
                </div>
              </div>
            </SheetHeader>

            <section className="flex flex-wrap items-center gap-3 rounded-[24px] border border-(--hairline) p-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-medium">Verification</h3>
                  <VerifiedBadge on={c.is_verified} />
                </div>
                <p className="mt-1 text-[14.5px] text-muted-foreground">
                  {c.is_verified ? "Students see the verified badge on this company and its openings." : "Check it's a real company, then verify it. Its team is told straight away."}
                </p>
              </div>
              {c.is_verified ? (
                <Button variant="outline" disabled={busy !== null} onClick={() => save("verify", { is_verified: false }, `${c.name} is no longer verified`)}>
                  {busy === "verify" && <Loader2 className="animate-spin" />} Remove badge
                </Button>
              ) : (
                <Button disabled={busy !== null} onClick={() => save("verify", { is_verified: true }, `${c.name} is verified`)}>
                  {busy === "verify" ? <Loader2 className="animate-spin" /> : <VerifiedIcon />} Verify
                </Button>
              )}
            </section>

            <section className="space-y-4 rounded-[24px] border border-(--hairline) p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-medium">Details</h3>
                <Link href={`/companies/${c.id}`} target="_blank" className="inline-flex items-center gap-1 text-[14px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                  Public page <ArrowRightUpIcon className="size-3.5" />
                </Link>
              </div>
              <Field label="Name">
                <Input {...field("name")} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Industry">
                  <Input {...field("industry")} />
                </Field>
                <Field label="City">
                  <Input {...field("location")} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Size">
                  <Select value={form.size || "none"} items={{ none: "Not set", ...c.sizes }} onValueChange={(v) => v && setForm({ ...form, size: v === "none" ? "" : String(v) })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries({ none: "Not set", ...c.sizes }).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Founded">
                  <Input type="number" placeholder="e.g. 2015" {...field("founded_year")} />
                </Field>
              </div>
              <Field label="Website">
                <Input type="url" placeholder="https://" {...field("website")} />
              </Field>
              <Field label="LinkedIn">
                <Input type="url" placeholder="https://linkedin.com/company/…" {...field("linkedin_url")} />
              </Field>
              <Field label="About">
                <Textarea rows={3} {...field("description")} />
              </Field>
              <Field label="What it's like to work here">
                <Textarea rows={2} {...field("culture")} />
              </Field>
              <div className="flex gap-2">
                <Button disabled={!dirty || busy !== null} onClick={() => save("details", form, "Saved")}>
                  {busy === "details" && <Loader2 className="animate-spin" />} Save changes
                </Button>
                {dirty && (
                  <Button variant="ghost" onClick={() => setForm(toForm(c))}>
                    Undo
                  </Button>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-medium">Team · {c.team.length}</h3>
              {c.team.length === 0 && <p className="text-[15px] text-muted-foreground">No one has joined yet.</p>}
              {c.team.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
                  <OrgAvatar name={m.name} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{m.name}</p>
                    <p className="truncate text-[13.5px] text-muted-foreground">{m.email}</p>
                  </div>
                  <Badge variant={m.role === "admin" ? "violet" : "default"} className="capitalize">
                    {m.role}
                  </Badge>
                  {!m.is_active && <Badge variant="danger">Removed</Badge>}
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-medium">Openings · {c.openings.length}</h3>
              {c.openings.length === 0 && <p className="text-[15px] text-muted-foreground">No openings posted yet.</p>}
              {c.openings.map((o) => (
                <Link key={o.id} href={`/internships/${o.id}`} target="_blank" className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3 transition-colors hover:bg-secondary">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{o.title}</p>
                    <p className="truncate text-[13.5px] text-muted-foreground">
                      {o.applicants} applicant{o.applicants === 1 ? "" : "s"} · posted {fmtDay(o.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                </Link>
              ))}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
