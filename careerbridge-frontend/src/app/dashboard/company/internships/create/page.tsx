"use client";

import { useCompany } from "@/components/org-gate";
import { InternshipForm } from "@/components/ats/internship-form";
import { PageHeader, Panel } from "@/components/kit";

export default function CreateInternshipPage() {
  const { canManage } = useCompany();
  if (!canManage)
    return (
      <Panel title="Recruiters post internships">
        <p className="text-muted-foreground">You have interviewer access. Ask a recruiter or company admin to post this listing.</p>
      </Panel>
    );
  return (
    <div className="space-y-8">
      <PageHeader title="Post internship" subtitle="Fill in the details — the portal preview updates as you type." />
      <InternshipForm />
    </div>
  );
}
