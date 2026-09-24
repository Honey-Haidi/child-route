import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: SupabaseClient; userId: string };

async function rolesOf(ctx: Ctx): Promise<string[]> {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  return (data ?? []).map((r: { role: string }) => r.role);
}

async function adminClient(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

/** Load a route and make sure the caller is its driver (or an admin). */
async function assertRouteDriver(ctx: Ctx, admin: SupabaseClient, routeId: string) {
  const { data: route, error } = await admin
    .from("routes")
    .select("id, name, school_id, driver_id")
    .eq("id", routeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!route) throw new Error("Route not found");
  const roles = await rolesOf(ctx);
  if (route.driver_id !== ctx.userId && !roles.includes("admin")) throw new Error("Forbidden");
  return route as { id: string; name: string; school_id: string | null; driver_id: string | null };
}

/** Admin deletes a route. Blocked while a trip is running on it. */
export const deleteRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ routeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    if (!(await rolesOf(ctx)).includes("admin")) throw new Error("Forbidden");
    const admin = await adminClient();

    const { data: trips } = await admin.from("trips").select("id, status").eq("route_id", data.routeId);
    const all = (trips ?? []) as { id: string; status: string }[];
    if (all.some((t) => ["STARTED", "IN_PROGRESS", "DELAYED"].includes(t.status))) {
      throw new Error("A trip is running on this route. End it before deleting the route.");
    }
    const tripIds = all.map((t) => t.id);
    if (tripIds.length) {
      await admin.from("trip_events").delete().in("trip_id", tripIds);
      await admin.from("location_history").delete().in("trip_id", tripIds);
      await admin.from("vehicle_live").delete().in("trip_id", tripIds);
      await admin.from("notifications").delete().in("trip_id", tripIds);
      await admin.from("trip_children").delete().in("trip_id", tripIds);
      await admin.from("trips").delete().in("id", tripIds);
    }
    await admin.from("route_stops").delete().eq("route_id", data.routeId);
    await admin.from("route_children").delete().eq("route_id", data.routeId);
    const { error } = await admin.from("routes").delete().eq("id", data.routeId);
    if (error) throw new Error(error.message);

    await ctx.supabase.from("audit_logs").insert({
      actor: ctx.userId,
      action: "DELETE_ROUTE",
      entity: "routes",
      entity_id: data.routeId,
      meta: {},
    });
    return { ok: true };
  });

/** Driver roster: children on the route plus same-school children available to add. */
export const getDriverRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ routeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const admin = await adminClient();
    const route = await assertRouteDriver(ctx, admin, data.routeId);

    const { data: onRoute } = await admin
      .from("route_children")
      .select("child_id, seq, children(name, grade, home_address)")
      .eq("route_id", route.id)
      .order("seq");
    const assigned = ((onRoute ?? []) as unknown as {
      child_id: string;
      seq: number;
      children: { name: string; grade: string | null; home_address: string | null } | null;
    }[]).map((r) => ({
      id: r.child_id,
      seq: r.seq,
      name: r.children?.name ?? "Child",
      grade: r.children?.grade ?? null,
      address: r.children?.home_address ?? null,
    }));

    let available: { id: string; name: string; grade: string | null; address: string | null }[] = [];
    if (route.school_id) {
      const { data: kids } = await admin
        .from("children")
        .select("id, name, grade, home_address")
        .eq("school_id", route.school_id)
        .eq("active", true)
        .order("name");
      const taken = new Set(assigned.map((a) => a.id));
      available = ((kids ?? []) as { id: string; name: string; grade: string | null; home_address: string | null }[])
        .filter((k) => !taken.has(k.id))
        .map((k) => ({ id: k.id, name: k.name, grade: k.grade, address: k.home_address }));
    }
    return { assigned, available };
  });

/** Driver adds or removes a child on their own route. */
export const driverSetRouteChild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        routeId: z.string().uuid(),
        childId: z.string().uuid(),
        action: z.enum(["ADD", "REMOVE"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const admin = await adminClient();
    const route = await assertRouteDriver(ctx, admin, data.routeId);

    const { data: child } = await admin
      .from("children")
      .select("id, name, parent_id, school_id")
      .eq("id", data.childId)
      .maybeSingle();
    if (!child) throw new Error("Child not found");

    if (data.action === "ADD") {
      if (child.school_id !== route.school_id) throw new Error("This child goes to a different school");
      const { data: existing } = await admin
        .from("route_children")
        .select("id")
        .eq("route_id", route.id)
        .eq("child_id", child.id)
        .maybeSingle();
      if (!existing) {
        const { data: last } = await admin
          .from("route_children")
          .select("seq")
          .eq("route_id", route.id)
          .order("seq", { ascending: false })
          .limit(1)
          .maybeSingle();
        const { error } = await admin
          .from("route_children")
          .insert({ route_id: route.id, child_id: child.id, seq: ((last?.seq as number) ?? 0) + 1 });
        if (error) throw new Error(error.message);
      }
    } else {
      await admin.from("route_children").delete().eq("route_id", route.id).eq("child_id", child.id);
    }

    if (child.parent_id) {
      await admin.from("notifications").insert({
        user_id: child.parent_id,
        child_id: child.id,
        type: data.action === "ADD" ? "ROUTE_ASSIGNED" : "ROUTE_REMOVED",
        title: data.action === "ADD" ? "Added to a van route" : "Removed from a van route",
        body:
          data.action === "ADD"
            ? `${child.name} was added to ${route.name} by the driver.`
            : `${child.name} was removed from ${route.name} by the driver.`,
      });
    }
    await ctx.supabase.from("audit_logs").insert({
      actor: ctx.userId,
      action: data.action === "ADD" ? "ROUTE_ADD_CHILD" : "ROUTE_REMOVE_CHILD",
      entity: "routes",
      entity_id: route.id,
      meta: { child_id: child.id },
    });
    return { ok: true };
  });
