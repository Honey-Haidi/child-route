import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { RequireRole } from "@/components/RequireRole";
import { AdminNav } from "@/components/admin/AdminNav";
import { Field, Panel } from "@/components/admin/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { listAccounts } from "@/lib/admin.functions";
import { deleteRoute } from "@/lib/routes.functions";

export const Route = createFileRoute("/admin/routes")({
  head: () => ({
    meta: [
      { title: "Routes & assignments — SafeRide admin" },
      {
        name: "description",
        content:
          "Build school runs, assign a driver and vehicle, and choose which children travel on each route.",
      },
      { property: "og:title", content: "Routes & assignments — SafeRide admin" },
      {
        property: "og:description",
        content: "Build school runs and assign drivers, vehicles and children.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireRole role="admin">
      <RoutesAdmin />
    </RequireRole>
  ),
});

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

type AdminChildRow = {
  id: string;
  name: string;
  grade: string | null;
  parent_id: string | null;
  school_id: string | null;
  home_address: string | null;
  home_lat: number | null;
  home_lng: number | null;
  active: boolean;
  schools: { name: string } | null;
};

type AdminRouteRow = {
  id: string;
  name: string;
  school_id: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
  est_minutes: number | null;
  active: boolean;
  schools: { name: string } | null;
  vehicles: { reg_no: string } | null;
  route_children: { child_id: string }[] | null;
};

function RoutesAdmin() {
  const queryClient = useQueryClient();
  const list = useServerFn(listAccounts);
  const [selected, setSelected] = useState<string | null>(null);
  const removeRoute = useServerFn(deleteRoute);
  const [deleting, setDeleting] = useState(false);

  const { data: accounts = [] } = useQuery({ queryKey: ["admin-accounts"], queryFn: () => list() });
  const drivers = accounts.filter((a) => a.role === "driver");
  const nameOf = (id: string | null) => {
    const d = accounts.find((a) => a.id === id);
    return d ? d.fullName || d.email : "No driver";
  };

  const { data: schools = [] } = useQuery({
    queryKey: ["admin-schools"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["admin-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("id, reg_no").order("reg_no");
      if (error) throw error;
      return data;
    },
  });

  const { data: children = [] } = useQuery({
    queryKey: ["admin-children"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select(
          "id, name, grade, parent_id, school_id, home_address, home_lat, home_lng, active, schools(name)",
        )
        .order("name");
      if (error) throw error;
      return data as AdminChildRow[];
    },
  });

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ["admin-routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(
          "id, name, school_id, driver_id, vehicle_id, est_minutes, active, schools(name), vehicles(reg_no), route_children(child_id)",
        )
        .order("name");
      if (error) throw error;
      return data as AdminRouteRow[];
    },
  });

  const current = routes.find((r) => r.id === selected) ?? null;

  const { data: stops = [] } = useQuery({
    queryKey: ["admin-stops", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_stops")
        .select("id, seq, label, lat, lng")
        .eq("route_id", selected!)
        .order("seq");
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    name: "",
    school_id: "",
    driver_id: "",
    vehicle_id: "",
    est_minutes: "45",
  });
  const [stop, setStop] = useState({ label: "", lat: "", lng: "" });

  const addRoute = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("routes").insert({
        name: form.name,
        school_id: form.school_id || null,
        driver_id: form.driver_id || null,
        vehicle_id: form.vehicle_id || null,
        est_minutes: Number(form.est_minutes) || 45,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Route created");
      setForm({ name: "", school_id: "", driver_id: "", vehicle_id: "", est_minutes: "45" });
      queryClient.invalidateQueries({ queryKey: ["admin-routes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRoute = useMutation({
    mutationFn: async (patch: {
      driver_id?: string | null;
      vehicle_id?: string | null;
      active?: boolean;
    }) => {
      const { error } = await supabase.from("routes").update(patch).eq("id", selected!);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-routes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleChild = useMutation({
    mutationFn: async (args: { childId: string; on: boolean; seq: number }) => {
      if (args.on) {
        const { error } = await supabase
          .from("route_children")
          .insert({ route_id: selected!, child_id: args.childId, seq: args.seq });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("route_children")
          .delete()
          .eq("route_id", selected!)
          .eq("child_id", args.childId);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-routes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const addStop = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("route_stops").insert({
        route_id: selected!,
        seq: (stops.length ?? 0) + 1,
        label: stop.label,
        lat: Number(stop.lat),
        lng: Number(stop.lng),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setStop({ label: "", lat: "", lng: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-stops", selected] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignedIds: string[] = (current?.route_children ?? []).map((rc) => rc.child_id);

  return (
    <AppShell
      title="Routes & assignments"
      subtitle="Build a run, give it a driver and vehicle, then add the children."
    >
      <AdminNav />
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <Panel title="Create a route">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                addRoute.mutate();
              }}
            >
              <Field label="Route name">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </Field>
              <Field label="School">
                <select
                  className={selectClass}
                  value={form.school_id}
                  onChange={(e) => setForm({ ...form, school_id: e.target.value })}
                >
                  <option value="">Choose a school</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Driver">
                <select
                  className={selectClass}
                  value={form.driver_id}
                  onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
                >
                  <option value="">Assign later</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName || d.email}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Vehicle">
                  <select
                    className={selectClass}
                    value={form.vehicle_id}
                    onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                  >
                    <option value="">Assign later</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.reg_no}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Typical minutes">
                  <Input
                    value={form.est_minutes}
                    onChange={(e) => setForm({ ...form, est_minutes: e.target.value })}
                  />
                </Field>
              </div>
              <Button type="submit" className="w-full" disabled={addRoute.isPending}>
                Create route
              </Button>
            </form>
          </Panel>

          <Panel title="Routes">
            {isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-2">
                {routes.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelected(r.id)}
                    className={`w-full rounded-xl border p-3 text-left ${
                      selected === r.id ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <p className="font-medium">{r.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {r.schools?.name ?? "No school"} · {nameOf(r.driver_id)} ·{" "}
                      {r.vehicles?.reg_no ?? "No vehicle"} · {(r.route_children ?? []).length}{" "}
                      children
                    </p>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {current ? (
          <div className="space-y-5">
            <Panel title={`${current.name} — assignments`}>
              <div className="mb-3 flex justify-end">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  onClick={async () => {
                    if (
                      !confirm(
                        `Delete route "${current.name}"? Its stops, children list and trip history will be removed.`,
                      )
                    )
                      return;
                    setDeleting(true);
                    try {
                      await removeRoute({ data: { routeId: current.id } });
                      setSelected(null);
                      await queryClient.invalidateQueries();
                      toast.success("Route deleted");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not delete route");
                    } finally {
                      setDeleting(false);
                    }
                  }}
                >
                  Delete route
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Driver">
                  <select
                    className={selectClass}
                    value={current.driver_id ?? ""}
                    onChange={(e) => updateRoute.mutate({ driver_id: e.target.value || null })}
                  >
                    <option value="">No driver</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName || d.email}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Vehicle">
                  <select
                    className={selectClass}
                    value={current.vehicle_id ?? ""}
                    onChange={(e) => updateRoute.mutate({ vehicle_id: e.target.value || null })}
                  >
                    <option value="">No vehicle</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.reg_no}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!current.active}
                  onChange={(e) => updateRoute.mutate({ active: e.target.checked })}
                />
                Route is in service
              </label>
            </Panel>

            <Panel title="Children on this route">
              <div className="space-y-2">
                {children.map((c) => {
                  const on = assignedIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          toggleChild.mutate({
                            childId: c.id,
                            on: e.target.checked,
                            seq: assignedIds.length + 1,
                          })
                        }
                      />
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">{c.home_address ?? ""}</span>
                    </label>
                  );
                })}
                {children.length === 0 ? (
                  <p className="text-muted-foreground">Add children first.</p>
                ) : null}
              </div>
            </Panel>

            <Panel title="Stops">
              <div className="mb-3 space-y-2">
                {stops.map((s) => (
                  <div key={s.id} className="rounded-xl border border-border p-3 text-sm">
                    <span className="font-medium">
                      {s.seq}. {s.label}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {s.lat}, {s.lng}
                    </span>
                  </div>
                ))}
              </div>
              <form
                className="grid gap-3 sm:grid-cols-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  addStop.mutate();
                }}
              >
                <Field label="Stop name">
                  <Input
                    value={stop.label}
                    onChange={(e) => setStop({ ...stop, label: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Latitude">
                  <Input
                    value={stop.lat}
                    onChange={(e) => setStop({ ...stop, lat: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Longitude">
                  <Input
                    value={stop.lng}
                    onChange={(e) => setStop({ ...stop, lng: e.target.value })}
                    required
                  />
                </Field>
                <div className="flex items-end">
                  <Button type="submit" className="w-full" disabled={addStop.isPending}>
                    Add stop
                  </Button>
                </div>
              </form>
            </Panel>
          </div>
        ) : (
          <Panel title="Pick a route">
            <p className="text-muted-foreground">
              Choose a route on the left to assign a driver, vehicle and children.
            </p>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
