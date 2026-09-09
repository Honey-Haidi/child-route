import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

import { homeForRole, useRole, useSession, type AppRole } from "@/lib/auth";

export function RequireRole({ role, children }: { role: AppRole; children: ReactNode }) {
  const { session, loading, userId } = useSession();
  const { data: actual, isLoading: roleLoading } = useRole(userId);
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (actual && actual !== role) {
      navigate({ to: homeForRole(actual), replace: true });
    }
  }, [loading, session, actual, role, navigate]);

  if (loading || roleLoading || !session || (actual && actual !== role)) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }
  return <>{children}</>;
}
