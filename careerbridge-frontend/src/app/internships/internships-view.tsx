"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { applyToInternship, getInternships } from "@/lib/api";
import { makeSample, type BrowseInternship } from "@/lib/internship-data";
import { SearchIcon } from "@/components/icons";
import { InternshipCard } from "@/components/internship-card";
import { Field, PageHeader } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export function InternshipsView() {
  const [internships, setInternships] = useState<BrowseInternship[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [workMode, setWorkMode] = useState(["remote", "hybrid", "onsite"].includes(params.get("mode") ?? "") ? (params.get("mode") as string) : "all");
  const [applyTarget, setApplyTarget] = useState<BrowseInternship | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [applying, setApplying] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setNow(Date.now()));
    return () => cancelAnimationFrame(id);
  }, []);

  const fetchInternships = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (search) params.q = search;
    if (workMode !== "all") params.work_mode = workMode;
    try {
      const data = (await getInternships(params)) as { results?: BrowseInternship[] } | BrowseInternship[];
      const list = Array.isArray(data) ? data : (data.results ?? []);
      if (list.length === 0 && !search && workMode === "all") {
        setInternships(makeSample());
        setIsDemo(true);
      } else {
        setInternships(list);
        setIsDemo(false);
      }
    } catch {
      setInternships(makeSample());
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }, [search, workMode]);

  useEffect(() => {
    const timer = setTimeout(fetchInternships, 350);
    return () => clearTimeout(timer);
  }, [fetchInternships]);

  const shown = isDemo
    ? internships.filter(
        (i) =>
          (workMode === "all" || i.work_mode === workMode) &&
          (!search || `${i.title} ${i.company_name}`.toLowerCase().includes(search.toLowerCase()))
      )
    : internships;

  const handleApply = async () => {
    if (!applyTarget) return;
    setApplying(true);
    try {
      if (!isDemo) await applyToInternship(applyTarget.id, coverLetter);
      toast.success("Application submitted");
      setApplyTarget(null);
      setCoverLetter("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Application failed.";
      toast.error(msg.includes("already applied") ? "You have already applied for this internship." : msg);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Browse internships"
        subtitle="Discover opportunities matching your skills."
        demo={isDemo}
      />

      <div className="rise flex flex-col gap-3 sm:flex-row" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-5 z-10 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-13" placeholder="Search by title, company or skill…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={workMode} items={{ all: "All modes", remote: "Remote", hybrid: "Hybrid", onsite: "On-site" }} onValueChange={(v) => v && setWorkMode(v)}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Work mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modes</SelectItem>
            <SelectItem value="remote">Remote</SelectItem>
            <SelectItem value="hybrid">Hybrid</SelectItem>
            <SelectItem value="onsite">On-site</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading || now === 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-[32px]" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-[22px] font-medium">No internships found</p>
          <p className="mt-2 text-muted-foreground">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((i, idx) => (
            <InternshipCard key={i.id} internship={i} now={now} index={idx} onApply={setApplyTarget} />
          ))}
        </div>
      )}

      <Dialog open={!!applyTarget} onOpenChange={(o) => !o && setApplyTarget(null)}>
        <DialogContent className="rounded-[32px] p-7">
          <DialogHeader>
            <DialogTitle className="text-2xl font-medium tracking-tight">Apply for {applyTarget?.title}</DialogTitle>
            <DialogDescription>
              {applyTarget?.company_name} will see your profile and skills with this application.
            </DialogDescription>
          </DialogHeader>
          <Field label="Cover letter (optional)">
            <Textarea rows={5} placeholder="Why are you a great fit for this role?" value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={applying}>
              {applying && <Loader2 className="animate-spin" />} Submit application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
