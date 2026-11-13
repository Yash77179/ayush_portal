"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { errorMessage } from "@/lib/api";
import { getManagedInternship, type ManagedInternship } from "@/lib/ats";
import { InternshipForm } from "@/components/ats/internship-form";
import { DashboardSkeleton, PageHeader, Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";

export default function EditInternshipPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = React.useState<ManagedInternship | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getManagedInternship(id)
      .then(setItem)
      .catch((err) => setError(errorMessage(err, "Listing not found.")));
  }, [id]);

  if (error)
    return (
      <Panel title="Couldn't open this listing">
        <p className="text-muted-foreground">{error}</p>
        <Button className="mt-5" render={<Link href="/dashboard/company/internships" />} nativeButton={false}>
          Back to listings
        </Button>
      </Panel>
    );
  if (!item) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      <PageHeader title="Edit internship" subtitle={item.title} />
      <InternshipForm initial={item} />
    </div>
  );
}
