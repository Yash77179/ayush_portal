"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api";
import { mediaUrl } from "@/lib/format";
import { approveStaff, removeStaff, updateStaff, updateUniversity } from "@/lib/ats";
import { useUniversity } from "@/components/org-gate";
import { CameraIcon, TrashIcon } from "@/components/icons";
import { Field, OrgAvatar, PageHeader, Panel, stagger } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function UniversitySettingsPage() {
  const { data, refresh } = useUniversity();
  const u = data.university;
  const [form, setForm] = React.useState({
    location: u.location,
    website: u.website,
    established_year: u.established_year ? String(u.established_year) : "",
    title: data.title,
  });
  const [saving, setSaving] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUniversity({ ...form, established_year: form.established_year ? Number(form.established_year) : null });
      await refresh();
      toast.success("Saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" subtitle={`${u.name} · ${data.is_admin ? "Placement cell admin" : "Placement cell member"}`} />
      <div className="grid items-start gap-5 lg:grid-cols-12">
        <form onSubmit={save} className="lg:col-span-7">
          <Panel title="University" style={stagger(1)} contentClassName="space-y-5">
            <div className="flex items-center gap-4">
              {u.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(u.logo) ?? ""} alt="" className="size-20 rounded-[22px] object-cover" />
              ) : (
                <OrgAvatar name={u.name} className="size-20 rounded-[22px] text-2xl" />
              )}
              {data.is_admin && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const fd = new FormData();
                      fd.append("logo", f);
                      act(() => updateUniversity(fd));
                    }}
                  />
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                    <CameraIcon /> Logo
                  </Button>
                </>
              )}
            </div>
            <fieldset disabled={!data.is_admin} className="grid gap-5 sm:grid-cols-2 disabled:opacity-80">
              <Field label="Location">
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </Field>
              <Field label="Website">
                <Input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" />
              </Field>
              <Field label="Established">
                <Input type="number" value={form.established_year} onChange={(e) => setForm({ ...form, established_year: e.target.value })} />
              </Field>
              <Field label="Your title">
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
            </fieldset>
            {data.is_admin ? (
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="animate-spin" />} Save
                </Button>
              </div>
            ) : (
              <p className="text-[15px] text-muted-foreground">Only the placement cell admin can edit these details.</p>
            )}
          </Panel>
        </form>
        <div className="space-y-5 lg:col-span-5">
        {data.is_admin && data.requests.length > 0 && (
          <Panel title={`Asking to join · ${data.requests.length}`} style={stagger(2)} contentClassName="space-y-2">
            {data.requests.map((r) => (
              <div key={r.id} className="flex items-start gap-3 rounded-[18px] p-2.5 hover:bg-secondary/60">
                <OrgAvatar name={r.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] font-medium">{r.name}</p>
                  <p className="truncate text-[14.5px] text-muted-foreground">{[r.title, r.email].filter(Boolean).join(" · ")}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button size="sm" onClick={() => act(() => approveStaff(r.id))}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => act(() => removeStaff(r.id))}>
                      Decline
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <p className="pt-1 text-[14.5px] text-muted-foreground">They can&rsquo;t see anything of your placement cell until you approve them.</p>
          </Panel>
        )}
        <Panel title="Placement cell" style={stagger(3)} contentClassName="space-y-2">
          {data.staff.map((s) => (
            <div key={s.id} className="flex items-start gap-3 rounded-[18px] p-2.5 hover:bg-secondary/60">
              <OrgAvatar name={s.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-medium">
                  {s.name} {s.is_you && <span className="text-muted-foreground">(you)</span>}
                </p>
                <p className="truncate text-[14.5px] text-muted-foreground">
                  {s.title || s.email}
                  {s.is_admin && s.made_admin_by && ` · made admin by ${s.made_admin_by}`}
                </p>
                {/* their place in the chain, and what you may do about it */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {s.is_admin && <Badge variant="lime">{s.admin_rank === 0 ? "Head admin" : `Admin · level ${(s.admin_rank ?? 0) + 1}`}</Badge>}
                  {s.can_manage && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => act(() => updateStaff(s.id, !s.is_admin))}>
                        {s.is_admin ? "Remove admin" : "Make admin"}
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Remove ${s.name}`} onClick={() => act(() => removeStaff(s.id))}>
                        <TrashIcon />
                      </Button>
                    </>
                  )}
                  {s.is_you && s.is_admin && data.staff.filter((x) => x.is_admin).length > 1 && (
                    <Button size="sm" variant="outline" onClick={() => act(() => updateStaff(s.id, false))}>
                      Step down
                    </Button>
                  )}
                  {data.is_admin && !s.is_you && !s.can_manage && <span className="text-[13px] text-muted-foreground">Above you, so you can&rsquo;t change them</span>}
                </div>
              </div>
            </div>
          ))}
          <p className="pt-2 text-[14.5px] text-muted-foreground">Colleagues join by signing up as a University representative and linking {u.name}.</p>
          {data.is_admin && (
            <p className="text-[14.5px] text-muted-foreground">
              Anyone you make admin sits one level below you. You can change or remove admins at your level or below, but never anyone above you, so never the person who made you admin.
            </p>
          )}
        </Panel>
        </div>
      </div>
    </div>
  );
}
