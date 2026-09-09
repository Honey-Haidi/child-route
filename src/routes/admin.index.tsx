import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/AppShell";
import { RequireRole } from "@/components/RequireRole";
import MapPanel from "@/components/MapPanel";
import type { MapMarker } from "@/components/LiveMap";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/lib/useRealtime";
import { ACTIVE_TRIP_STATUSES, tripTypeLabel, type TripType } from "@/lib/status";
import { formatTime, isStale } from "@/lib/geo";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "School operations — SafeRide" },
      { name: "description", content: "Live overview of every school vehicle, route and trip in progress." },
      { property: "og:title", content: "School operations — SafeRide" },
      { property: "og:description", content: "Live overview of every school vehicle, route and trip in progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireRole role="admin">
      <AdminDashboard />
    </RequireRole>
  ),
});

function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [trips, live, counts] = await Promise.all([
        supabase
          .from("trips")
          .select("id, trip_type, status, started_at, routes(name), vehicles(reg_no), profiles:driver_id(full_name)")
          .in("status", ACTIVE_TRIP_STATUSES as unknown as string[]),
        supabase.from("vehicle_live").select("trip_id, lat, lng, recorded_at"),
        Promise.all([
          supabase.from("children").select("id", { count: "exact", head: true }),
          supabase.from("routes").select("id", { count: "exact", head: true }).eq("active", true),
          supabase.from("vehicles").select("id", { count: "exact", head: true }),
        ]),
      ]);
      return {
        trips: (trips.data ?? []) as any[],
        live: live.data ?? [],
        children: counts[0].count ?? 0,
        routes: counts[1].count ?? 0,
        vehicles: counts[2].count ?? 0,
      };
    },
    refetchInterval: 15000,
  });

  useRealtimeInvalidate("admin-overview", ["trips", "vehicle_live"], [["admin-overview"]]);

  const liveByTrip = new Map((data?.live ?? []).map((l: any) => [l.trip_id, l]));
  const markers: MapMarker[] = (data?.trips ?? [])
    .map((trip) => {
      const l = liveByTrip.get(trip.id);
      if (!l) return null;
      return {
        id: trip.id,
        lat: l.lat,
        lng: l.lng,
        label: trip.vehicles?.reg_no ?? "Vehicle",
        kind: "vehicle" as const,
      };
    })
    .filter(Boolean) as MapMarker[];

  return (
    <AppShell title="School operations" subtitle="Everything moving right now, at a glance.">
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Trips running" value={String(data?.trips.length ?? 0)} />
            <Stat label="Children" value={String(data?.children ?? 0)} />
            <Stat label="Active routes" value={String(data?.routes ?? 0)} />
            <Stat label="Vehicles" value={String(data?.vehicles ?? 0)} />
          </div>

          <MapPanel markers={markers} className="h-[360px] w-full overflow-hidden rounded-2xl border border-border" />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Trips in progress
            </h2>
            {(data?.trips ?? []).length === 0 ? (
              <p className="text-muted-foreground">No trip is running at the moment.</p>
            ) : (
              (data?.trips ?? []).map((trip) => {
                const l = liveByTrip.get(trip.id) as any;
                return (
                  <article key={trip.id} className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-semibold">
                        {trip.routes?.name ?? "Route"} · {tripTypeLabel(trip.trip_type as TripType)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {trip.profiles?.full_name ?? "Driver"} · {trip.vehicles?.reg_no ?? "—"} · started{" "}
                        {formatTime(trip.started_at)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${
                        !l || isStale(l.recorded_at)
                          ? "bg-warning/20 text-warning-foreground"
                          : "bg-success/15 text-success"
                      }`}
                    >
                      {!l ? "No signal" : isStale(l.recorded_at) ? "Signal lost" : "Live"}
                    </span>
                  </article>
                );
              })
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
