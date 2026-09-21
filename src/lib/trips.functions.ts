import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { distanceMeters } from "@/lib/geo";

const MAX_ACCURACY_M = 150;
const MAX_JUMP_KMH = 200;
const FUTURE_SKEW_MS = 60_000;
const MAX_AGE_MS = 10 * 60_000;

type Ctx = { supabase: SupabaseClient; userId: string };

type Kid = {
  id: string;
  name: string;
  home_lat: number;
  home_lng: number;
  home_geofence_m: number | null;
  school_id: string | null;
};

async function log(ctx: Ctx, action: string, entity: string, entityId: string, meta: unknown = {}) {
  await ctx.supabase.from("audit_logs").insert({
    actor: ctx.userId,
    action,
    entity,
    entity_id: entityId,
    meta: meta as Record<string, unknown>,
  });
}

async function notifyParent(
  ctx: Ctx,
  args: { childId: string; tripId: string; type: string; title: string; body: string },
) {
  const { data: child } = await ctx.supabase
    .from("children")
    .select("parent_id")
    .eq("id", args.childId)
    .maybeSingle();
  if (!child?.parent_id) return;
  await ctx.supabase.from("notifications").insert({
    user_id: child.parent_id,
    child_id: args.childId,
    trip_id: args.tripId,
    type: args.type,
    title: args.title,
    body: args.body,
  });
}

/** Driver starts a morning or afternoon trip on a route assigned to them. */
export const startTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        routeId: z.string().uuid(),
        tripType: z.enum(["MORNING_HOME_TO_SCHOOL", "AFTERNOON_SCHOOL_TO_HOME"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: route, error: routeError } = await ctx.supabase
      .from("routes")
      .select("id, name, vehicle_id, driver_id, est_minutes")
      .eq("id", data.routeId)
      .maybeSingle();
    if (routeError) throw new Error(routeError.message);
    if (!route || route.driver_id !== ctx.userId)
      throw new Error("This route is not assigned to you.");

    const { data: existing } = await ctx.supabase
      .from("trips")
      .select("id")
      .eq("route_id", route.id)
      .in("status", ["STARTED", "IN_PROGRESS", "DELAYED"])
      .maybeSingle();
    if (existing) return { tripId: existing.id as string, resumed: true };

    const { data: trip, error } = await ctx.supabase
      .from("trips")
      .insert({
        route_id: route.id,
        driver_id: ctx.userId,
        vehicle_id: route.vehicle_id,
        trip_type: data.tripType,
        status: "STARTED",
        eta_at: new Date(Date.now() + (route.est_minutes ?? 45) * 60000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { data: assigned } = await ctx.supabase
      .from("route_children")
      .select("child_id, seq")
      .eq("route_id", route.id)
      .order("seq");

    const rows = (assigned ?? []).map((r: { child_id: string; seq: number }) => ({
      trip_id: trip.id,
      child_id: r.child_id,
      seq: r.seq,
      status: "WAITING_FOR_PICKUP" as const,
    }));
    if (rows.length) {
      const { error: tcError } = await ctx.supabase.from("trip_children").insert(rows);
      if (tcError) throw new Error(tcError.message);
    }

    await ctx.supabase.from("trip_events").insert({
      trip_id: trip.id,
      type: "TRIP_STARTED",
      payload: { tripType: data.tripType },
    });

    const morning = data.tripType === "MORNING_HOME_TO_SCHOOL";
    for (const row of rows) {
      await notifyParent(ctx, {
        childId: row.child_id,
        tripId: trip.id,
        type: morning ? "TRIP_STARTED" : "SCHOOL_DEPARTURE",
        title: morning ? "School trip has started" : "Vehicle has left school",
        body: morning
          ? "The school vehicle has started its morning route."
          : "The school vehicle has left school and is heading home.",
      });
    }
    await log(ctx, "TRIP_START", "trip", trip.id, { routeId: route.id, tripType: data.tripType });
    return { tripId: trip.id as string, resumed: false };
  });

/** Driver marks a child picked up, dropped off, or absent. */
export const setChildStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        childId: z.string().uuid(),
        action: z.enum(["PICKUP", "DROPOFF", "ABSENT"]),
        lat: z.number().min(-90).max(90).nullable().optional(),
        lng: z.number().min(-180).max(180).nullable().optional(),
        reason: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: trip } = await ctx.supabase
      .from("trips")
      .select("id, driver_id, trip_type, status")
      .eq("id", data.tripId)
      .maybeSingle();
    if (!trip || trip.driver_id !== ctx.userId) throw new Error("Trip not found for this driver.");
    if (!["STARTED", "IN_PROGRESS", "DELAYED"].includes(trip.status))
      throw new Error("This trip is no longer running.");

    const { data: row } = await ctx.supabase
      .from("trip_children")
      .select("id, status, child_id")
      .eq("trip_id", data.tripId)
      .eq("child_id", data.childId)
      .maybeSingle();
    if (!row) throw new Error("This child is not on the trip.");

    const { data: child } = await ctx.supabase
      .from("children")
      .select("name")
      .eq("id", data.childId)
      .maybeSingle();
    const name = child?.name ?? "Your child";
    const morning = trip.trip_type === "MORNING_HOME_TO_SCHOOL";
    const now = new Date().toISOString();

    if (data.action === "PICKUP") {
      if (["PICKED_UP", "ON_THE_WAY", "ARRIVED_AT_SCHOOL", "DROPPED_OFF"].includes(row.status))
        return { ok: true, duplicate: true };
      await ctx.supabase
        .from("trip_children")
        .update({
          status: "ON_THE_WAY",
          picked_at: now,
          pickup_lat: data.lat ?? null,
          pickup_lng: data.lng ?? null,
        })
        .eq("id", row.id);
      await ctx.supabase
        .from("trips")
        .update({ status: "IN_PROGRESS" })
        .eq("id", trip.id)
        .in("status", ["STARTED"]);
      await notifyParent(ctx, {
        childId: data.childId,
        tripId: trip.id,
        type: "CHILD_PICKED_UP",
        title: `${name} has been picked up`,
        body: morning
          ? `${name} was picked up from home and is on the way to school.`
          : `${name} was picked up from school and is on the way home.`,
      });
    } else if (data.action === "DROPOFF") {
      if (["DROPPED_OFF", "ARRIVED_AT_SCHOOL"].includes(row.status))
        return { ok: true, duplicate: true };
      await ctx.supabase
        .from("trip_children")
        .update({
          status: morning ? "ARRIVED_AT_SCHOOL" : "DROPPED_OFF",
          dropped_at: now,
          dropoff_lat: data.lat ?? null,
          dropoff_lng: data.lng ?? null,
        })
        .eq("id", row.id);
      await notifyParent(ctx, {
        childId: data.childId,
        tripId: trip.id,
        type: morning ? "SCHOOL_ARRIVAL" : "CHILD_DROPPED_OFF",
        title: morning ? `${name} has arrived at school` : `${name} has been dropped off safely`,
        body: morning
          ? `${name} arrived at school and left the vehicle.`
          : `${name} was dropped off at home safely.`,
      });
    } else {
      await ctx.supabase
        .from("trip_children")
        .update({ status: "ABSENT", absent_reason: data.reason ?? null })
        .eq("id", row.id);
      await notifyParent(ctx, {
        childId: data.childId,
        tripId: trip.id,
        type: "CHILD_ABSENT",
        title: `${name} marked absent`,
        body: `The driver reported that ${name} was not present for this trip.`,
      });
    }

    await ctx.supabase.from("trip_events").insert({
      trip_id: trip.id,
      child_id: data.childId,
      type: data.action,
      payload: { lat: data.lat ?? null, lng: data.lng ?? null },
    });
    await log(ctx, `CHILD_${data.action}`, "trip_child", row.id, { tripId: trip.id });
    return { ok: true, duplicate: false };
  });

