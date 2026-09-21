import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { RequireRole } from "@/components/RequireRole";
import MapPanel from "@/components/MapPanel";
import type { MapMarker } from "@/components/LiveMap";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { endTrip, reportIssue, setChildStatus } from "@/lib/trips.functions";
import { useDriverTracking } from "@/lib/useDriverTracking";
import { useRealtimeInvalidate } from "@/lib/useRealtime";
import {
  childStatusLabel,
  childStatusTone,
  tripTypeLabel,
  type ChildTripStatus,
  type TripType,
} from "@/lib/status";
import { distanceMeters, formatDistance } from "@/lib/geo";

export const Route = createFileRoute("/driver/trip/$tripId")({
  head: () => ({
    meta: [
      { title: "Trip in progress — SafeRide" },
      {
        name: "description",
        content: "Driver trip screen: live location sharing, next stop and per-child confirmation.",
      },
      { property: "og:title", content: "Trip in progress — SafeRide" },
      {
        property: "og:description",
        content: "Driver trip screen with live location sharing and per-child confirmation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireRole role="driver">
      <DriverTrip />
    </RequireRole>
  ),
});

type Rider = {
  id: string;
  childId: string;
  name: string;
  seq: number;
  status: ChildTripStatus;
  lat: number;
  lng: number;
  address: string | null;
};

function DriverTrip() {
  const { tripId } = Route.useParams();
  const { userId } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setStatus = useServerFn(setChildStatus);
  const finish = useServerFn(endTrip);
  const report = useServerFn(reportIssue);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: trip } = useQuery({
    queryKey: ["trip", tripId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select(
          "id, trip_type, status, started_at, route_id, routes(name, schools(name, lat, lng))",
        )
        .eq("id", tripId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: riders = [] } = useQuery({
    queryKey: ["trip-riders", tripId],
    queryFn: async (): Promise<Rider[]> => {
      const { data, error } = await supabase
        .from("trip_children")
        .select("id, child_id, seq, status, children(name, home_lat, home_lng, home_address)")
        .eq("trip_id", tripId)
        .order("seq");
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        childId: row.child_id,
        name: row.children?.name ?? "Child",
        seq: row.seq,
        status: row.status,
        lat: row.children?.home_lat,
        lng: row.children?.home_lng,
        address: row.children?.home_address ?? null,
      }));
    },
  });

  useRealtimeInvalidate(
    `driver-trip-${tripId}`,
    ["trip_children", "trips"],
    [
      ["trip-riders", tripId],
      ["trip", tripId],
    ],
  );

  const running = trip ? ["STARTED", "IN_PROGRESS", "DELAYED"].includes(trip.status) : false;
  const { last, error, online, pending } = useDriverTracking(tripId, running);

  const tripType = (trip?.trip_type ?? "MORNING_HOME_TO_SCHOOL") as TripType;
  const morning = tripType === "MORNING_HOME_TO_SCHOOL";
  const school = trip?.routes?.schools ?? null;

  const remaining = riders.filter(
    (r) => !["ARRIVED_AT_SCHOOL", "DROPPED_OFF", "ABSENT", "CANCELLED"].includes(r.status),
  );
  const next = morning
    ? remaining.find((r) => !["PICKED_UP", "ON_THE_WAY"].includes(r.status))
    : remaining[0];

  const markers: MapMarker[] = [];
  if (last) markers.push({ id: "me", lat: last.lat, lng: last.lng, label: "You", kind: "vehicle" });
  for (const rider of riders) {
    if (rider.lat == null) continue;
    markers.push({ id: rider.id, lat: rider.lat, lng: rider.lng, label: rider.name, kind: "home" });
  }
  if (school)
    markers.push({
      id: "school",
      lat: school.lat,
      lng: school.lng,
      label: school.name,
      kind: "school",
    });

  async function act(rider: Rider, action: "PICKUP" | "DROPOFF" | "ABSENT") {
    setBusy(rider.id + action);
    try {
      const res = await setStatus({
        data: {
          tripId,
          childId: rider.childId,
          action,
          lat: last?.lat ?? null,
          lng: last?.lng ?? null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["trip-riders", tripId] });
      toast.success(
        res.duplicate ? "Already recorded" : `${rider.name}: ${action.toLowerCase()} recorded`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell
      title={tripTypeLabel(tripType)}
      subtitle={trip?.routes?.name ?? undefined}
      back={{ to: "/driver", label: "Driver home" }}
    >
      <div className="space-y-4">
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            error
              ? "bg-destructive/12 text-destructive"
              : !online
                ? "bg-warning/20 text-warning-foreground"
                : "bg-success/15 text-success"
          }`}
        >
          {error
            ? `Location problem: ${error}. Allow location access and keep this screen open.`
            : !online
              ? `Offline — ${pending} location update(s) saved on this device and will be sent automatically.`
              : last
                ? "Sharing live location with parents. Keep this screen open during the trip."
                : "Waiting for GPS…"}
        </div>

        <MapPanel
          markers={markers}
          className="h-[300px] w-full overflow-hidden rounded-2xl border border-border"
        />

        {next ? (
          <div className="surface-card p-5">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Next stop
            </p>
            <p className="mt-1 text-xl font-semibold">{next.name}</p>
            <p className="text-sm text-muted-foreground">
              {next.address ?? "Pickup point"}
              {last && next.lat != null
                ? ` · ${formatDistance(distanceMeters({ lat: last.lat, lng: last.lng }, { lat: next.lat, lng: next.lng }))} away`
                : ""}
            </p>
          </div>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Children on this trip ({remaining.length} remaining)
          </h2>
          {riders.map((rider) => {
            const done = ["ARRIVED_AT_SCHOOL", "DROPPED_OFF", "ABSENT", "CANCELLED"].includes(
              rider.status,
            );
            const onboard = ["PICKED_UP", "ON_THE_WAY"].includes(rider.status);
            return (
              <article key={rider.id} className="surface-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {rider.seq}. {rider.name}
                    </p>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${childStatusTone(rider.status)}`}
                    >
                      {childStatusLabel(rider.status, tripType)}
                    </span>
                  </div>
                </div>
                {running && !done ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <Button
                      className="h-12"
                      disabled={onboard || busy !== null}
                      onClick={() => act(rider, "PICKUP")}
                    >
                      Picked up
                    </Button>
                    <Button
                      className="h-12"
                      variant="secondary"
                      disabled={!onboard || busy !== null}
                      onClick={() => act(rider, "DROPOFF")}
                    >
                      {morning ? "At school" : "Dropped off"}
                    </Button>
                    <Button
                      className="h-12"
                      variant="outline"
                      disabled={onboard || busy !== null}
                      onClick={() => act(rider, "ABSENT")}
                    >
                      Absent
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>

        {running ? (
          <div className="surface-card space-y-3 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Report a problem
            </h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["DELAY", "VEHICLE_ISSUE", "EMERGENCY"] as const).map((kind) => (
                <Button
                  key={kind}
                  variant={kind === "EMERGENCY" ? "destructive" : "outline"}
                  className="h-12"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy(kind);
                    try {
                      await report({
                        data: { tripId, kind, lat: last?.lat ?? null, lng: last?.lng ?? null },
                      });
                      toast.success("Reported — parents and the school have been alerted");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not report");
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {kind === "DELAY"
                    ? "Running late"
                    : kind === "VEHICLE_ISSUE"
                      ? "Vehicle issue"
                      : "Emergency"}
                </Button>
              ))}
            </div>
            <Button
              className="h-14 w-full text-base"
              variant="secondary"
              disabled={busy !== null}
              onClick={async () => {
                setBusy("end");
                try {
                  await finish({ data: { tripId } });
                  await queryClient.invalidateQueries();
                  toast.success("Trip ended — location sharing stopped");
                  navigate({ to: "/driver" });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not end trip");
                } finally {
                  setBusy(null);
                }
              }}
            >
              End trip
            </Button>
          </div>
        ) : (
          <div className="surface-card p-5 text-muted-foreground">
            This trip has finished. Location sharing is off.
          </div>
        )}
      </div>
    </AppShell>
  );
}
