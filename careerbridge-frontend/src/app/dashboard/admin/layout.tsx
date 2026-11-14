import { AdminGate } from "@/components/admin/admin-gate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}

// a plain pass-through layout, like the other dashboard areas (see dashboard/layout.tsx)
export const instant = false
