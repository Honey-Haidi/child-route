import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { driverSetRouteChild, getDriverRoster } from "@/lib/routes.functions";

export function DriverRoster({ routeId }: { routeId: string }) {
  const load = useServerFn(getDriverRoster);
  const setChild = useServerFn(driverSetRouteChild);
  const queryClient = useQueryClient();
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["driver-roster", routeId],
    queryFn: () => load({ data: { routeId } }),
  });

  async function run(childId: string, action: "ADD" | "REMOVE", name: string) {
    if (action === "REMOVE" && !confirm(`Remove ${name} from this route?`)) return;
    setBusy(true);
    try {
      await setChild({ data: { routeId, childId, action } });
      setPick("");
      await queryClient.invalidateQueries({ queryKey: ["driver-roster", routeId] });
      await queryClient.invalidateQueries({ queryKey: ["driver-routes"] });
      toast.success(action === "ADD" ? `${name} added` : `${name} removed`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading children…</p>;
  const assigned = data?.assigned ?? [];
  const available = data?.available ?? [];

  return (
    <div className="space-y-3">
      {assigned.length === 0 ? (
        <p className="text-sm text-muted-foreground">No children on this route yet.</p>
      ) : (
        <ul className="space-y-2">
          {assigned.map((c, i) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border p-3"
            >
              <div>
                <p className="font-medium">
                  {i + 1}. {c.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[c.grade, c.address].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => run(c.id, "REMOVE", c.name)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <select
          className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          value={pick}
          onChange={(e) => setPick(e.target.value)}
        >
          <option value="">
            {available.length ? "Add a child from this school…" : "No other children at this school"}
          </option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.grade ? ` (${c.grade})` : ""}
            </option>
          ))}
        </select>
        <Button
          disabled={!pick || busy}
          onClick={() => {
            const c = available.find((a) => a.id === pick);
            if (c) run(c.id, "ADD", c.name);
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
