import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MLMap, Marker, StyleSpecification } from "maplibre-gl";

type MapLibreModule = typeof import("maplibre-gl");

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind: "vehicle" | "home" | "school" | "stop";
};

type Props = {
  markers: MapMarker[];
  path?: Array<[number, number]>;
  className?: string;
  follow?: boolean;
};

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

function markerEl(marker: MapMarker) {
  const el = document.createElement("div");
  const face =
    marker.kind === "vehicle"
      ? "🚌"
      : marker.kind === "home"
        ? "🏠"
        : marker.kind === "school"
          ? "🏫"
          : "📍";
  el.style.cssText =
    "display:flex;align-items:center;gap:6px;font:600 12px/1 var(--font-sans);white-space:nowrap;";
  el.innerHTML =
    `<span style="display:grid;place-items:center;width:34px;height:34px;border-radius:999px;` +
    `background:var(--color-card);border:2px solid ${
      marker.kind === "vehicle" ? "var(--color-accent)" : "var(--color-primary)"
    };box-shadow:var(--shadow-card);font-size:16px">${face}</span>` +
    `<span style="background:var(--color-card);color:var(--color-foreground);padding:3px 8px;border-radius:999px;` +
    `border:1px solid var(--color-border);box-shadow:var(--shadow-card)">${marker.label}</span>`;
  return el;
}

export default function LiveMap({ markers, path, className, follow = true }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerRefs = useRef<Map<string, Marker>>(new Map());
  const libRef = useRef<MapLibreModule | null>(null);
  const fittedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("maplibre-gl");
      const maplibre = mod.default ?? mod;
      if (cancelled || !container.current || mapRef.current) return;
      libRef.current = maplibre;
      const first = markers[0];
      const map = new maplibre.Map({
        container: container.current,
        style: STYLE,
        center: first ? [first.lng, first.lat] : [74.35, 31.52],
        zoom: 13,
        attributionControl: { compact: true },
      });
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRefs.current.clear();
      fittedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = libRef.current;
    if (!map || !maplibre) return;

    const apply = () => {
      const seen = new Set<string>();
      for (const marker of markers) {
        seen.add(marker.id);
        const existing = markerRefs.current.get(marker.id);
        if (existing) {
          existing.setLngLat([marker.lng, marker.lat]);
          const label = existing.getElement().querySelector("span:last-child");
          if (label) label.textContent = marker.label;
        } else {
          const m = new maplibre.Marker({ element: markerEl(marker), anchor: "left" })
            .setLngLat([marker.lng, marker.lat])
            .addTo(map);
          markerRefs.current.set(marker.id, m);
        }
      }
      for (const [id, m] of markerRefs.current) {
        if (!seen.has(id)) {
          m.remove();
          markerRefs.current.delete(id);
        }
      }

      const line = {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: path ?? [] },
      };
      if (map.getSource("route")) {
        (map.getSource("route") as GeoJSONSource).setData(line);
      } else if (path && path.length > 1) {
        map.addSource("route", { type: "geojson", data: line });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          paint: {
            "line-color": "#1f4d7a",
            "line-width": 4,
            "line-opacity": 0.6,
            "line-dasharray": [2, 1.5],
          },
        });
      }

      if (!fittedRef.current && markers.length) {
        const bounds = new maplibre.LngLatBounds();
        markers.forEach((m) => bounds.extend([m.lng, m.lat]));
        map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 0 });
        fittedRef.current = true;
      } else if (follow) {
        const vehicle = markers.find((m) => m.kind === "vehicle");
        if (vehicle) map.easeTo({ center: [vehicle.lng, vehicle.lat], duration: 900 });
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [markers, path, follow]);

  return <div ref={container} className={className ?? "h-full w-full"} />;
}
