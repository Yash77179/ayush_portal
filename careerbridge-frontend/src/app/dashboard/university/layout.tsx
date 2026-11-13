import { UniversityGate } from "@/components/org-gate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <UniversityGate>{children}</UniversityGate>;
}

export const instant = false
