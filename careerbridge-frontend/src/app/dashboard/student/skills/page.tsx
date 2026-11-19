"use client";

import { ProfileExtras, ResumeAndSkills } from "@/components/profile-extras";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { useAuth } from "@/contexts/auth-context";
import { addStudentSkill, deleteStudentSkill, getSkills, getStudentSkills } from "@/lib/api";
import { DEMO_ENABLED, demoSkills, type SkillRow } from "@/lib/demo";
import { CloseCircleIcon, SearchIcon } from "@/components/icons";
import { DashboardSkeleton, Field, HeroCard, PageHeader, Panel, SegBars, stagger } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Skill { id: number; name: string; category: string }

const LEVEL_WEIGHT: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3 };
const LEVEL_TONE: Record<string, string> = { beginner: "tone-blue", intermediate: "tone-amber", advanced: "tone-violet" };
const asList = <T,>(d: unknown): T[] => (Array.isArray(d) ? (d as T[]) : ((d as { results?: T[] }).results ?? []));

export default function StudentSkillsPage() {
  const { user } = useAuth();
  const [mine, setMine] = useState<SkillRow[]>([]);
  const [library, setLibrary] = useState<Skill[]>([]);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Skill | null>(null);
  const [proficiency, setProficiency] = useState("beginner");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getStudentSkills(), getSkills()])
      .then(([m, all]) => {
        if (!alive) return;
        const list = asList<SkillRow>(m);
        if (list.length === 0 && DEMO_ENABLED) {
          setMine(demoSkills);
          setIsDemo(true);
        } else setMine(list);
        setLibrary(asList<Skill>(all));
      })
      .catch(() => {
        if (!alive || !DEMO_ENABLED) return;
        setMine(demoSkills);
        setIsDemo(true);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const reloadMine = () => {
    getStudentSkills()
      .then((m) => {
        setMine(asList<SkillRow>(m));
        setIsDemo(false);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!search) return;
    const t = setTimeout(() => getSkills(search).then((d) => setLibrary(asList<Skill>(d))).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleAdd = async () => {
    if (!picked) return toast.error("Please choose a skill from the list.");
    setAdding(true);
    try {
      if (isDemo) {
        setMine((p) => [...p, { id: Date.now(), skill: picked, proficiency }]);
      } else {
        await addStudentSkill(picked.id, proficiency);
        setMine(asList<SkillRow>(await getStudentSkills()));
      }
      toast.success(`${picked.name} added`);
      setPicked(null);
      setSearch("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(msg.includes("unique") ? "You already have this skill." : "Failed to add skill.");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: number) => {
    try {
      if (!isDemo) await deleteStudentSkill(id);
      setMine((p) => p.filter((s) => s.id !== id));
      toast.success("Skill removed");
    } catch {
      toast.error("Failed to remove skill.");
    }
  };

  if (loading) return <DashboardSkeleton />;

  const grouped = mine.reduce<Record<string, SkillRow[]>>((acc, s) => {
    const cat = s.skill.category || "Other";
    (acc[cat] ||= []).push(s);
    return acc;
  }, {});
  const strength = mine.length ? (mine.reduce((n, s) => n + (LEVEL_WEIGHT[s.proficiency] ?? 1), 0) / (mine.length * 3)) * 100 : 0;
  const levels = ["beginner", "intermediate", "advanced"].map((l) => ({
    label: l.charAt(0).toUpperCase() + l.slice(1),
    value: mine.filter((s) => s.proficiency === l).length,
  }));
  const suggestions = search && !picked ? library.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6) : [];
  const fullName = user?.full_name || user?.username || "Student";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Skills"
        subtitle="Build your skill profile to improve every internship match score."
        demo={isDemo}
      />

      <div className="grid gap-5 lg:grid-cols-12">
        <HeroCard
          className="lg:col-span-5"
          name={fullName}
          role="Student"
          kicker="Skills"
          value={String(mine.length)}
          progress={{ label: "Skill strength", value: strength }}
          nextLabel="Browse internships"
          nextHref="/internships"
        />
        <Panel className="lg:col-span-7" title="By proficiency" style={stagger(1)} action={<Badge variant="violet">{Object.keys(grouped).length} areas</Badge>}>
          <SegBars data={levels} emptyText="Add a skill to see your levels" />
        </Panel>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-8" title="Your skills" style={stagger(2)} contentClassName="space-y-7">
          {mine.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No skills yet — add your first one.</p>
          ) : (
            Object.entries(grouped).map(([category, skills]) => (
              <div key={category}>
                <p className="mb-3 text-[0.6875rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">{category}</p>
                <div className="flex flex-wrap gap-2.5">
                  {skills.map((s) => (
                    <span
                      key={s.id}
                      className={cn(
                        LEVEL_TONE[s.proficiency] ?? "tone-blue",
                        "tint dbl inline-flex items-center gap-2 rounded-full border py-1.5 pr-2 pl-4 text-[0.875rem] font-medium [--r:999px]"
                      )}
                    >
                      <span className="text-(--t-fg)">{s.skill.name}</span>
                      <span className="text-xs font-normal text-muted-foreground capitalize">{s.proficiency}</span>
                      <button
                        onClick={() => handleRemove(s.id)}
                        aria-label={`Remove ${s.skill.name}`}
                        className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-foreground/10 hover:text-foreground active:scale-90"
                      >
                        <CloseCircleIcon className="size-4" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </Panel>

        <Panel className="lg:col-span-4" title="Add a skill" tone="sage" style={stagger(3)} contentClassName="space-y-5">
          <Field label="Skill">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-[1.125rem] -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-11"
                placeholder="Search the skill library…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPicked(null);
                }}
              />
            </div>
            {suggestions.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-2xl border border-(--hairline) bg-popover p-1.5 shadow-lg">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                    onClick={() => {
                      setPicked(s);
                      setSearch(s.name);
                    }}
                  >
                    <span className="font-medium">{s.name}</span>
                    {s.category && <span className="text-xs text-muted-foreground">{s.category}</span>}
                  </button>
                ))}
              </div>
            )}
          </Field>
          <Field label="Proficiency">
            <Select value={proficiency} items={{ beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" }} onValueChange={(v) => v && setProficiency(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Button size="lg" className="w-full" onClick={handleAdd} disabled={adding || !picked}>
            Add skill
          </Button>
        </Panel>
      </div>

      <div className="grid items-stretch gap-5 lg:grid-cols-12">
        <ResumeAndSkills demo={isDemo} onSkillsChanged={reloadMine} />
      </div>

      <ProfileExtras />
    </div>
  );
}
