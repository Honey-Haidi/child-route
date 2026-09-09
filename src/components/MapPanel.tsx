import { Suspense, lazy } from "react";
import { ClientOnly } from "@tanstack/react-router";

import type { MapMarker } from "./LiveMap";

const LiveMap = lazy(() => import("./LiveMap"));

function MapSkeleton({ className }: { className?: string | undefined }) {
  return (
    <div
      className={`${className ?? "h-full w-full"} grid place-items-center rounded-xl bg-muted text-sm text-muted-foreground`}
    >
      Loading map…
    </div>
  );
}

export default function MapPanel(props: {
  markers: MapMarker[];
  path?: Array<[number, number]>;
  className?: string;
  follow?: boolean;
}) {
  return (
    <ClientOnly fallback={<MapSkeleton className={props.className} />}>
      <Suspense fallback={<MapSkeleton className={props.className} />}>
        <LiveMap {...props} />
      </Suspense>
    </ClientOnly>
  );
}
