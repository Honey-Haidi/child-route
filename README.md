# SafeRide — School Transport Live Tracking

A production-ready web application for school transport operators, parents, and drivers. SafeRide lets parents follow their child's school van in real time, lets drivers run morning and afternoon trips with GPS tracking, pickup/drop-off confirmation, and issue reporting, and gives school administrators a central dashboard to manage people, children, vehicles, routes, and trips.

Built with **TanStack Start**, **React 19**, **TypeScript**, **Tailwind CSS**, and **Lovable Cloud** (Postgres, auth, realtime, storage).

---

## What SafeRide does

### For parents
- Log in and see every registered child on one dashboard.
- View the child's current trip status, vehicle, driver, and ETA.
- Tap **Track** to open a live map showing the moving vehicle, home, school, route line, and distance/ETA card.
- Get in-app notifications for trip start, driver approaching, pickup confirmation, arrival at school, and safe drop-off.
- Browse trip history grouped by date.

### For drivers
- Log in to see assigned morning and afternoon routes.
- Start a trip with one tap; the app captures GPS automatically.
- See the route on a live map with the next stop highlighted.
- Mark each child as **Picked up**, **Dropped off**, or **Absent** with a confirmation step.
- Report delays, vehicle problems, or emergencies.
- End the trip and view a summary.
- Offline buffering: if the network drops, GPS pings are stored locally and replayed in order when connectivity returns.

### For school administrators
- Create parent, driver, and admin accounts.
- Register children, link them to parents and schools, and record pickup coordinates.
- Manage schools, vehicles, and driver assignments.
- Build routes, assign drivers/vehicles, add ordered stops, and attach children to routes.
- Monitor all active trips on a live fleet map.

---

## Architecture overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                         React web app                            │
│  Parent pages  │  Driver pages  │  Admin pages  │  Shared UI   │
└───────────────┬────────────────────────────────┬─────────────────┘
                │                                │
    TanStack Router + Start        TanStack Query + Supabase Realtime
                │                                │
                └──────────────┬─────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    createServerFn       Supabase Auth      Postgres Realtime
    (typed server fns)   (JWT + roles)      (vehicle_live, trips,
              │                │                trip_children, notifications)
              └────────────────┼────────────────┘
                               │
                        Lovable Cloud / Supabase
                        Postgres + RLS + storage
```

### Key design choices

| Requirement | Implementation |
|---|---|
| Backend services | Typed `createServerFn` server functions + TanStack API routes |
| Database | Postgres with Row Level Security (RLS) |
| Live location | Postgres Realtime over WebSocket; a hot `vehicle_live` row per active trip |
| Auth & roles | Supabase Auth JWT + separate `user_roles` table + security-definer helpers |
| Maps | MapLibre GL + OpenStreetMap tiles (no API key required; swappable adapter) |
| Driver GPS | Browser Geolocation API with wake-lock and localStorage offline buffering |
| Push alerts | In-app + realtime in MVP; FCM web-push ready for a later phase |

### Privacy model

Privacy is enforced in the database, not just the UI:

- **Parents** see only their own children and trips. They can see vehicle position only while one of their children is on an active trip.
- **Drivers** see only children assigned to the route they are currently driving.
- **Admins** see everything and manage the directory.
- Exact home coordinates are never exposed outside the child's own parent view; drivers see only the pickup point for children on their live trip.

---

## Database schema

Core tables:

```text
profiles(user_id, full_name, phone, photo_url)
user_roles(user_id, role)                    -- admin | driver | parent
parents(user_id)
drivers(user_id, license_no, license_expiry, active)
schools(id, name, lat, lng, geofence_m, active)
vehicles(id, reg_no, type, capacity, driver_id, active)
children(id, parent_id, name, photo, school_id, grade,
          home_lat, home_lng, home_geofence_m,
          emergency_contact, active)
routes(id, name, school_id, driver_id, vehicle_id,
       direction, est_minutes, active)
route_stops(route_id, seq, label, lat, lng)
route_children(route_id, child_id, seq, stop_id)
trips(id, route_id, driver_id, vehicle_id, trip_type, status,
      started_at, ended_at, eta_at)
trip_children(trip_id, child_id, status, seq,
              picked_at, pickup_lat/lng,
              dropped_at, dropoff_lat/lng, absent_reason)
