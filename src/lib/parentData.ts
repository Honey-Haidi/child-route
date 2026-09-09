import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { ACTIVE_TRIP_STATUSES, type ChildTripStatus, type TripStatus, type TripType } from "@/lib/status";

export type ChildRow = {
  id: string;
  name: string;
  grade: string | null;
  photo_url: string | null;
  home_lat: number;
  home_lng: number;
  home_address: string | null;
  emergency_contact: string | null;
  school_id: string | null;
  active: boolean;
};

export type ActiveRide = {
  tripId: string;
  childId: string;
  childStatus: ChildTripStatus;
  tripType: TripType;
  tripStatus: TripStatus;
  startedAt: string;
  etaAt: string | null;
  routeName: string | null;
  driverName: string | null;
  vehicleReg: string | null;
};

export function useMyChildren(userId: string | null) {
  return useQuery({
    queryKey: ["children", userId],
    enabled: !!userId,
    queryFn: async (): Promise<ChildRow[]> => {
      const { data, error } = await supabase
        .from("children")
        .select(
          "id, name, grade, photo_url, home_lat, home_lng, home_address, emergency_contact, school_id, active",
        )
        .eq("parent_id", userId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ChildRow[];
    },
  });
}

export function useActiveRides(childIds: string[]) {
  const key = childIds.join(",");
  return useQuery({
    queryKey: ["active-rides", key],
    enabled: childIds.length > 0,
    refetchInterval: 20000,
    queryFn: async (): Promise<ActiveRide[]> => {
      const { data, error } = await supabase
        .from("trip_children")
        .select(
          "child_id, status, trip_id, trips!inner(id, trip_type, status, started_at, eta_at, driver_id, routes(name), vehicles(reg_no))",
        )
        .in("child_id", childIds)
        .in("trips.status", [...ACTIVE_TRIP_STATUSES]);
      if (error) throw error;

      const rides = (data ?? []).map((row: any) => ({
        tripId: row.trip_id as string,
        childId: row.child_id as string,
        childStatus: row.status as ChildTripStatus,
        tripType: row.trips.trip_type as TripType,
        tripStatus: row.trips.status as TripStatus,
        startedAt: row.trips.started_at as string,
        etaAt: (row.trips.eta_at ?? null) as string | null,
        routeName: row.trips.routes?.name ?? null,
        driverName: null as string | null,
        vehicleReg: row.trips.vehicles?.reg_no ?? null,
      }));

      const driverIds = Array.from(
        new Set((data ?? []).map((row: any) => row.trips.driver_id).filter(Boolean)),
      );
      if (driverIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", driverIds as string[]);
        const byId = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));
        for (const ride of rides) {
          const driverId = (data ?? []).find((r: any) => r.trip_id === ride.tripId)?.trips.driver_id;
          ride.driverName = (driverId && byId.get(driverId)) || null;
        }
      }
      return rides;
    },
  });
}
