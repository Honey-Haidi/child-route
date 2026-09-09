# SafeRide — School Transport Live Tracking

## 1. Platform reality (read first)

Your brief specifies Java 21 / Spring Boot / Flutter. This environment builds a **React web application** with a managed Postgres backend (Lovable Cloud: database, auth, storage, realtime, server functions). It cannot produce a Spring Boot service or native Android/iOS binaries.

What we build instead, keeping every functional requirement:

| Your spec | Here |
|---|---|
| Spring Boot REST services | Typed server functions + REST routes under `/api` |
| PostgreSQL | Postgres (managed), with row-level security |
| Redis live state + WebSocket | Postgres Realtime (WebSocket) + a "live location" table holding one hot row per trip |
| JWT + roles | Managed auth, JWT, role table + policies |
| Flutter driver app | Installable mobile web (PWA) driver mode using the browser Geolocation API with wake-lock and offline buffering |
| FCM push | Web push via FCM connector (later phase); in-app + realtime alerts in MVP |
| Google Maps | MapLibre + OpenStreetMap tiles behind a thin provider adapter so it can be swapped |

Trade-off to accept: **background** GPS when the driver's phone is locked is not reliable on mobile web (iOS especially). Driver mode is a foreground "trip screen" that must stay open with screen-wake enabled during a trip. If true background tracking is required, that needs a native app outside this platform.

## 2. Roles and privacy model

- `ROLE_PARENT` — sees only their own children, their active trips, and vehicle position only while a trip involving their child is active.
- `ROLE_DRIVER` — sees only children on the trip they currently run; sees a pickup point only for the current/next stop.
- `ROLE_ADMIN` — full management, all active vehicles map.

Enforced in the database with row-level security, not in the UI. Roles live in a separate `user_roles` table checked by a security-definer function (never on the profile row). Exact home coordinates are never returned to any parent but the child's own; drivers get the pickup point only for children on their live trip.

## 3. Data model

```text
profiles(user_id, name, phone, photo)
user_roles(user_id, role)
schools(id, name, lat, lng, geofence_m)
parents(user_id)                drivers(user_id, license_no, license_expiry, active)
vehicles(id, reg_no, type, capacity, driver_id, active)
children(id, parent_id, name, photo, school_id, grade, home_lat, home_lng,
         home_geofence_m, emergency_contact, active)
routes(id, name, school_id, driver_id, vehicle_id, direction, est_minutes, active)
route_stops(route_id, seq, label, lat, lng)
route_children(route_id, child_id, seq, stop_id)
trips(id, route_id, driver_id, vehicle_id, trip_type, status,
      started_at, ended_at, eta_at)
trip_children(trip_id, child_id, status, seq, picked_at, pickup_lat/lng,
              dropped_at, dropoff_lat/lng, absent_reason)
vehicle_live(trip_id PK, lat, lng, speed, heading, accuracy, recorded_at)  -- hot row, realtime
location_history(trip_id, ts, lat, lng, speed, heading)                    -- append-only, pruned
trip_events(trip_id, child_id, type, payload, at)                          -- geofence + workflow log
notifications(id, user_id, type, title, body, read_at)
device_tokens(user_id, token, platform)
audit_logs(actor, action, entity, entity_id, at, meta)
```

Location strategy: every ping upserts one row in `vehicle_live` (what parents subscribe to) and appends to `location_history`, which is thinned to ~1 point/30s once a trip completes and purged after 30 days.

## 4. Trip state machine

Trip: `SCHEDULED → STARTED → IN_PROGRESS → COMPLETED`, with `DELAYED` / `CANCELLED` branches.
Child: `WAITING_FOR_PICKUP → DRIVER_APPROACHING → PICKED_UP → ON_THE_WAY → ARRIVED_AT_SCHOOL | DROPPED_OFF`, plus `ABSENT` / `CANCELLED`.
Trip types: `MORNING_HOME_TO_SCHOOL`, `AFTERNOON_SCHOOL_TO_HOME`.

Geofencing runs **server-side** on each accepted GPS ping: entering a child's home radius (default 200 m) sets `DRIVER_APPROACHING`; entering the school radius (default 100 m) sets `ARRIVED_AT_SCHOOL`. Geofences never mark a child picked up or dropped off — that is always an explicit driver tap, with the confirmation step designed as a pluggable verifier so QR/PIN/parent-confirm can be added later.

## 5. GPS ingestion and validation

Driver device posts every 5–10 s (or 50 m moved):
`{tripId, lat, lng, speed, heading, accuracy, timestamp}`

Server rejects or flags: pings for a trip the driver doesn't own, accuracy > 100 m, timestamps in the future or older than 5 min, and implied speed > 150 km/h between consecutive points (teleport check). Offline: the driver app buffers pings locally and replays them in order with original timestamps on reconnect. Parents see "connection temporarily unavailable" when the last ping is older than 45 s — never a stale marker presented as live.

Tracking runs only while a trip is `STARTED`/`IN_PROGRESS`; ending the trip deletes the `vehicle_live` row.

## 6. Screens

**Parent** — Dashboard (one card per child: status, ETA, Track button) · Live tracking map (vehicle, home, school, route line, driver/vehicle/ETA/distance card) · Child profile · Trip history · Notifications.

**Driver** — Today (start morning / afternoon trip) · Active trip (map, next stop, remaining children, per-child Picked up / Dropped off / Absent) · Report issue (delay, vehicle, emergency) · Trip summary.

**Admin** — Live map of all active vehicles · Parents · Children · Drivers · Vehicles · Schools · Routes & stops · Assignments · Trips & history · Reports.

## 7. Build phases

1. **Foundation** — backend enable, schema + RLS + roles, auth (parent/driver/admin), design system, seeded demo school/route/children.
2. **Management** — admin CRUD for schools, parents, children, drivers, vehicles, routes, stops, assignments.
3. **Trips** — start/end morning + afternoon trips, driver trip screen, pickup/dropoff/absent, status machine, trip history.
4. **Live tracking** — GPS capture + validation, `vehicle_live` realtime, parent map with moving marker, ETA and distance, offline buffering.
5. **Geofencing + alerts** — approach/arrival events, in-app notification centre, delay/cancel/emergency.
6. **Hardening** — audit log, rate limits, unauthorized-access tests, reports, push notifications via FCM.

## 8. Decisions I need from you

- Map provider: MapLibre + OpenStreetMap (no key, free) is my recommendation for MVP; Google/Mapbox give traffic-aware ETA but need a paid key.
- ETA in MVP is road-distance-free: straight-line distance along remaining stops ÷ rolling average speed, upgraded to a routing provider in phase 4 if you supply a key.
- Demo data: I'll seed one school, one route, one driver, one parent with three children (Ali, Sara, Ahmed) so all flows are testable immediately.
