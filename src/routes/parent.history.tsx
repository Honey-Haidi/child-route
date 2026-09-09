import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/AppShell";
import { RequireRole } from "@/components/RequireRole";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useMyChildren } from "@/lib/parentData";
import { formatDate, formatTime } from "@/lib/geo";
import { tripTypeLabel, type TripType } from "@/lib/status";

export const Route = createFileRoute("/parent/history")({
  head: () => ({
    meta: [
      { title: "Trip history — SafeRide" },
      { name: "description", content: "Past school trips with pickup and drop-off times for each child." },
      { property: "og:title", content: "Trip history — SafeRide" },
      { property: "og:description", content: "Past school trips with pickup and drop-off times for each child." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireRole role="parent">
      <HistoryPage />
    </RequireRole>
  ),
});

type HistoryRow = {
  id: string;
  childName: string;
  status: string;
  pickedAt: string | null;
  droppedAt: string | null;
  tripType: TripType;
  startedAt: string;
  endedAt: string | null;
  tripStatus: string;
};

function HistoryPage() {
  const { userId } = useSession();
  const { data: children = [] } = useMyChildren(userId);
  const childIds = children.map((c) => c.id);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["history", childIds.join(",")],
    enabled: childIds.length > 0,
    queryFn: async (): Promise<HistoryRow[]> => {
      const { data, error } = await supabase
        .from("trip_children")
        .select(
          "id, child_id, status, picked_at, dropped_at, trips!inner(trip_type, status, started_at, ended_at)",
        )
        .in("child_id", childIds)
        .order("picked_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      const nameById = new Map(children.map((c) => [c.id, c.name]));
      return (data ?? []).map((row: any) => ({
        id: row.id,
        childName: nameById.get(row.child_id) ?? "Child",
        status: row.status,
        pickedAt: row.picked_at,
        droppedAt: row.dropped_at,
        tripType: row.trips.trip_type,
        startedAt: row.trips.started_at,
        endedAt: row.trips.ended_at,
        tripStatus: row.trips.status,
      }));
    },
  });

  const grouped = new Map<string, HistoryRow[]>();
  for (const row of rows) {
    const day = formatDate(row.startedAt);
    grouped.set(day, [...(grouped.get(day) ?? []), row]);
  }

  return (
    <AppShell
      title="Trip history"
      subtitle="Every completed journey, with pickup and drop-off times."
      back={{ to: "/parent", label: "My children" }}
    >
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">No trips recorded yet.</p>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([day, dayRows]) => (
            <section key={day}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {day}
              </h2>
              <div className="space-y-3">
                {dayRows.map((row) => (
                  <article key={row.id} className="surface-card p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">
                        {row.childName} · {tripTypeLabel(row.tripType)}
                      </p>
                      <span className="text-sm text-muted-foreground">{row.tripStatus.toLowerCase()}</span>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                      <Cell label="Picked up" value={formatTime(row.pickedAt)} />
                      <Cell
                        label={row.tripType === "MORNING_HOME_TO_SCHOOL" ? "At school" : "Dropped home"}
                        value={formatTime(row.droppedAt)}
                      />
                      <Cell label="Trip start" value={formatTime(row.startedAt)} />
                      <Cell label="Trip end" value={formatTime(row.endedAt)} />
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
