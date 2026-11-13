import { CompanyGate } from "@/components/org-gate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CompanyGate>{children}</CompanyGate>;
}

export const instant = false