/** Driver device pushes a validated GPS ping; runs the geofence engine. */
export const pushLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        speed: z.number().nullable().optional(),
        heading: z.number().nullable().optional(),
        accuracy: z.number().nullable().optional(),
        timestamp: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const recordedAt = new Date(data.timestamp);
    const skew = recordedAt.getTime() - Date.now();
    if (!Number.isFinite(recordedAt.getTime())) return { accepted: false, reason: "bad_timestamp" };
    if (skew > FUTURE_SKEW_MS) return { accepted: false, reason: "future_timestamp" };
    if (-skew > MAX_AGE_MS) return { accepted: false, reason: "too_old" };
    if (data.accuracy != null && data.accuracy > MAX_ACCURACY_M)
      return { accepted: false, reason: "low_accuracy" };

    const { data: trip } = await ctx.supabase
      .from("trips")
      .select("id, driver_id, trip_type, status, route_id")
      .eq("id", data.tripId)
      .maybeSingle();
    if (!trip || trip.driver_id !== ctx.userId) return { accepted: false, reason: "not_your_trip" };
    if (!["STARTED", "IN_PROGRESS", "DELAYED"].includes(trip.status))
      return { accepted: false, reason: "trip_not_running" };

    const { data: last } = await ctx.supabase
      .from("vehicle_live")
      .select("lat, lng, recorded_at")
      .eq("trip_id", trip.id)
      .maybeSingle();

    if (last) {
      const seconds = Math.max(
        1,
        (recordedAt.getTime() - new Date(last.recorded_at).getTime()) / 1000,
      );
      const meters = distanceMeters(
        { lat: last.lat, lng: last.lng },
        { lat: data.lat, lng: data.lng },
      );
      const kmh = (meters / seconds) * 3.6;
      if (kmh > MAX_JUMP_KMH) {
        await ctx.supabase.from("trip_events").insert({
          trip_id: trip.id,
          type: "SUSPICIOUS_GPS",
          payload: {
            kmh: Math.round(kmh),
            meters: Math.round(meters),
            seconds: Math.round(seconds),
          },
        });
        return { accepted: false, reason: "implausible_jump" };
      }
      if (recordedAt.getTime() <= new Date(last.recorded_at).getTime())
        return { accepted: false, reason: "out_of_order" };
    }

    const payload = {
      trip_id: trip.id,
      lat: data.lat,
      lng: data.lng,
      speed: data.speed ?? null,
      heading: data.heading ?? null,
      accuracy: data.accuracy ?? null,
      recorded_at: recordedAt.toISOString(),
    };
    const { error: liveError } = await ctx.supabase
      .from("vehicle_live")
      .upsert(payload, { onConflict: "trip_id" });
    if (liveError) throw new Error(liveError.message);
    await ctx.supabase.from("location_history").insert({
      trip_id: trip.id,
      lat: data.lat,
      lng: data.lng,
      speed: data.speed ?? null,
      heading: data.heading ?? null,
      recorded_at: recordedAt.toISOString(),
    });

    // ---- geofence engine ----
    const morning = trip.trip_type === "MORNING_HOME_TO_SCHOOL";
    const events: string[] = [];

    const { data: riders } = await ctx.supabase
      .from("trip_children")
      .select("id, child_id, status")
      .eq("trip_id", trip.id);

    const childIds = (riders ?? []).map((r: { child_id: string }) => r.child_id);
    if (childIds.length) {
      const { data: kids } = await ctx.supabase
        .from("children")
        .select("id, name, home_lat, home_lng, home_geofence_m, school_id")
        .in("id", childIds);

      const kidById = new Map<string, Kid>((kids ?? []).map((k) => [k.id as string, k as Kid]));

      for (const rider of riders ?? []) {
        const kid = kidById.get(rider.child_id);
        if (!kid) continue;
        const near =
          distanceMeters(
            { lat: kid.home_lat, lng: kid.home_lng },
            { lat: data.lat, lng: data.lng },
          ) <= (kid.home_geofence_m ?? 200);
        const relevant = morning
          ? rider.status === "WAITING_FOR_PICKUP"
          : rider.status === "ON_THE_WAY" || rider.status === "PICKED_UP";
        if (near && relevant) {
          if (morning) {
            await ctx.supabase
              .from("trip_children")
              .update({ status: "DRIVER_APPROACHING" })
              .eq("id", rider.id);
          }
          await ctx.supabase.from("trip_events").insert({
            trip_id: trip.id,
            child_id: rider.child_id,
            type: morning ? "VEHICLE_ENTERED_PICKUP_ZONE" : "VEHICLE_ENTERED_HOME_ZONE",
            payload: { lat: data.lat, lng: data.lng },
          });
          const { data: recent } = await ctx.supabase
            .from("notifications")
            .select("id")
            .eq("trip_id", trip.id)
            .eq("child_id", rider.child_id)
            .eq("type", "DRIVER_APPROACHING")
            .maybeSingle();
          if (!recent) {
            await notifyParent(ctx, {
              childId: rider.child_id,
              tripId: trip.id,
              type: "DRIVER_APPROACHING",
              title: "The school vehicle is approaching",
              body: morning
                ? `The vehicle is close to your pickup point for ${kid.name}.`
                : `The vehicle is approaching home with ${kid.name}.`,
            });
          }
          events.push("APPROACHING");
        }
      }

      if (morning) {
        const schoolId = (kids ?? [])[0]?.school_id;
        if (schoolId) {
          const { data: school } = await ctx.supabase
            .from("schools")
            .select("lat, lng, geofence_m, name")
            .eq("id", schoolId)
            .maybeSingle();
          if (
            school &&
            distanceMeters(
              { lat: school.lat, lng: school.lng },
              { lat: data.lat, lng: data.lng },
            ) <= (school.geofence_m ?? 150)
          ) {
            for (const rider of riders ?? []) {
              if (rider.status !== "ON_THE_WAY" && rider.status !== "PICKED_UP") continue;
              await ctx.supabase
                .from("trip_children")
                .update({ status: "ARRIVED_AT_SCHOOL", dropped_at: new Date().toISOString() })
                .eq("id", rider.id);
              const kid = kidById.get(rider.child_id);
              await notifyParent(ctx, {
                childId: rider.child_id,
                tripId: trip.id,
                type: "SCHOOL_ARRIVAL",
                title: `${kid?.name ?? "Your child"} has arrived at school`,
                body: `The vehicle reached ${school.name}.`,
              });
              events.push("SCHOOL_ARRIVAL");
            }
          }
        }
      }
    }

    return { accepted: true, events };
  });

