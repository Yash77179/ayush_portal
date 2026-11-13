"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";

import { errorMessage, getMyInternships } from "@/lib/api";
import { ALL_STAGES, STAGE_LABEL, bulkAction, exportApplicants, getApplicants, timeAgo, type ApplicantCard } from "@/lib/ats";
import { useCompany } from "@/components/org-gate";
import { EmailDialog, MatchPill, RejectDialog, StarRating, VerifiedChip } from "@/components/ats/ats-ui";
import { ClockIcon, DownloadIcon, PeopleIcon, SearchIcon, StarIcon, TrophyIcon } from "@/components/icons";
import { DashboardSkeleton, OrgAvatar, PageHeader, Panel, StatTile, StatusBadge, stagger } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Listing {
  id: number;
  title: string;
}

export default function CompanyApplicantsPage() {
  const { canManage } = useCompany();
  const [apps, setApps] = React.useState<ApplicantCard[]>([]);
  const [listings, setListings] = React.useState<Listing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState("all");
  const [internship, setInternship] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [tagFilter, setTagFilter] = React.useState("");
  const [sort, setSort] = React.useState("newest");
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [dialog, setDialog] = React.useState<"email" | "reject" | "tag" | null>(null);
  const [tagDraft, setTagDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(
    () =>
      getApplicants(internship === "all" ? undefined : { internship })
        .then(setApps)
        .catch((err) => toast.error(errorMessage(err)))
        .finally(() => setLoading(false)),
    [internship]
  );

  React.useEffect(() => {
    load();
  }, [load]);
  React.useEffect(() => {
    getMyInternships()
      .then((d) => setListings((Array.isArray(d) ? d : ((d as { results?: Listing[] }).results ?? [])) as Listing[]))
      .catch(() => setListings([]));
  }, []);

  if (loading) return <DashboardSkeleton />;

  const count = (t: string) => (t === "all" ? apps.length : apps.filter((a) => a.status === t).length);
  const allTags = [...new Set(apps.flatMap((a) => a.tags))].sort();
  const q = query.trim().toLowerCase();
  const visible = apps
    .filter((a) => tab === "all" || a.status === tab)
    .filter((a) => !tagFilter || a.tags.includes(tagFilter))
    .filter((a) => !q || [a.student.user_name, a.student.user_email, a.student.university?.name ?? "", a.internship.title].some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) =>
      sort === "match" ? b.match_score - a.match_score : sort === "rating" ? (b.avg_rating ?? 0) - (a.avg_rating ?? 0) : +new Date(b.applied_at) - +new Date(a.applied_at)
    );
  const allOn = visible.length > 0 && visible.every((a) => selected.has(a.id));
  const ids = [...selected].filter((id) => apps.some((a) => a.id === id));

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const runBulk = async (body: Parameters<typeof bulkAction>[0], done: string) => {
    setBusy(true);
    try {
      const r = await bulkAction(body);
      toast.success(`${done} ${r.updated} of ${r.total}`);
      setSelected(new Set());
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const listingItems = { all: "All internships", ...Object.fromEntries(listings.map((l) => [String(l.id), l.title])) };
  const sortItems = { newest: "Newest first", match: "Best match", rating: "Highest rated" };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Applicants"
        subtitle="Search, filter and act on many candidates at once."
        actions={
          <>
            <Button variant="outline" size="lg" onClick={() => exportApplicants(internship === "all" ? undefined : { internship }).catch((e) => toast.error(errorMessage(e)))}>
              <DownloadIcon /> Export CSV
            </Button>
            <Button size="lg" render={<Link href="/dashboard/company/pipeline" />} nativeButton={false}>
              Pipeline board
            </Button>
          </>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile index={1} tone="blue" icon={<PeopleIcon />} title="Total" value={apps.length} caption="All applications" />
        <StatTile index={2} tone="amber" icon={<ClockIcon />} title="New" value={count("applied")} caption="Waiting for screening" />
        <StatTile index={3} tone="violet" icon={<StarIcon />} title="In process" value={count("shortlisted") + count("interview") + count("offered")} caption="Shortlisted to offer" />
        <StatTile index={4} tone="mint" icon={<TrophyIcon />} title="Hired" value={count("selected")} caption="Accepted offers" />
      </div>

      <Panel title="All applicants" style={stagger(5)} contentClassName="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, email, college" className="pl-10" />
          </div>
          <div>
            <Select value={internship} items={listingItems} onValueChange={(v) => v && setInternship(String(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(listingItems).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={sort} items={sortItems} onValueChange={(v) => v && setSort(String(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(sortItems).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {allTags.length > 0 && (
            <div>
              <Select value={tagFilter || "any"} items={{ any: "Any tag", ...Object.fromEntries(allTags.map((t) => [t, t])) }} onValueChange={(v) => setTagFilter(v === "any" || !v ? "" : String(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any tag</SelectItem>
                  {allTags.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList className="max-w-full justify-start overflow-x-auto [scrollbar-width:none]">
            {["all", ...ALL_STAGES].map((v) => (
              <TabsTrigger key={v} value={v}>
                {v === "all" ? "All" : STAGE_LABEL[v]}
                <span className="opacity-60 tabular-nums">{count(v)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {canManage && ids.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-[20px] bg-secondary p-2.5 pl-4">
            <span className="mr-2 text-[15px] font-medium tabular-nums">{ids.length} selected</span>
            <Select
              value=""
              items={Object.fromEntries(ALL_STAGES.filter((s) => s !== "offered").map((s) => [s, STAGE_LABEL[s]]))}
              onValueChange={(v) => {
                if (!v) return;
                if (v === "rejected") setDialog("reject");
                else runBulk({ ids, action: "move", status: String(v) }, "Moved");
              }}
            >
              <SelectTrigger className="h-9 w-40 bg-card">
                <SelectValue placeholder="Move to…" />
              </SelectTrigger>
              <SelectContent>
                {ALL_STAGES.filter((s) => s !== "offered").map((s) => (
                  <SelectItem key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="bg-card" onClick={() => setDialog("tag")} disabled={busy}>
              Tag
            </Button>
            <Button size="sm" variant="outline" className="bg-card" onClick={() => setDialog("email")} disabled={busy}>
              Email
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            {busy && <Loader2 className="size-4 animate-spin" />}
          </div>
        )}

        {visible.length === 0 ? (
          <p className="py-12 text-center text-[15px] text-muted-foreground">{apps.length ? "Nobody matches these filters." : "No applicants yet. Share your listings to get started."}</p>
        ) : (
          <Table containerClassName="max-h-[min(42rem,70svh)]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {canManage && (
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Select all"
                      checked={allOn}
                      onCheckedChange={(on) => setSelected(on ? new Set(visible.map((a) => a.id)) : new Set())}
                    />
                  </TableHead>
                )}
                <TableHead>Candidate</TableHead>
                <TableHead className="hidden lg:table-cell">Role</TableHead>
                <TableHead className="hidden md:table-cell">Fit</TableHead>
                <TableHead>Stage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((a) => (
                <TableRow key={a.id} className={cn("border-border/60", selected.has(a.id) && "bg-secondary/60")}>
                  {canManage && (
                    <TableCell>
                      <Checkbox aria-label={`Select ${a.student.user_name}`} checked={selected.has(a.id)} onCheckedChange={() => toggle(a.id)} />
                    </TableCell>
                  )}
                  <TableCell className="py-3.5">
                    <Link href={`/dashboard/company/applicants/${a.id}`} className="flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <OrgAvatar name={a.student.user_name} />
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-[17px] font-medium">
                          {a.student.user_name}
                          {!a.viewed_at && <span title="Not opened yet" className="size-1.5 rounded-full bg-sky-500" />}
                        </p>
                        <p className="flex flex-wrap items-center gap-x-2 text-[14.5px] text-muted-foreground">
                          <span className="max-w-[16rem] truncate">{a.student.university?.name || a.student.user_email}</span>
                          <VerifiedChip status={a.student.verification_status} />
                        </p>
                        {a.tags.length > 0 && (
                          <p className="mt-1 flex flex-wrap gap-1">
                            {a.tags.slice(0, 3).map((t) => (
                              <span key={t} className="rounded-full bg-secondary px-1.5 py-px text-[12.5px]">
                                {t}
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <p className="text-muted-foreground">{a.internship.title}</p>
                    <p className="mt-0.5 text-[13.5px] text-muted-foreground/80">Applied {timeAgo(a.applied_at)}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-col items-start gap-1.5">
                      <MatchPill score={a.match_score} />
                      {a.avg_rating !== null && <StarRating value={a.avg_rating} size="sm" readOnly />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={a.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <EmailDialog
        open={dialog === "email"}
        onOpenChange={(o) => !o && setDialog(null)}
        recipients={`${ids.length} candidate${ids.length === 1 ? "" : "s"}`}
        onSend={(subject, body) => runBulk({ ids, action: "email", subject, body }, "Emailed")}
      />
      <RejectDialog
        open={dialog === "reject"}
        onOpenChange={(o) => !o && setDialog(null)}
        count={ids.length}
        onConfirm={(notify) => runBulk({ ids, action: "move", status: "rejected", notify }, "Rejected")}
      />
      <Dialog open={dialog === "tag"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md rounded-[32px] p-7">
          <DialogHeader>
            <DialogTitle className="text-2xl font-medium tracking-tight">Tag {ids.length} candidates</DialogTitle>
          </DialogHeader>
          <Input autoFocus value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder="e.g. strong DSA" list="known-tags" />
          <datalist id="known-tags">
            {allTags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <DialogFooter className="gap-2">
            <Button variant="ghost" disabled={!tagDraft.trim()} onClick={() => { runBulk({ ids, action: "untag", tag: tagDraft }, "Untagged"); setDialog(null); }}>
              Remove tag
            </Button>
            <Button disabled={!tagDraft.trim()} onClick={() => { runBulk({ ids, action: "tag", tag: tagDraft }, "Tagged"); setDialog(null); setTagDraft(""); }}>
              Add tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
