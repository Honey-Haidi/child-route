import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { RequireRole } from "@/components/RequireRole";
import { Button } from "@/components/ui/button";
import { claimDemoData } from "@/lib/trips.functions";
import { useProfile, useSession } from "@/lib/auth";
import { useActiveRides, useMyChildren, type ActiveRide, type ChildRow } from "@/lib/parentData";
import { useRealtimeInvalidate } from "@/lib/useRealtime";
import { childStatusIcon, childStatusLabel, childStatusTone, tripTypeLabel } from "@/lib/status";
import { formatTime } from "@/lib/geo";

export const Route = createFileRoute("/parent/")({
  head: () => ({
    meta: [
      { title: "My children — SafeRide" },
      {
        name: "description",
        content: "See each child's school transport status, estimated arrival and live vehicle tracking.",
      },
      { property: "og:title", content: "My children — SafeRide" },
      { property: "og:description", content: "Live school transport status for every child in your family." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireRole role="parent">
      <ParentDashboard />
    </RequireRole>
  ),
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function ParentDashboard() {
  const { userId } = useSession();
  const { data: profile } = useProfile(userId);
  const { data: children = [], isLoading } = useMyChildren(userId);
  const childIds = children.map((c) => c.id);
  const { data: rides = [] } = useActiveRides(childIds);
  const queryClient = useQueryClient();
  const claim = useServerFn(claimDemoData);
  const [claiming, setClaiming] = useState(false);

  useRealtimeInvalidate(
    "parent-dashboard",
    ["trip_children", "trips", "notifications"],
    [["active-rides", childIds.join(",")], ["notifications", userId]],
  );

  const rideByChild = new Map(rides.map((r) => [r.childId, r]));

  return (
    <AppShell
      title={`${greeting()}${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`}
      subtitle="Here is where your children are right now."
      nav={
        <>
          <Button asChild variant="ghost" size="sm">
            <Link to="/parent/notifications">Alerts</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/parent/history">History</Link>
          </Button>
        </>
      }
    >
      {isLoading ? (
        <p className="text-muted-foreground">Loading your children…</p>
      ) : children.length === 0 ? (
        <div className="surface-card p-6">
          <h2 className="text-lg font-semibold">No children linked yet</h2>
          <p className="mt-1 text-muted-foreground">
            Your school adds your children to your account. To try SafeRide right now, load the demo
            family (Ali, Sara and Ahmed on Route A).
          </p>
          <Button
            className="mt-4 h-11"
            disabled={claiming}
            onClick={async () => {
              setClaiming(true);
              try {
                await claim({ data: { as: "parent" } });
                await queryClient.invalidateQueries();
                toast.success("Demo family linked to your account");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not load demo data");
              } finally {
                setClaiming(false);
              }
            }}
          >
            {claiming ? "Loading…" : "Load demo family"}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map((child) => (
            <ChildCard key={child.id} child={child} ride={rideByChild.get(child.id)} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function ChildCard({ child, ride }: { child: ChildRow; ride?: ActiveRide | undefined }) {
  return (
    <article className="surface-card flex flex-col gap-4 p-5">
      <header className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-lg font-semibold">
          {child.name.slice(0, 1)}
        </span>
        <div>
          <h2 className="text-lg font-semibold leading-tight">{child.name}</h2>
          <p className="text-sm text-muted-foreground">{child.grade ?? "—"}</p>
        </div>
      </header>

      {ride ? (
        <>
          <div
            className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${childStatusTone(
              ride.childStatus,
            )}`}
          >
            <span aria-hidden>{childStatusIcon(ride.childStatus)}</span>
            {childStatusLabel(ride.childStatus, ride.tripType)}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Trip</dt>
              <dd className="font-medium">{tripTypeLabel(ride.tripType)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Expected arrival</dt>
              <dd className="font-medium">{formatTime(ride.etaAt)}</dd>
            </div>
          </dl>
          <Button asChild className="h-12 text-base">
            <Link to="/parent/track/$childId" params={{ childId: child.id }}>
              Track vehicle
            </Link>
          </Button>
        </>
      ) : (
        <>
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
            <span aria-hidden>🅿️</span> No trip running
          </div>
          <p className="text-sm text-muted-foreground">
            You will be alerted as soon as the driver starts the next trip.
          </p>
          <Button asChild variant="outline" className="h-11">
            <Link to="/parent/history">View trip history</Link>
          </Button>
        </>
      )}
    </article>
  );
}
