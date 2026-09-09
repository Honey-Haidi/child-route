import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/AppShell";
import { RequireRole } from "@/components/RequireRole";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useRealtimeInvalidate } from "@/lib/useRealtime";
import { formatDate, formatTime } from "@/lib/geo";

export const Route = createFileRoute("/parent/notifications")({
  head: () => ({
    meta: [
      { title: "Alerts — SafeRide" },
      { name: "description", content: "Every school transport alert for your children, newest first." },
      { property: "og:title", content: "Alerts — SafeRide" },
      { property: "og:description", content: "Every school transport alert for your children, newest first." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireRole role="parent">
      <NotificationsPage />
    </RequireRole>
  ),
});

function NotificationsPage() {
  const { userId } = useSession();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, type, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return data ?? [];
    },
  });

  useRealtimeInvalidate("parent-alerts", ["notifications"], [["notifications", userId]]);

  return (
    <AppShell title="Alerts" subtitle="Everything that happened on your children's trips." back={{ to: "/parent", label: "My children" }}>
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">No alerts yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((n) => (
            <li key={n.id} className="surface-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{n.title}</p>
                <span className="text-sm text-muted-foreground">
                  {formatDate(n.created_at)} · {formatTime(n.created_at)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
