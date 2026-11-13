"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { errorMessage } from "@/lib/api";
import { mediaUrl } from "@/lib/format";
import { removeStaff, updateStaff, updateUniversity } from "@/lib/ats";
import { useUniversity } from "@/components/org-gate";
import { CameraIcon, TrashIcon } from "@/components/icons";
import { Field, OrgAvatar, PageHeader, Panel, stagger } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function UniversitySettingsPage() {
  const { user } = useAuth();
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
        <Panel className="lg:col-span-5" title="Placement cell" style={stagger(2)} contentClassName="space-y-2">
          {data.staff.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-[18px] p-2.5 hover:bg-secondary/60">
              <OrgAvatar name={s.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-medium">
                  {s.name} {s.email === user?.email && <span className="text-muted-foreground">(you)</span>}
                </p>
                <p className="truncate text-[14.5px] text-muted-foreground">{s.title || s.email}</p>
              </div>
              {s.is_admin && <Badge variant="lime">Admin</Badge>}
              {data.is_admin && s.email !== user?.email && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => act(() => updateStaff(s.id, !s.is_admin))}>
                    {s.is_admin ? "Remove admin" : "Make admin"}
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${s.name}`} onClick={() => act(() => removeStaff(s.id))}>
                    <TrashIcon />
                  </Button>
                </>
              )}
            </div>
          ))}
          <p className="pt-2 text-[14.5px] text-muted-foreground">Colleagues join by signing up as a University representative and linking {u.name}.</p>
        </Panel>
      </div>
    </div>
  );
}
