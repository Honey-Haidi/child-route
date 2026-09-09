import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Invalidate the given query keys whenever any of the tables change. */
export function useRealtimeInvalidate(
  channelName: string,
  tables: string[],
  keys: unknown[][],
  filter?: string,
) {
  const queryClient = useQueryClient();
  const tableKey = tables.join(",");
  const keyKey = JSON.stringify(keys);

  useEffect(() => {
    const channel = supabase.channel(channelName);
    for (const table of tables) {
      channel.on(
        "postgres_changes",
        (filter
          ? { event: "*", schema: "public", table, filter }
          : { event: "*", schema: "public", table }) as any,
        () => {
          for (const key of keys) queryClient.invalidateQueries({ queryKey: key });
        },
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, tableKey, keyKey, filter]);
}
