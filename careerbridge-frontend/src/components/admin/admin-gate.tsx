"use client";

import { useAuth } from "@/contexts/auth-context";
import { DashboardSkeleton } from "@/components/kit";

/** The admin area is only for admins (the API refuses everyone else too). */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading || !user) return <DashboardSkeleton />;
  if (user.role !== "admin") return <p className="py-24 text-center text-[17px] text-muted-foreground">This part of CareerBridge is for admins only.</p>;
  return <>{children}</>;
}
