"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { errorMessage } from "@/lib/api";
import { mediaUrl } from "@/lib/format";
import { getPublicCompany } from "@/lib/ats";
import { ArrowRightUpIcon, BuildingsIcon, GlobalIcon, LocationIcon, PeopleIcon } from "@/components/icons";
import { InternshipCard } from "@/components/internship-card";
import { DashboardSkeleton, OrgAvatar, Panel, stagger } from "@/components/kit";
import { VerifiedBadge } from "@/components/verified-badge";
import { Button } from "@/components/ui/button";

const SIZES: Record<string, string> = { startup: "1–50 people", small: "51–200 people", medium: "201–1000 people", large: "1000+ people" };

export default function CompanyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getPublicCompany>> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(0);

  React.useEffect(() => {
    getPublicCompany(id)
      .then(setData)
      .catch((err) => setError(errorMessage(err, "Company not found.")));
    const raf = requestAnimationFrame(() => setNow(Date.now()));
    return () => cancelAnimationFrame(raf);
  }, [id]);

  if (error)
    return (
      <Panel title="Company not found">
        <p className="text-muted-foreground">{error}</p>
        <Button className="mt-5" render={<Link href="/internships" />} nativeButton={false}>
          Browse internships
        </Button>
      </Panel>
    );
  if (!data) return <DashboardSkeleton />;

  const facts = [
    data.industry && { icon: <BuildingsIcon className="size-4" />, text: data.industry },
    data.location && { icon: <LocationIcon className="size-4" />, text: data.location },
    data.size && { icon: <PeopleIcon className="size-4" />, text: SIZES[data.size] ?? data.size },
    data.founded_year && { icon: null, text: `Founded ${data.founded_year}` },
  ].filter(Boolean) as { icon: React.ReactNode; text: string }[];

  return (
    <div className="space-y-6">
      <section className="rise flex flex-col gap-6 rounded-[34px] border border-(--hairline) bg-card p-6 sm:flex-row sm:items-center sm:p-9">
        {data.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(data.logo) ?? ""} alt="" className="size-24 shrink-0 rounded-[28px] object-cover" />
        ) : (
          <OrgAvatar name={data.name} className="size-24 rounded-[28px] text-3xl" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[clamp(2rem,4vw,3rem)] leading-tight font-medium tracking-tight">{data.name}</h1>
            {data.is_verified && <VerifiedBadge />}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[15px] text-muted-foreground">
            {facts.map((f) => (
              <span key={f.text} className="inline-flex items-center gap-1.5">
                {f.icon}
                {f.text}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.website && (
            <Button variant="outline" render={<a href={data.website} target="_blank" rel="noreferrer" />} nativeButton={false}>
              <GlobalIcon /> Website
            </Button>
          )}
          {data.linkedin_url && (
            <Button variant="outline" render={<a href={data.linkedin_url} target="_blank" rel="noreferrer" />} nativeButton={false}>
              LinkedIn <ArrowRightUpIcon />
            </Button>
          )}
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-5">
          <Panel title="About" style={stagger(1)}>
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-muted-foreground">{data.description || "This company hasn't written about itself yet."}</p>
          </Panel>
          {data.culture && (
            <Panel title="Life here" tone="sage" style={stagger(2)}>
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{data.culture}</p>
            </Panel>
          )}
        </div>
        <Panel className="lg:col-span-7" title={`Open roles · ${data.open_roles.length}`} style={stagger(3)} contentClassName="grid gap-4 sm:grid-cols-2">
          {data.open_roles.length === 0 && <p className="text-[15px] text-muted-foreground sm:col-span-2">No open internships right now — check back soon.</p>}
          {now > 0 &&
            data.open_roles.map((r, i) => (
              <InternshipCard key={r.id} internship={{ ...r, company_logo: null, duration_months: (r as { duration_months?: number }).duration_months ?? 0 }} now={now} index={i} onApply={() => router.push(`/internships/${r.id}`)} />
            ))}
        </Panel>
      </div>
    </div>
  );
}
