import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { RequireRole } from "@/components/RequireRole";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/lib/auth";
import { claimDemoData, startTrip } from "@/lib/trips.functions";
import { ACTIVE_TRIP_STATUSES, tripTypeLabel, type TripType } from "@/lib/status";
import { formatTime } from "@/lib/geo";

export const Route = createFileRoute("/driver/")({
  head: () => ({
    meta: [
      { title: "Driver mode — SafeRide" },
      { name: "description", content: "Start the morning or afternoon school run, share live location and confirm each child." },
      { property: "og:title", content: "Driver mode — SafeRide" },
      { property: "og:description", content: "Start the school run, share live location and confirm every pickup and drop-off." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireRole role="driver">
      <DriverHome />
    </RequireRole>
  ),
});

function DriverHome() {
  const { userId } = useSession();
  const { data: profile } = useProfile(userId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const start = useServerFn(startTrip);
  const claim = useServerFn(claimDemoData);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["driver-routes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: routes, error } = await supabase
        .from("routes")
        .select("id, name, est_minutes, schools(name), vehicles(reg_no), route_children(child_id)")
        .eq("driver_id", userId!)
        .eq("active", true);
      if (error) throw error;

      const { data: trips } = await supabase
        .from("trips")
        .select("id, route_id, trip_type, status, started_at")
        .eq("driver_id", userId!)
        .in("status", [...ACTIVE_TRIP_STATUSES]);

      return { routes: routes ?? [], trips: trips ?? [] };
    },
  });

  async function begin(routeId: string, tripType: TripType) {
    setBusy(routeId + tripType);
    try {
      const result = await start({ data: { routeId, tripType } });
      await queryClient.invalidateQueries();
      navigate({ to: "/driver/trip/$tripId", params: { tripId: result.tripId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the trip");
    } finally {
      setBusy(null);
    }
  }

  const routes = data?.routes ?? [];
  const activeTrips = data?.trips ?? [];

  return (
    <AppShell
      title={`Driver mode${profile?.full_name ? ` · ${profile.full_name.split(" ")[0]}` : ""}`}
      subtitle="Start a trip to begin sharing your location with parents."
    >
      {isLoading ? (
        <p className="text-muted-foreground">Loading your routes…</p>
      ) : (
        <div className="space-y-5">
          {activeTrips.map((trip) => (
            <div key={trip.id} className="surface-card border-accent p-5">
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Trip in progress
              </p>
              <p className="mt-1 text-lg font-semibold">{tripTypeLabel(trip.trip_type as TripType)}</p>
              <p className="text-sm text-muted-foreground">Started {formatTime(trip.started_at)}</p>
              <Button
                className="mt-4 h-12 w-full text-base"
                onClick={() => navigate({ to: "/driver/trip/$tripId", params: { tripId: trip.id } })}
              >
                Open trip screen
              </Button>
            </div>
          ))}

          {routes.length === 0 ? (
            <div className="surface-card p-6">
              <h2 className="text-lg font-semibold">No route assigned yet</h2>
              <p className="mt-1 text-muted-foreground">
                Your school assigns routes to your account. To try driver mode now, take over the demo
                Route A with three children.
              </p>
              <Button
                className="mt-4 h-11"
                disabled={busy === "claim"}
                onClick={async () => {
                  setBusy("claim");
                  try {
                    await claim({ data: { as: "driver" } });
                    await queryClient.invalidateQueries();
                    toast.success("Demo route assigned to you");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not load demo route");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === "claim" ? "Loading…" : "Take the demo route"}
              </Button>
            </div>
          ) : (
            routes.map((route: any) => {
              const running = activeTrips.some((t) => t.route_id === route.id);
              return (
                <div key={route.id} className="surface-card p-5">
                  <h2 className="text-lg font-semibold">{route.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {route.schools?.name ?? "School"} · {route.vehicles?.reg_no ?? "No vehicle"} ·{" "}
                    {route.route_children?.length ?? 0} children · about {route.est_minutes} min
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Button
                      className="h-14 text-base"
                      disabled={running || busy !== null}
                      onClick={() => begin(route.id, "MORNING_HOME_TO_SCHOOL")}
                    >
                      🌅 Start morning trip
                    </Button>
                    <Button
                      className="h-14 text-base"
                      variant="secondary"
                      disabled={running || busy !== null}
                      onClick={() => begin(route.id, "AFTERNOON_SCHOOL_TO_HOME")}
                    >
                      🌇 Start afternoon trip
                    </Button>
                  </div>
                  {running ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      A trip is already running on this route.
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      )}
    </AppShell>
  );
}
