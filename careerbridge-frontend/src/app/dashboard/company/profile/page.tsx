"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { errorMessage } from "@/lib/api";
import { mediaUrl } from "@/lib/format";
import {
  addTeamMember,
  deleteTemplate,
  getTeam,
  getTemplates,
  removeTeamMember,
  saveTemplate,
  updateCompany,
  updateTeamMember,
  type Company,
  type EmailTemplate,
  type TeamMember,
} from "@/lib/ats";
import { useCompany } from "@/components/org-gate";
import { PLACEHOLDERS } from "@/components/ats/ats-ui";
import { ArrowRightUpIcon, CameraIcon, TrashIcon } from "@/components/icons";
import { Field, OrgAvatar, PageHeader, Panel, stagger } from "@/components/kit";
import { VerifiedBadge } from "@/components/verified-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const ROLES = { admin: "Company admin", recruiter: "Recruiter", interviewer: "Interviewer" };
const ROLE_HELP: Record<string, string> = {
  admin: "Edits this page and the team, plus everything a recruiter does.",
  recruiter: "Posts internships, moves candidates, schedules interviews and sends offers.",
  interviewer: "Sees candidates, leaves notes, ratings and interview scorecards.",
};
const SIZES = { startup: "Startup (1–50)", small: "Small (51–200)", medium: "Medium (201–1000)", large: "Large (1000+)" };

export default function CompanyProfilePage() {
  const { membership, isAdmin } = useCompany();
  const [tab, setTab] = React.useState("details");
  const c = membership.company;

  return (
    <div className="space-y-8">
      <PageHeader
        title={c.name}
        badge={c.is_verified ? <VerifiedBadge /> : undefined}
        subtitle={`Your role: ${ROLES[membership.role]} · ${membership.member_count} on the team`}
        actions={
          <Button variant="outline" size="lg" render={<Link href={`/companies/${c.id}`} target="_blank" />} nativeButton={false}>
            Public page <ArrowRightUpIcon />
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="templates">Email templates</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "details" && <Details company={c} editable={isAdmin} />}
      {tab === "team" && <Team isAdmin={isAdmin} />}
      {tab === "templates" && <Templates />}
    </div>
  );
}

function Details({ company, editable }: { company: Company; editable: boolean }) {
  const { refresh } = useCompany();
  const [form, setForm] = React.useState({
    name: company.name,
    industry: company.industry,
    size: company.size,
    location: company.location,
    website: company.website,
    linkedin_url: company.linkedin_url,
    founded_year: company.founded_year ? String(company.founded_year) : "",
    description: company.description,
    culture: company.culture,
  });
  const [saving, setSaving] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateCompany({ ...form, founded_year: form.founded_year ? Number(form.founded_year) : null } as Partial<Company>);
      await refresh();
      toast.success("Company page updated");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    const fd = new FormData();
    fd.append("logo", file);
    try {
      await updateCompany(fd);
      await refresh();
      toast.success("Logo updated");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <form onSubmit={save} className="grid items-start gap-5 lg:grid-cols-12">
      <Panel className="lg:col-span-4" title="Logo" style={stagger(1)} contentClassName="flex flex-col items-center gap-4 text-center">
        {company.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(company.logo) ?? ""} alt="" className="size-32 rounded-[28px] object-cover" />
        ) : (
          <OrgAvatar name={company.name} className="size-32 rounded-[28px] text-4xl" />
        )}
        {editable && (
          <>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              <CameraIcon /> Upload logo
            </Button>
          </>
        )}
        <p className="text-[14.5px] text-muted-foreground">
          {company.is_verified ? "Verified by CareerBridge — students see a badge." : "Not verified yet. CareerBridge admins verify companies after a quick check."}
        </p>
      </Panel>
      <Panel className="lg:col-span-8" title="About the company" style={stagger(2)} contentClassName="space-y-5">
        <fieldset disabled={!editable} className="space-y-5 disabled:opacity-80">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Industry">
              <Input value={form.industry} onChange={(e) => set("industry", e.target.value)} />
            </Field>
            <Field label="Size">
              <Select value={form.size} items={SIZES} onValueChange={(v) => set("size", String(v ?? ""))} disabled={!editable}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a size" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SIZES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Headquarters">
              <Input value={form.location} onChange={(e) => set("location", e.target.value)} />
            </Field>
            <Field label="Website">
              <Input type="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
            </Field>
            <Field label="LinkedIn">
              <Input type="url" value={form.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} placeholder="https://linkedin.com/company/…" />
            </Field>
            <Field label="Founded">
              <Input type="number" min={1800} max={2100} value={form.founded_year} onChange={(e) => set("founded_year", e.target.value)} />
            </Field>
          </div>
          <Field label="About">
            <Textarea rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="Culture" hint="What it's like to intern here — mentorship, team rituals, perks.">
            <Textarea rows={5} value={form.culture} onChange={(e) => set("culture", e.target.value)} />
          </Field>
        </fieldset>
        {editable ? (
          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Save changes
            </Button>
          </div>
        ) : (
          <p className="text-[15px] text-muted-foreground">Only company admins can edit this page.</p>
        )}
      </Panel>
    </form>
  );
}

