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

export const Route = createFileRoute("/admin/fleet")({
  head: () => ({
    meta: [
      { title: "Schools & vehicles — SafeRide admin" },
      { name: "description", content: "Register schools with their arrival zone and add the vans and buses that serve them." },
      { property: "og:title", content: "Schools & vehicles — SafeRide admin" },
      { property: "og:description", content: "Register schools and the vehicles that serve them." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireRole role="admin">
      <Fleet />
    </RequireRole>
  ),
});

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function Fleet() {
  const queryClient = useQueryClient();
  const list = useServerFn(listAccounts);

  const { data: schools = [] } = useQuery({
    queryKey: ["admin-schools"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["admin-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").order("reg_no");
      if (error) throw error;
      return data;
    },
  });

  const { data: accounts = [] } = useQuery({ queryKey: ["admin-accounts"], queryFn: () => list() });
  const drivers = accounts.filter((a) => a.role === "driver");

  const [school, setSchool] = useState({ name: "", address: "", lat: "", lng: "", geofence_m: "150" });
  const [vehicle, setVehicle] = useState({ reg_no: "", vehicle_type: "VAN", capacity: "15", driver_id: "" });

  const addSchool = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("schools").insert({
        name: school.name,
        address: school.address || null,
        lat: Number(school.lat),
        lng: Number(school.lng),
        geofence_m: Number(school.geofence_m) || 150,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("School added");
      setSchool({ name: "", address: "", lat: "", lng: "", geofence_m: "150" });
      queryClient.invalidateQueries({ queryKey: ["admin-schools"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addVehicle = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vehicles").insert({
        reg_no: vehicle.reg_no,
        vehicle_type: vehicle.vehicle_type,
        capacity: Number(vehicle.capacity) || 15,
        driver_id: vehicle.driver_id || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Vehicle added");
      setVehicle({ reg_no: "", vehicle_type: "VAN", capacity: "15", driver_id: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-vehicles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignVehicleDriver = useMutation({
    mutationFn: async (args: { id: string; driverId: string | null }) => {
      const { error } = await supabase.from("vehicles").update({ driver_id: args.driverId }).eq("id", args.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-vehicles"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Schools & vehicles" subtitle="Where the runs finish, and what does the driving.">
      <AdminNav />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Add a school">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              addSchool.mutate();
            }}
          >
            <Field label="Name">
              <Input value={school.name} onChange={(e) => setSchool({ ...school, name: e.target.value })} required />
            </Field>
            <Field label="Address">
              <Input value={school.address} onChange={(e) => setSchool({ ...school, address: e.target.value })} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Latitude">
                <Input value={school.lat} onChange={(e) => setSchool({ ...school, lat: e.target.value })} required />
              </Field>
              <Field label="Longitude">
                <Input value={school.lng} onChange={(e) => setSchool({ ...school, lng: e.target.value })} required />
              </Field>
              <Field label="Arrival zone (m)">
                <Input
                  value={school.geofence_m}
                  onChange={(e) => setSchool({ ...school, geofence_m: e.target.value })}
                />
              </Field>
            </div>
            <Button type="submit" disabled={addSchool.isPending}>Add school</Button>
          </form>

          <div className="mt-4 space-y-2">
            {schools.map((s) => (
              <div key={s.id} className="rounded-xl border border-border p-3">
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-muted-foreground">{s.address ?? `${s.lat}, ${s.lng}`}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Add a vehicle">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              addVehicle.mutate();
            }}
          >
            <Field label="Registration number">
              <Input value={vehicle.reg_no} onChange={(e) => setVehicle({ ...vehicle, reg_no: e.target.value })} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select
                  className={selectClass}
                  value={vehicle.vehicle_type}
                  onChange={(e) => setVehicle({ ...vehicle, vehicle_type: e.target.value })}
                >
                  <option value="VAN">Van</option>
                  <option value="BUS">Bus</option>
                  <option value="CAR">Car</option>
                </select>
              </Field>
              <Field label="Seats">
                <Input value={vehicle.capacity} onChange={(e) => setVehicle({ ...vehicle, capacity: e.target.value })} />
              </Field>
            </div>
            <Field label="Driver">
              <select
                className={selectClass}
                value={vehicle.driver_id}
                onChange={(e) => setVehicle({ ...vehicle, driver_id: e.target.value })}
              >
                <option value="">Not assigned</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName || d.email}
                  </option>
                ))}
              </select>
            </Field>
            <Button type="submit" disabled={addVehicle.isPending}>Add vehicle</Button>
          </form>

          <div className="mt-4 space-y-2">
            {vehicles.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
                <div>
                  <p className="font-medium">{v.reg_no}</p>
                  <p className="text-sm text-muted-foreground">
                    {v.vehicle_type} · {v.capacity} seats
                  </p>
                </div>
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={v.driver_id ?? ""}
                  onChange={(e) => assignVehicleDriver.mutate({ id: v.id, driverId: e.target.value || null })}
                >
                  <option value="">No driver</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName || d.email}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
