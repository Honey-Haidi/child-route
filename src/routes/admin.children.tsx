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
import { deleteChild, listAccounts } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/children")({
  head: () => ({
    meta: [
      { title: "Children — SafeRide admin" },
      {
        name: "description",
        content:
          "Register each child with their family, school, pickup point and emergency contact.",
      },
      { property: "og:title", content: "Children — SafeRide admin" },
      {
        property: "og:description",
        content: "Register children with family, school and pickup point.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireRole role="admin">
      <ChildrenAdmin />
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

function ChildrenAdmin() {
  const queryClient = useQueryClient();
  const list = useServerFn(listAccounts);
  const removeChildFn = useServerFn(deleteChild);

  const { data: accounts = [] } = useQuery({ queryKey: ["admin-accounts"], queryFn: () => list() });
  const parents = accounts.filter((a) => a.role === "parent");

  const { data: schools = [] } = useQuery({
    queryKey: ["admin-schools"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: children = [], isLoading } = useQuery({
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

  const [form, setForm] = useState({
    name: "",
    grade: "",
    parent_id: "",
    school_id: "",
    home_address: "",
    home_lat: "",
    home_lng: "",
    home_geofence_m: "200",
    emergency_contact: "",
  });

  const addChild = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("children").insert({
        name: form.name,
        grade: form.grade || null,
        parent_id: form.parent_id || null,
        school_id: form.school_id || null,
        home_address: form.home_address || null,
        home_lat: Number(form.home_lat),
        home_lng: Number(form.home_lng),
        home_geofence_m: Number(form.home_geofence_m) || 200,
        emergency_contact: form.emergency_contact || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Child added");
      setForm({
        ...form,
        name: "",
        grade: "",
        home_address: "",
        home_lat: "",
        home_lng: "",
        emergency_contact: "",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-children"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setParent = useMutation({
    mutationFn: async (args: { id: string; parentId: string | null }) => {
      const { error } = await supabase
        .from("children")
        .update({ parent_id: args.parentId })
        .eq("id", args.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-children"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeChild = useMutation({
    mutationFn: (childId: string) => removeChildFn({ data: { childId } }),
    onSuccess: () => {
      toast.success("Child removed");
      queryClient.invalidateQueries({ queryKey: ["admin-children"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const parentName = (id: string | null) => {
    const p = parents.find((x) => x.id === id);
    return p ? p.fullName || p.email : "No family linked";
  };

  return (
    <AppShell title="Children" subtitle="Every child, their family and pickup point.">
      <AdminNav />
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Panel title="Add a child">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              addChild.mutate();
            }}
          >
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Class / grade">
                <Input
                  value={form.grade}
                  onChange={(e) => setForm({ ...form, grade: e.target.value })}
                />
              </Field>
              <Field label="Emergency contact">
                <Input
                  value={form.emergency_contact}
                  onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Family">
              <select
                className={selectClass}
                value={form.parent_id}
                onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
              >
                <option value="">Link later</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName || p.email}
                  </option>
                ))}
              </select>
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
            <Field label="Home address">
              <Input
                value={form.home_address}
                onChange={(e) => setForm({ ...form, home_address: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Latitude">
                <Input
                  value={form.home_lat}
                  onChange={(e) => setForm({ ...form, home_lat: e.target.value })}
                  required
                />
              </Field>
              <Field label="Longitude">
                <Input
                  value={form.home_lng}
                  onChange={(e) => setForm({ ...form, home_lng: e.target.value })}
                  required
                />
              </Field>
              <Field label="Pickup zone (m)">
                <Input
                  value={form.home_geofence_m}
                  onChange={(e) => setForm({ ...form, home_geofence_m: e.target.value })}
                />
              </Field>
            </div>
            <Button type="submit" className="w-full" disabled={addChild.isPending}>
              Add child
            </Button>
          </form>
        </Panel>

        <Panel title="Registered children">
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-2">
              {children.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {c.name}
                      {c.grade ? ` · ${c.grade}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {c.schools?.name ?? "No school"} · {parentName(c.parent_id)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={c.parent_id ?? ""}
                      onChange={(e) =>
                        setParent.mutate({ id: c.id, parentId: e.target.value || null })
                      }
                    >
                      <option value="">No family</option>
                      {parents.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.fullName || p.email}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={removeChild.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove ${c.name}? They will be taken off every route and their trip history is deleted.`,
                          )
                        ) {
                          removeChild.mutate(c.id);
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