function Team({ isAdmin }: { isAdmin: boolean }) {
  const { user } = useAuth();
  const { refresh } = useCompany();
  const [team, setTeam] = React.useState<TeamMember[] | null>(null);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("recruiter");
  const [adding, setAdding] = React.useState(false);

  const load = React.useCallback(() => {
    getTeam()
      .then((t) => setTeam(t.results))
      .catch((err) => toast.error(errorMessage(err)));
  }, []);
  React.useEffect(load, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const m = await addTeamMember(email.trim(), role);
      toast.success(`${m.name} added — they've been notified`);
      setEmail("");
      load();
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const change = async (m: TeamMember, data: { role?: string; is_active?: boolean }) => {
    try {
      await updateTeamMember(m.id, data);
      load();
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-12">
      <Panel className="lg:col-span-8" title="People" style={stagger(1)} contentClassName="space-y-2">
        {!team && <Loader2 className="mx-auto my-8 size-5 animate-spin text-muted-foreground" />}
        {team?.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-[20px] p-2.5 hover:bg-secondary/60">
            <OrgAvatar name={m.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-medium">
                {m.name} {m.user_id === user?.id && <span className="text-muted-foreground">(you)</span>}
              </p>
              <p className="truncate text-[14.5px] text-muted-foreground">{m.email}</p>
            </div>
            {!m.is_active && <Badge variant="danger">Deactivated</Badge>}
            {isAdmin ? (
              <div className="flex items-center gap-1.5">
                <div className="w-40">
                  <Select value={m.role} items={ROLES} onValueChange={(v) => v && v !== m.role && change(m, { role: String(v) })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" variant="ghost" onClick={() => change(m, { is_active: !m.is_active })}>
                  {m.is_active ? "Deactivate" : "Reactivate"}
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${m.name}`}
                  onClick={async () => {
                    try {
                      await removeTeamMember(m.id);
                      load();
                      refresh();
                    } catch (err) {
                      toast.error(errorMessage(err));
                    }
                  }}
                >
                  <TrashIcon />
                </Button>
              </div>
            ) : (
              <Badge variant="info">{ROLES[m.role]}</Badge>
            )}
          </div>
        ))}
      </Panel>
      <Panel className="lg:col-span-4" title="Add teammate" style={stagger(2)}>
        {isAdmin ? (
          <form onSubmit={add} className="space-y-4">
            <Field label="Their sign-in email" hint="They need a CareerBridge account with the Company recruiter role.">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.com" />
            </Field>
            <Field label="Role">
              <Select value={role} items={ROLES} onValueChange={(v) => v && setRole(String(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <p className="text-[14.5px] text-muted-foreground">{ROLE_HELP[role]}</p>
            <Button type="submit" className="w-full" disabled={adding}>
              {adding && <Loader2 className="animate-spin" />} Add to team
            </Button>
          </form>
        ) : (
          <p className="text-[15px] text-muted-foreground">Ask a company admin to add colleagues.</p>
        )}
      </Panel>
    </div>
  );
}

function Templates() {
  const { canManage } = useCompany();
  const [items, setItems] = React.useState<EmailTemplate[] | null>(null);
  const [edit, setEdit] = React.useState<Partial<EmailTemplate> | null>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(() => {
    getTemplates()
      .then(setItems)
      .catch((err) => toast.error(errorMessage(err)));
  }, []);
  React.useEffect(load, [load]);

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      await saveTemplate({ name: edit.name ?? "", subject: edit.subject ?? "", body: edit.body ?? "" }, edit.id);
      toast.success("Template saved");
      setEdit(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const starters: Omit<EmailTemplate, "id">[] = [
    { name: "Assessment invite", subject: "Next step for {{internship}} at {{company}}", body: "Hi {{first_name}},\n\nThanks for applying to {{internship}}. We'd like you to take a short online assessment — the link follows in a separate email.\n\nBest,\n{{company}} hiring team" },
    { name: "Documents request", subject: "Documents for your {{company}} offer", body: "Hi {{first_name}},\n\nTo complete your onboarding for {{internship}}, please reply with your college ID and latest marksheet.\n\nThanks!" },
  ];

  return (
    <div className="grid items-start gap-5 lg:grid-cols-12">
      <Panel className="lg:col-span-5" title="Templates" style={stagger(1)} action={canManage ? <Button size="sm" variant="outline" onClick={() => setEdit({ name: "", subject: "", body: "" })}>New</Button> : undefined} contentClassName="space-y-2">
        {!items && <Loader2 className="mx-auto my-8 size-5 animate-spin text-muted-foreground" />}
        {items?.length === 0 && (
          <div className="space-y-3 py-2">
            <p className="text-[15px] text-muted-foreground">No templates yet. Start from one of these:</p>
            {canManage && starters.map((s) => (
              <Button key={s.name} variant="outline" className="w-full justify-start" onClick={() => setEdit(s)}>
                {s.name}
              </Button>
            ))}
          </div>
        )}
        {items?.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-[18px] p-2.5 hover:bg-secondary/60">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => canManage && setEdit(t)}>
              <p className="truncate text-[17px] font-medium">{t.name}</p>
              <p className="truncate text-[14.5px] text-muted-foreground">{t.subject}</p>
            </button>
            {canManage && (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Delete ${t.name}`}
                onClick={async () => {
                  await deleteTemplate(t.id).catch((e) => toast.error(errorMessage(e)));
                  load();
                }}
              >
                <TrashIcon />
              </Button>
            )}
          </div>
        ))}
        <p className="pt-2 text-[14.5px] text-muted-foreground">Use them from a candidate’s Email button or the bulk Email action. Stage changes already send their own kind, automatic messages.</p>
      </Panel>
      {edit && (
        <Panel className="lg:col-span-7" title={edit.id ? "Edit template" : "New template"} style={stagger(2)} contentClassName="space-y-4">
          <Field label="Name">
            <Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Assessment invite" />
          </Field>
          <Field label="Subject">
            <Input value={edit.subject ?? ""} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} />
          </Field>
          <Field label="Body" hint={`Placeholders: ${PLACEHOLDERS.join(" ")}`}>
            <Textarea rows={9} value={edit.body ?? ""} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !edit.name || !edit.subject || !edit.body}>
              {saving && <Loader2 className="animate-spin" />} Save template
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
