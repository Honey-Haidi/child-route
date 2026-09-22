import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: SupabaseClient; userId: string };

export type RouteOption = {
  id: string;
  name: string;
  driverName: string | null;
  vehicleReg: string | null;
  seats: number | null;
  assigned: number;
};

/** Routes (driver + van) a parent can pick from for a school. */
export const listRoutesForSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ schoolId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<RouteOption[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: routes, error } = await supabaseAdmin
      .from("routes")
      .select("id, name, driver_id, vehicles(reg_no, capacity)")
      .eq("school_id", data.schoolId)
      .eq("active", true)
      .order("name");
    if (error) throw new Error(error.message);
    const rows = routes ?? [];
    if (!rows.length) return [];

    const driverIds = Array.from(
      new Set(rows.flatMap((r) => (r.driver_id ? [r.driver_id as string] : []))),
    );
    const names = new Map<string, string>();
    if (driverIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", driverIds);
      for (const p of profiles ?? []) names.set(p.user_id, p.full_name);
    }

    const { data: counts } = await supabaseAdmin
      .from("route_children")
      .select("route_id")
      .in(
        "route_id",
        rows.map((r) => r.id as string),
      );
    const assigned = new Map<string, number>();
    for (const c of counts ?? [])
      assigned.set(c.route_id as string, (assigned.get(c.route_id as string) ?? 0) + 1);

    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      driverName: r.driver_id ? (names.get(r.driver_id as string) ?? null) : null,
      vehicleReg: r.vehicles?.reg_no ?? null,
      seats: r.vehicles?.capacity ?? null,
      assigned: assigned.get(r.id as string) ?? 0,
    }));
  });

/** Parent registers a child and optionally attaches them to a driver's route. */
export const addChild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(80),
        grade: z.string().trim().max(40).nullable().optional(),
        schoolId: z.string().uuid(),
        address: z.string().trim().max(200).nullable().optional(),
        emergency: z.string().trim().max(40).nullable().optional(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        routeId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;

    const { data: child, error } = await ctx.supabase
      .from("children")
      .insert({
        parent_id: ctx.userId,
        name: data.name,
        grade: data.grade ?? null,
        school_id: data.schoolId,
        home_address: data.address ?? null,
        emergency_contact: data.emergency ?? null,
        home_lat: data.lat,
        home_lng: data.lng,
      })
      .select("id")
      .single();
    if (error || !child) throw new Error(error?.message ?? "Could not add the child");

    let routeName: string | null = null;
    if (data.routeId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: route } = await supabaseAdmin
        .from("routes")
        .select("id, name, school_id, active, driver_id")
        .eq("id", data.routeId)
        .maybeSingle();
      if (!route || !route.active || route.school_id !== data.schoolId) {
        throw new Error("That van is not available for this school");
      }
      const { data: existing } = await supabaseAdmin
        .from("route_children")
        .select("seq")
        .eq("route_id", route.id)
        .order("seq", { ascending: false })
        .limit(1);
      const seq = ((existing?.[0]?.seq as number | undefined) ?? 0) + 1;
      const { error: linkError } = await supabaseAdmin
        .from("route_children")
        .insert({ route_id: route.id, child_id: child.id, seq });
      if (linkError) throw new Error(linkError.message);
      routeName = route.name as string;

      if (route.driver_id) {
        await supabaseAdmin.from("notifications").insert({
          user_id: route.driver_id,
          child_id: child.id,
          type: "CHILD_ADDED",
          title: "New child on your route",
          body: `${data.name} was added to ${route.name}.`,
        });
      }
    }

    await ctx.supabase.from("audit_logs").insert({
      actor: ctx.userId,
      action: "PARENT_ADD_CHILD",
      entity: "children",
      entity_id: child.id,
      meta: { routeId: data.routeId ?? null },
    });

    return { childId: child.id as string, routeName };
  });