/** Driver ends the trip; live position is deleted so nothing is tracked afterwards. */
export const endTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ tripId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: trip } = await ctx.supabase
      .from("trips")
      .select("id, driver_id, trip_type")
      .eq("id", data.tripId)
      .maybeSingle();
    if (!trip || trip.driver_id !== ctx.userId) throw new Error("Trip not found for this driver.");

    await ctx.supabase
      .from("trips")
      .update({ status: "COMPLETED", ended_at: new Date().toISOString() })
      .eq("id", trip.id);
    await ctx.supabase.from("vehicle_live").delete().eq("trip_id", trip.id);
    await ctx.supabase.from("trip_events").insert({ trip_id: trip.id, type: "TRIP_COMPLETED" });
    await log(ctx, "TRIP_END", "trip", trip.id, {});
    return { ok: true };
  });

/** Driver reports a delay, vehicle problem, or emergency. */
export const reportIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        kind: z.enum(["DELAY", "VEHICLE_ISSUE", "EMERGENCY", "CANCEL"]),
        note: z.string().max(300).optional(),
        lat: z.number().nullable().optional(),
        lng: z.number().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: trip } = await ctx.supabase
      .from("trips")
      .select("id, driver_id")
      .eq("id", data.tripId)
      .maybeSingle();
    if (!trip || trip.driver_id !== ctx.userId) throw new Error("Trip not found for this driver.");

    if (data.kind === "DELAY")
      await ctx.supabase
        .from("trips")
        .update({ status: "DELAYED", note: data.note ?? null })
        .eq("id", trip.id);
    if (data.kind === "CANCEL")
      await ctx.supabase
        .from("trips")
        .update({
          status: "CANCELLED",
          ended_at: new Date().toISOString(),
          note: data.note ?? null,
        })
        .eq("id", trip.id);

    await ctx.supabase.from("trip_events").insert({
      trip_id: trip.id,
      type: data.kind,
      payload: { note: data.note ?? null, lat: data.lat ?? null, lng: data.lng ?? null },
    });

    const { data: riders } = await ctx.supabase
      .from("trip_children")
      .select("child_id")
      .eq("trip_id", trip.id);

    const titles: Record<string, [string, string]> = {
      DELAY: ["Trip delayed", data.note || "The vehicle is running late."],
      VEHICLE_ISSUE: [
        "Vehicle problem reported",
        data.note || "The driver reported a vehicle problem.",
      ],
      EMERGENCY: [
        "Emergency reported",
        data.note || "The driver raised an emergency alert. The school has been notified.",
      ],
      CANCEL: ["Trip cancelled", data.note || "This trip has been cancelled."],
    };
    for (const rider of riders ?? []) {
      await notifyParent(ctx, {
        childId: rider.child_id,
        tripId: trip.id,
        type: `TRIP_${data.kind}`,
        title: titles[data.kind]![0],
        body: titles[data.kind]![1],
      });
    }
    await log(ctx, `REPORT_${data.kind}`, "trip", trip.id, { note: data.note ?? null });
    return { ok: true };
  });

/**
 * One-tap demo setup: links the signed-in account to the seeded demo route
 * as a parent (claims the three demo children) or as the route's driver.
 */
export const claimDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ as: z.enum(["parent", "driver"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const ROUTE_ID = "33333333-3333-3333-3333-333333333333";

    if (data.as === "parent") {
      const { error } = await ctx.supabase
        .from("children")
        .update({ parent_id: ctx.userId })
        .eq("is_demo", true)
        .is("parent_id", null);
      if (error) throw new Error(error.message);
      await log(ctx, "CLAIM_DEMO_PARENT", "children", "demo", {});
      return { ok: true };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("drivers")
      .upsert({ user_id: ctx.userId, active: true }, { onConflict: "user_id" });
    await supabaseAdmin
      .from("vehicles")
      .update({ driver_id: ctx.userId })
      .eq("id", "22222222-2222-2222-2222-222222222222");
    await supabaseAdmin.from("routes").update({ driver_id: ctx.userId }).eq("id", ROUTE_ID);
    await log(ctx, "CLAIM_DEMO_DRIVER", "routes", ROUTE_ID, {});
    return { ok: true };
  });
