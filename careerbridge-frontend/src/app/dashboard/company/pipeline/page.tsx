"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { cn } from "cn";

import { errorMessage, getMyInternships } from "@/lib/api";
import { ALL_STAGES, STAGE_LABEL, fmtDateTime, getApplicants, moveApplicant, timeAgo, type ApplicantCard } from "@/lib/ats";
import { useCompany } from "@/components/org-gate";
import { MatchPill, RejectDialog, StarRating, VerifiedChip } from "@/components/ats/ats-ui";
import { CalendarIcon, SearchIcon } from "@/components/icons";
import { DashboardSkeleton, OrgAvatar, PageHeader, STATUS_DOT } from "@/components/kit";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Listing {
  id: number;
  title: string;
  status: string;
}

export default function PipelinePage() {
  return (
    <React.Suspense fallback={<DashboardSkeleton />}>
      <Pipeline />
    </React.Suspense>
  );
}

function Pipeline() {
  const { canManage } = useCompany();
  const router = useRouter();
  const params = useSearchParams();
  const [listings, setListings] = React.useState<Listing[]>([]);
  const [internship, setInternship] = React.useState(params.get("internship") ?? "all");
  const [cards, setCards] = React.useState<ApplicantCard[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [dragging, setDragging] = React.useState<ApplicantCard | null>(null);
  const [pendingReject, setPendingReject] = React.useState<ApplicantCard | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  React.useEffect(() => {
    getMyInternships()
      .then((d) => setListings((Array.isArray(d) ? d : ((d as { results?: Listing[] }).results ?? [])) as Listing[]))
      .catch(() => setListings([]));
  }, []);

  const load = React.useCallback(
    () =>
      getApplicants(internship === "all" ? undefined : { internship })
        .then(setCards)
        .catch((err) => toast.error(errorMessage(err)))
        .finally(() => setLoading(false)),
    [internship]
  );

  React.useEffect(() => {
    load();
  }, [load]);

  const doMove = async (card: ApplicantCard, to: string, notify = true) => {
    const before = cards;
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, status: to as ApplicantCard["status"] } : c)));
    try {
      await moveApplicant(card.id, to, notify);
      toast.success(`${card.student.user_name} → ${STAGE_LABEL[to]}`, {
        action: to === "interview" ? { label: "Schedule", onClick: () => router.push(`/dashboard/company/applicants/${card.id}?action=interview`) } : undefined,
      });
    } catch (err) {
      setCards(before);
      toast.error(errorMessage(err));
    }
  };

  const onDragStart = (e: DragStartEvent) => setDragging(cards.find((c) => c.id === e.active.id) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const card = cards.find((c) => c.id === e.active.id);
    const to = e.over?.id as string | undefined;
    if (!card || !to || to === card.status) return;
    if (to === "offered") {
      // an offer needs its terms — open the candidate with the offer form ready
      router.push(`/dashboard/company/applicants/${card.id}?action=offer`);
      return;
    }
    if (to === "rejected") {
      setPendingReject(card);
      return;
    }
    doMove(card, to);
  };

  if (loading) return <DashboardSkeleton />;

  const q = query.trim().toLowerCase();
  const visible = q
    ? cards.filter((c) => [c.student.user_name, c.student.university?.name ?? "", c.internship.title, ...c.tags].some((s) => s.toLowerCase().includes(q)))
    : cards;
  const listingItems = { all: "All internships", ...Object.fromEntries(listings.map((l) => [String(l.id), l.title])) };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        subtitle={canManage ? "Drag candidates between stages. Every move is logged and the candidate is kept informed." : "You have interviewer access: you can open candidates, rate them and file scorecards."}
        actions={
          <Link href="/dashboard/company/applicants" className="text-[15px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Table view
          </Link>
        }
      />

      <div className="rise grid gap-3 sm:grid-cols-2 xl:grid-cols-4 items-center">
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
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, college, tag" className="pl-10" />
        </div>
        <span className="text-[15px] text-muted-foreground tabular-nums xl:col-span-2 xl:text-right">{visible.length} candidates</span>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-0 sm:px-0">
          <div className="flex min-w-max items-start gap-4">
            {ALL_STAGES.map((stage) => (
              <Column key={stage} stage={stage} cards={visible.filter((c) => c.status === stage)} disabled={!canManage} />
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.32,0.72,0,1)" }}>
          {dragging ? <Card card={dragging} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <RejectDialog
        open={!!pendingReject}
        onOpenChange={(o) => !o && setPendingReject(null)}
        count={1}
        onConfirm={async (notify) => {
          if (pendingReject) await doMove(pendingReject, "rejected", notify);
        }}
      />
    </div>
  );
}

function Column({ stage, cards, disabled }: { stage: string; cards: ApplicantCard[]; disabled: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage, disabled });
  return (
    <section
      ref={setNodeRef}
      aria-label={STAGE_LABEL[stage]}
      className={cn(
        "flex w-[17.5rem] shrink-0 flex-col rounded-[26px] border border-(--hairline) bg-secondary/50 p-2.5 transition-colors duration-150",
        isOver && "border-foreground/30 bg-secondary"
      )}
    >
      <header className="flex items-center gap-2 px-2.5 pt-1.5 pb-3">
        <span className={cn("size-2 rounded-full", STATUS_DOT[stage])} />
        <h2 className="text-[15px] font-medium">{STAGE_LABEL[stage]}</h2>
        <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-[13.5px] text-muted-foreground tabular-nums">{cards.length}</span>
      </header>
      <div className="-mr-1 flex max-h-[calc(100svh-17rem)] min-h-40 flex-col gap-2 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
        {cards.map((c) => (
          <DraggableCard key={c.id} card={c} disabled={disabled} />
        ))}
        {cards.length === 0 && <p className="px-3 py-8 text-center text-[14.5px] text-muted-foreground">Drop candidates here</p>}
      </div>
    </section>
  );
}

