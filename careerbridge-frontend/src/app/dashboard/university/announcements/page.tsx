"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api";
import { deleteAnnouncement, getAnnouncements, saveAnnouncement, timeAgo, type Announcement } from "@/lib/ats";
import { useUniversity } from "@/components/org-gate";
import { PenIcon, TrashIcon } from "@/components/icons";
import { DashboardSkeleton, Field, PageHeader, Panel, stagger } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function AnnouncementsPage() {
  const { data } = useUniversity();
  const [items, setItems] = React.useState<Announcement[] | null>(null);
  const [form, setForm] = React.useState<{ id?: number; title: string; body: string; pinned: boolean }>({ title: "", body: "", pinned: false });
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(() => {
    getAnnouncements()
      .then(setItems)
      .catch((err) => {
        toast.error(errorMessage(err));
        setItems([]);
      });
  }, []);
  React.useEffect(load, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveAnnouncement({ title: form.title, body: form.body, pinned: form.pinned }, form.id);
      toast.success(form.id ? "Announcement updated" : `Posted to ${data.student_count} students`);
      setForm({ title: "", body: "", pinned: false });
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (items === null) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      <PageHeader title="Announcements" subtitle="Post updates to every student at your university — they see them on their Campus page and under the bell." />
      <div className="grid items-start gap-5 lg:grid-cols-12">
        <form onSubmit={save} className="lg:col-span-5">
          <Panel title={form.id ? "Edit announcement" : "New announcement"} style={stagger(1)} contentClassName="space-y-4">
            <Field label="Title">
              <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Resume workshop this Friday" />
            </Field>
            <Field label="Message">
              <Textarea required rows={7} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Where, when, what to bring…" />
            </Field>
            <label className="flex items-center gap-2 text-[15px]">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} className="size-4 accent-foreground" />
              Pin to the top
            </label>
            <div className="flex justify-end gap-2">
              {form.id && (
                <Button type="button" variant="ghost" onClick={() => setForm({ title: "", body: "", pinned: false })}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />} {form.id ? "Save" : "Post"}
              </Button>
            </div>
          </Panel>
        </form>
        <Panel className="lg:col-span-7" title={`Posted · ${items.length}`} style={stagger(2)} contentClassName="-mr-2 max-h-[min(48rem,75svh)] space-y-3 overflow-y-auto overscroll-contain pr-2 [scrollbar-width:thin]">
          {items.length === 0 && <p className="py-8 text-center text-[15px] text-muted-foreground">Nothing posted yet.</p>}
          {items.map((a) => (
            <article key={a.id} className="rounded-[22px] border border-(--hairline) p-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium">{a.title}</h3>
                    {a.pinned && <Badge variant="lime">Pinned</Badge>}
                  </div>
                  <p className="text-[13.5px] text-muted-foreground">
                    {a.author_name} · {timeAgo(a.created_at)}
                  </p>
                </div>
                <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => setForm({ id: a.id, title: a.title, body: a.body, pinned: a.pinned })}>
                  <PenIcon />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Delete"
                  onClick={async () => {
                    await deleteAnnouncement(a.id).catch((e) => toast.error(errorMessage(e)));
                    load();
                  }}
                >
                  <TrashIcon />
                </Button>
              </div>
              <p className="mt-3 text-[15px] whitespace-pre-wrap">{a.body}</p>
            </article>
          ))}
        </Panel>
      </div>
    </div>
  );
}
