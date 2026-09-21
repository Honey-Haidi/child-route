import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { RequireRole } from "@/components/RequireRole";
import MapPanel from "@/components/MapPanel";
import type { MapMarker } from "@/components/LiveMap";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useActiveRides, useMyChildren } from "@/lib/parentData";
import { useRealtimeInvalidate } from "@/lib/useRealtime";
import { childStatusIcon, childStatusLabel, childStatusTone } from "@/lib/status";
import { distanceMeters, etaMinutes, formatDistance, isStale } from "@/lib/geo";

export const Route = createFileRoute("/parent/track/$childId")({
  head: () => ({
    meta: [
      { title: "Live tracking — SafeRide" },
      {
        name: "description",
        content: "Follow the school vehicle live on the map with arrival time and distance.",
      },
      { property: "og:title", content: "Live tracking — SafeRide" },
      {
        property: "og:description",
        content: "Follow the school vehicle live, with arrival time and distance remaining.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireRole role="parent">
      <TrackPage />
    </RequireRole>
  ),
});

function TrackPage() {
  const { childId } = Route.useParams();
  const { userId } = useSession();
  const { data: children = [] } = useMyChildren(userId);
  const child = children.find((c) => c.id === childId);
  const { data: rides = [] } = useActiveRides(children.map((c) => c.id));
  const ride = rides.find((r) => r.childId === childId);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  const { data: live } = useQuery({
    queryKey: ["vehicle-live", ride?.tripId, tick],
    enabled: !!ride?.tripId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_live")
        .select("lat, lng, speed, heading, recorded_at")
        .eq("trip_id", ride!.tripId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: school } = useQuery({
    queryKey: ["school", child?.school_id],
    enabled: !!child?.school_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("name, lat, lng")
        .eq("id", child!.school_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useRealtimeInvalidate(
    `track-${childId}`,
    ["vehicle_live", "trip_children", "trips"],
    [
      ["vehicle-live", ride?.tripId, tick],
      ["active-rides", children.map((c) => c.id).join(",")],
    ],
  );

  if (!child) {
    return (
      <AppShell title="Child not found" back={{ to: "/parent", label: "Back to my children" }}>
        <p className="text-muted-foreground">This child is not linked to your account.</p>
      </AppShell>
    );
  }

  const morning = ride?.tripType === "MORNING_HOME_TO_SCHOOL";
  const destination = morning
    ? school
      ? { lat: school.lat, lng: school.lng, label: school.name }
      : null
    : { lat: child.home_lat, lng: child.home_lng, label: `${child.name}'s home` };

  const markers: MapMarker[] = [];
  if (live)
    markers.push({
      id: "vehicle",
      lat: live.lat,
      lng: live.lng,
      label: ride?.vehicleReg ?? "Vehicle",
      kind: "vehicle",
    });
  markers.push({
    id: "home",
    lat: child.home_lat,
    lng: child.home_lng,
    label: "Home",
    kind: "home",
  });
  if (school)
    markers.push({
      id: "school",
      lat: school.lat,
      lng: school.lng,
      label: school.name,
      kind: "school",
    });

  const remaining =
    live && destination ? distanceMeters({ lat: live.lat, lng: live.lng }, destination) : null;
  const eta =
    remaining != null ? etaMinutes(remaining, live?.speed ? live.speed * 3.6 : null) : null;
  const stale = isStale(live?.recorded_at);

  const path: Array<[number, number]> = [];
  if (live) path.push([live.lng, live.lat]);
  if (destination) path.push([destination.lng, destination.lat]);

  return (
    <AppShell
      title={child.name}
      subtitle={
        ride
          ? childStatusLabel(ride.childStatus, ride.tripType)
          : "No trip is running for this child right now."
      }
      back={{ to: "/parent", label: "My children" }}
    >
      {ride ? (
        <div className="space-y-4">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${childStatusTone(
              ride.childStatus,
            )}`}
          >
            <span aria-hidden>{childStatusIcon(ride.childStatus)}</span>
            {childStatusLabel(ride.childStatus, ride.tripType)}
          </div>

          <MapPanel
            markers={markers}
            path={path}
            className="h-[380px] w-full overflow-hidden rounded-2xl border border-border"
          />

          {stale ? (
            <p className="rounded-xl bg-warning/20 px-4 py-3 text-sm text-warning-foreground">
              Driver connection temporarily unavailable — the position below is not live right now.
            </p>
          ) : null}

          <div className="surface-card grid gap-4 p-5 sm:grid-cols-4">
            <Field label="Driver" value={ride.driverName ?? "—"} />
            <Field label="Vehicle" value={ride.vehicleReg ?? "—"} />
            <Field label="Arrives in" value={stale || eta == null ? "—" : `${eta} min`} emphasis />
            <Field label="Distance" value={remaining == null ? "—" : formatDistance(remaining)} />
          </div>
        </div>
      ) : (
        <div className="surface-card p-6">
          <p className="text-muted-foreground">
            Live tracking turns on automatically when the driver starts the next trip.
          </p>
        </div>
      )}
    </AppShell>
  );
}

function Field({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={emphasis ? "text-xl font-semibold" : "font-medium"}>{value}</p>
    </div>
  );
}
