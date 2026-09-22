import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/AppShell";
import { RequireRole } from "@/components/RequireRole";
import { Field, Panel } from "@/components/admin/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { addChild, listRoutesForSchool } from "@/lib/parent.functions";

export const Route = createFileRoute("/parent/add-child")({
  head: () => ({
    meta: [
      { title: "Add a child — SafeRide" },
      {
        name: "description",
        content: "Register your child for school transport tracking with their home pickup point.",
      },
      { property: "og:title", content: "Add a child — SafeRide" },
      {
        property: "og:description",
        content: "Register your child and home pickup point for SafeRide tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireRole role="parent">
      <AddChild />
    </RequireRole>
  ),
});

const schema = z.object({
  name: z.string().trim().min(2, "Enter your child's full name").max(80),
  grade: z.string().trim().max(40).optional(),
  schoolId: z.string().uuid("Choose the school"),
  address: z.string().trim().max(200).optional(),
  emergency: z.string().trim().max(40).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

function AddChild() {
  const { userId } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: schools = [] } = useQuery({
    queryKey: ["schools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, lat, lng")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [address, setAddress] = useState("");
  const [emergency, setEmergency] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("This device cannot share a location");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
        toast.success("Pickup point set to where you are now");
      },
      () => {
        setLocating(false);
        toast.error("Could not read your location — enter it manually");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse({
      name,
      grade: grade || undefined,
      schoolId,
      address: address || undefined,
      emergency: emergency || undefined,
      lat: Number(lat),
      lng: Number(lng),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setSaving(true);
    const v = parsed.data;
    const { error } = await supabase.from("children").insert({
      parent_id: userId!,
      name: v.name,
      grade: v.grade ?? null,
      school_id: v.schoolId,
      home_address: v.address ?? null,
      emergency_contact: v.emergency ?? null,
      home_lat: v.lat,
      home_lng: v.lng,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["children", userId] });
    toast.success(`${v.name} added — the school will place them on a route`);
    navigate({ to: "/parent" });
  }

  return (
    <AppShell
      title="Add a child"
      subtitle="Tell us who to track and where the van should collect them."
      nav={
        <Button asChild variant="ghost" size="sm">
          <Link to="/parent">Back</Link>
        </Button>
      }
    >
      <form onSubmit={submit} className="grid gap-4 md:max-w-2xl">
        <Panel title="Child details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
              />
            </Field>
            <Field label="Class / grade">
              <Input
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                maxLength={40}
                placeholder="Grade 4"
              />
            </Field>
            <Field label="School">
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                required
              >
                <option value="">Select a school</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Emergency contact">
              <Input
                value={emergency}
                onChange={(e) => setEmergency(e.target.value)}
                maxLength={40}
                placeholder="+92 300 1234567"
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Home pickup point">
          <div className="grid gap-3">
            <Field label="Home address">
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={200}
                placeholder="House 12, Street 4, Block B"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Latitude">
                <Input
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  inputMode="decimal"
                  required
                />
              </Field>
              <Field label="Longitude">
                <Input
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  inputMode="decimal"
                  required
                />
              </Field>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-fit"
              disabled={locating}
              onClick={useCurrentLocation}
            >
              {locating ? "Getting location…" : "Use my current location"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Stand at the pickup spot and tap the button, or type the coordinates yourself.
            </p>
          </div>
        </Panel>

        <Button type="submit" className="h-12 text-base" disabled={saving}>
          {saving ? "Saving…" : "Add child"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Once added, your school assigns the child to a van and driver. Tracking starts with the
          next trip.
        </p>
      </form>
    </AppShell>
  );
}