vehicle_live(trip_id PK, lat, lng, speed, heading, accuracy, recorded_at)
location_history(trip_id, ts, lat, lng, speed, heading)
trip_events(trip_id, child_id, type, payload, at)
notifications(id, user_id, type, title, body, read_at)
device_tokens(user_id, token, platform)
audit_logs(actor, action, entity, entity_id, at, meta)
```

RLS policies ensure each role can read and write only what it owns or is explicitly allowed to manage.

---

## Project structure

```text
src/
  components/           # Shared UI: AppShell, LiveMap, MapPanel, RequireRole, admin/*
  integrations/
    supabase/           # Generated Supabase clients, auth middleware, attacher
  lib/                  # Business logic, hooks, server functions
    auth.tsx            # Session, role, profile, sign-out hooks
    geo.ts              # Coordinate math, distance, ETA, formatting
    status.ts           # Trip/child status labels, icons, tones
    admin.functions.ts  # Admin account creation & directory
    trips.functions.ts  # Trip lifecycle, GPS ingestion, geofencing, notifications
    parentData.ts       # Parent-side queries and types
    useDriverTracking.ts# Driver GPS capture + offline buffering
    useRealtime.ts      # Realtime subscription helper
  routes/               # TanStack file-based routes
    index.tsx           # Landing page
    auth.tsx            # Sign in / sign up / forgot password
    reset-password.tsx  # Password reset flow
    parent.index.tsx    # Parent dashboard
    parent.track.$childId.tsx
    parent.history.tsx
    parent.notifications.tsx
    driver.index.tsx    # Driver route list / trip start
    driver.trip.$tripId.tsx
    admin.index.tsx     # Admin overview
    admin.people.tsx    # Manage accounts
    admin.children.tsx  # Manage children
    admin.fleet.tsx     # Schools & vehicles
    admin.routes.tsx    # Routes, stops & assignments
  styles.css            # SafeRide design tokens, Tailwind v4 theme
  router.tsx            # TanStack Router setup
  start.ts              # Start instance with auth middleware
  server.ts             # Server entry
```

---

## Development

### Requirements
- Node.js 20+ or Bun 1.1+
- A Lovable Cloud / Supabase project (or local Supabase)

### Install

```sh
bun install
# or
npm install
```

### Environment

The Lovable-managed environment variables are generated automatically:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

### Run locally

```sh
bun dev
# or
npm run dev
```

The dev server starts on `http://localhost:8080`.

### Typecheck

```sh
bunx tsgo --noEmit -p tsconfig.json
```

### Build

```sh
bun run build
# or
npm run build
```

---

## Android APK (Capacitor)

The project includes a Capacitor Android wrapper (`android/`) that loads the hosted app, so login, GPS and realtime tracking work exactly as in the browser.

To build the APK on your own computer:

1. Install [Android Studio](https://developer.android.com/studio) (includes the Android SDK).
2. Clone this project and run `bun install`.
3. Publish the app in Lovable, then set `server.url` in `capacitor.config.ts` to your published URL.
4. Run `bun run android:sync` then `bun run android:open` to open Android Studio.
5. In Android Studio: **Build → Build App Bundle(s)/APK(s) → Build APK(s)**. The APK is written to `android/app/build/outputs/apk/debug/`.

For a release/Play Store build, use **Build → Generate Signed App Bundle/APK** with your own keystore.

Location, wake-lock and network permissions are already declared in `android/app/src/main/AndroidManifest.xml` for driver GPS tracking.

---

## Seeded demo data

The migration seeds a demo environment so you can test every role immediately:

- **School**: Springfield Elementary
- **Vehicle**: Van KHI-2024 (capacity 14)
- **Driver**: driver@saferide.demo / `Driver@123`
- **Parent**: parent@saferide.demo / `Parent@123`
- **Children**: Ali, Sara, Ahmed
- **Route**: Morning home → school route with ordered stops

Use these credentials to sign in and try parent tracking, driver trip flow, and admin management.

---

## User roles & first pages

| Role | First page after login | Key actions |
|---|---|---|
| `parent` | `/parent` | View children, track live trip, history, notifications |
| `driver` | `/driver` | Start/end trips, share GPS, mark pickup/drop-off |
| `admin` | `/admin` | Manage accounts, children, fleet, routes, monitor trips |

---

## Important limitations

1. **Background GPS on mobile web**: The driver must keep the trip screen open and the screen awake. iOS and Android browsers throttle or stop Geolocation when the screen is locked. For true background tracking a native driver app is required.
2. **Push notifications**: The MVP uses in-app notifications via Supabase Realtime. Web push / FCM integration is planned for a later phase.
3. **ETA**: MVP ETA is straight-line distance along remaining stops divided by a rolling average speed. Road-aware ETA can be added by swapping in a routing provider (Google Maps, Mapbox, OSRM) and supplying an API key.

---

## Roadmap

- [x] Foundation: auth, roles, schema, RLS, design system, demo data
- [x] Admin management: accounts, children, fleet, routes
- [x] Driver trip flow with GPS, offline buffering, pickup/drop-off
- [x] Parent dashboard, live tracking, history, notifications
- [x] Realtime vehicle updates on the parent map
- [ ] Geofence-driven push alerts (FCM web push)
- [ ] Audit log viewer and reporting screens
- [ ] Native driver app for reliable background GPS
- [ ] Road-aware ETA and route optimization

---

## License

This project was generated with [Lovable](https://lovable.dev) and is owned by the project creator. Modify and deploy it as needed.