function DraggableCard({ card, disabled }: { card: ApplicantCard; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, disabled });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn("touch-none outline-none", isDragging && "opacity-30")}>
      <Card card={card} />
    </div>
  );
}

function Card({ card, overlay }: { card: ApplicantCard; overlay?: boolean }) {
  const s = card.student;
  const body = (
    <div
      className={cn(
        "rounded-[20px] border border-(--hairline) bg-card p-3.5 text-left transition-shadow",
        overlay ? "rotate-[1.5deg] shadow-xl" : "hover:shadow-md"
      )}
    >
      <div className="flex items-start gap-3">
        <OrgAvatar name={s.user_name} className="size-9" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">{s.user_name}</p>
          <p className="truncate text-[13.5px] text-muted-foreground">{s.university?.name || s.user_email}</p>
        </div>
        {!card.viewed_at && <span title="Not opened yet" className="mt-1.5 size-2 shrink-0 rounded-full bg-sky-500" />}
      </div>
      <p className="mt-2.5 truncate text-[13.5px] text-muted-foreground">{card.internship.title}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <MatchPill score={card.match_score} />
        {card.avg_rating !== null && <StarRating value={card.avg_rating} size="sm" readOnly />}
        <VerifiedChip status={s.verification_status} />
      </div>
      {card.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[12.5px]">
              {t}
            </span>
          ))}
        </div>
      )}
      {card.next_interview && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
          <CalendarIcon className="size-3.5" /> {fmtDateTime(card.next_interview.scheduled_at)}
          {card.next_interview.candidate_response === "confirmed" && <span className="text-(--mint-fg)">· confirmed</span>}
          {card.next_interview.candidate_response === "reschedule" && <span className="text-(--pink-fg)">· reschedule?</span>}
        </p>
      )}
      {card.offer_status && <p className="mt-2 text-[13.5px] font-medium capitalize text-muted-foreground">Offer {card.offer_status}</p>}
      <p className="mt-2 text-[12.5px] text-muted-foreground/80">{card.source === "drive" ? "Campus drive · " : ""}Applied {timeAgo(card.applied_at)}</p>
    </div>
  );
  if (overlay) return body;
  return (
    <Link href={`/dashboard/company/applicants/${card.id}`} className="block rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-ring" draggable={false}>
      {body}
    </Link>
  );
}
