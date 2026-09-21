import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { pushLocation } from "@/lib/trips.functions";

export type Ping = {
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  timestamp: string;
};

type WakeLockLike = { release: () => Promise<void> };
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request(type: "screen"): Promise<WakeLockLike> };
};

const SEND_EVERY_MS = 8000;
const bufferKey = (tripId: string) => `saferide.buffer.${tripId}`;

function readBuffer(tripId: string): Ping[] {
  try {
    return JSON.parse(localStorage.getItem(bufferKey(tripId)) ?? "[]") as Ping[];
  } catch {
    return [];
  }
}

function writeBuffer(tripId: string, pings: Ping[]) {
  try {
    localStorage.setItem(bufferKey(tripId), JSON.stringify(pings.slice(-200)));
  } catch {
    /* storage full — drop silently, live position still matters most */
  }
}

/**
 * Captures GPS from the driver's device while a trip is running, buffers pings
 * when the network drops, and replays them in order once it returns.
 */
export function useDriverTracking(tripId: string | null, enabled: boolean) {
  const send = useServerFn(pushLocation);
  const [last, setLast] = useState<Ping | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const lastRef = useRef<Ping | null>(null);
  const sendingRef = useRef(false);
  const wakeLockRef = useRef<WakeLockLike | null>(null);

  useEffect(() => {
    lastRef.current = last;
  }, [last]);

  const flush = useCallback(async () => {
    if (!tripId || sendingRef.current) return;
    sendingRef.current = true;
    try {
      const queue = readBuffer(tripId);
      if (lastRef.current) queue.push(lastRef.current);
      if (!queue.length) return;
      const remaining = [...queue];
      while (remaining.length) {
        const ping = remaining[0]!;
        try {
          await send({ data: { tripId, ...ping } });
          remaining.shift();
          setOnline(true);
        } catch {
          setOnline(false);
          break;
        }
      }
      writeBuffer(tripId, remaining);
      setPending(remaining.length);
    } finally {
      sendingRef.current = false;
    }
  }, [send, tripId]);

  useEffect(() => {
    if (!enabled || !tripId) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("This device cannot share its location.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setError(null);
        setLast({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speed: position.coords.speed ?? null,
          heading: position.coords.heading ?? null,
          accuracy: position.coords.accuracy ?? null,
          timestamp: new Date(position.timestamp).toISOString(),
        });
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );

    const interval = setInterval(flush, SEND_EVERY_MS);

    (async () => {
      try {
        const wl = (navigator as NavigatorWithWakeLock).wakeLock;
        wakeLockRef.current = wl ? await wl.request("screen") : null;
      } catch {
        /* wake lock unavailable — the driver must keep the screen on manually */
      }
    })();

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(interval);
      wakeLockRef.current?.release?.().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [enabled, tripId, flush]);

  return { last, error, online, pending, flush };
}
