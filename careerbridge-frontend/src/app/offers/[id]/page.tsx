"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { errorMessage } from "@/lib/api";
import { mediaUrl } from "@/lib/format";
import { fmtDate, fmtMoney, getOfferLetter, type OfferLetter } from "@/lib/ats";
import { PrinterIcon } from "@/components/icons";
import { OrgAvatar } from "@/components/kit";
import { Button } from "@/components/ui/button";

/** A printable offer letter. "Print / Save as PDF" uses the browser's own PDF export. */
export default function OfferLetterPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [offer, setOffer] = React.useState<OfferLetter | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (loading || !user) return;
    getOfferLetter(id)
      .then(setOffer)
      .catch((err) => setError(errorMessage(err, "Offer not found.")));
  }, [id, user, loading]);

  const problem = !loading && !user ? "Sign in to see this offer letter." : error;
  if (problem)
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="text-lg">{problem}</p>
        <Button className="mt-6" render={<Link href={user ? "/dashboard" : "/login"} />} nativeButton={false}>
          {user ? "Back to dashboard" : "Sign in"}
        </Button>
      </main>
    );
  if (!offer)
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );

  const end = new Date(offer.start_date);
  end.setMonth(end.getMonth() + offer.duration_months);
  const status =
    offer.status === "accepted" ? `Accepted on ${fmtDate(offer.responded_at)}` : offer.status === "declined" ? "Declined" : offer.status === "withdrawn" ? "Withdrawn" : offer.is_expired ? "Expired" : `Awaiting reply by ${fmtDate(offer.expires_on)}`;

  return (
    <main className="min-h-svh bg-secondary/60 px-4 py-10 print:bg-white print:p-0">
      <div className="mx-auto mb-5 flex max-w-[52rem] items-center justify-between gap-3 print:hidden">
        <Link href={user?.role === "student" ? "/dashboard/student/applications" : "/dashboard/company/pipeline"} className="text-[15px] text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
        <Button onClick={() => window.print()}>
          <PrinterIcon /> Print / Save as PDF
        </Button>
      </div>

      <article className="mx-auto max-w-[52rem] rounded-[28px] bg-white p-10 text-[15px] leading-relaxed text-neutral-900 shadow-sm sm:p-14 print:max-w-none print:rounded-none print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b border-neutral-200 pb-8">
          <div className="flex items-center gap-4">
            {offer.company.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(offer.company.logo) ?? ""} alt="" className="size-14 rounded-2xl object-cover" />
            ) : (
              <OrgAvatar name={offer.company.name} className="size-14" />
            )}
            <div>
              <p className="text-xl font-semibold">{offer.company.name}</p>
              {offer.company.location && <p className="text-sm text-neutral-500">{offer.company.location}</p>}
              {offer.company.website && <p className="text-sm text-neutral-500">{offer.company.website.replace(/^https?:\/\//, "")}</p>}
            </div>
          </div>
          <div className="text-right text-sm text-neutral-500">
            <p>Ref. CB-OFFER-{String(offer.id).padStart(5, "0")}</p>
            <p>{fmtDate(offer.created_at, { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </header>

        <section className="space-y-5 pt-8">
          <p>
            Dear <strong>{offer.candidate_name}</strong>,
          </p>
          <p>
            We are pleased to offer you the position of <strong>{offer.role_title}</strong> at {offer.company.name}. We were impressed by your
            application and interviews, and we’re excited to have you join the team.
          </p>

          <table className="w-full border-collapse text-left text-[14.5px]">
            <tbody>
              {[
                ["Role", offer.role_title],
                ["Monthly stipend", `${fmtMoney(offer.stipend)} per month`],
                ["Start date", fmtDate(offer.start_date, { day: "numeric", month: "long", year: "numeric" })],
                ["Duration", `${offer.duration_months} month${offer.duration_months === 1 ? "" : "s"} (until ${fmtDate(end.toISOString(), { day: "numeric", month: "long", year: "numeric" })})`],
                ["Location", offer.location || "As agreed with the team"],
                ["Please respond by", fmtDate(offer.expires_on, { day: "numeric", month: "long", year: "numeric" })],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-neutral-100">
                  <th className="w-48 py-2.5 pr-4 font-medium text-neutral-500">{k}</th>
                  <td className="py-2.5">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {offer.message && <p className="whitespace-pre-wrap">{offer.message}</p>}

          <p>
            This offer is subject to verification of your academic records and to the company’s standard internship terms. Please accept or decline
            from your CareerBridge account before the date above.
          </p>
          <p>We look forward to working with you.</p>

          <div className="pt-6">
            <p>Warm regards,</p>
            <p className="mt-6 font-semibold">{offer.signed_by}</p>
            <p className="text-neutral-500">On behalf of {offer.company.name}</p>
          </div>
        </section>

        <footer className="mt-10 flex items-center justify-between gap-4 border-t border-neutral-200 pt-5 text-[12.5px] text-neutral-500">
          <span>Issued through CareerBridge to {offer.candidate_email}</span>
          <span className="font-medium text-neutral-700">Status: {status}</span>
        </footer>
      </article>
    </main>
  );
}
