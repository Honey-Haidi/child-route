
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','driver','parent');
CREATE TYPE public.trip_type AS ENUM ('MORNING_HOME_TO_SCHOOL','AFTERNOON_SCHOOL_TO_HOME');
CREATE TYPE public.trip_status AS ENUM ('SCHEDULED','STARTED','IN_PROGRESS','COMPLETED','CANCELLED','DELAYED');
CREATE TYPE public.child_trip_status AS ENUM ('WAITING_FOR_PICKUP','DRIVER_APPROACHING','PICKED_UP','ON_THE_WAY','ARRIVED_AT_SCHOOL','DROPPED_OFF','ABSENT','CANCELLED');

-- UTIL
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  phone text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'parent'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- DRIVERS
CREATE TABLE public.drivers (
  user_id uuid PRIMARY KEY,
  license_no text,
  license_expiry date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- SCHOOLS
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  geofence_m integer NOT NULL DEFAULT 150,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- VEHICLES
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reg_no text NOT NULL UNIQUE,
  vehicle_type text NOT NULL DEFAULT 'VAN',
  capacity integer NOT NULL DEFAULT 15,
  driver_id uuid REFERENCES public.drivers(user_id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- CHILDREN
CREATE TABLE public.children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid,
  name text NOT NULL,
  photo_url text,
  grade text,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  home_lat double precision NOT NULL,
  home_lng double precision NOT NULL,
  home_address text,
  home_geofence_m integer NOT NULL DEFAULT 200,
  emergency_contact text,
  active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.children TO authenticated;
GRANT ALL ON public.children TO service_role;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

-- ROUTES
CREATE TABLE public.routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(user_id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  est_minutes integer NOT NULL DEFAULT 45,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routes TO authenticated;
GRANT ALL ON public.routes TO service_role;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  label text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  UNIQUE (route_id, seq)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_stops TO authenticated;
GRANT ALL ON public.route_stops TO service_role;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.route_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  seq integer NOT NULL DEFAULT 1,
  UNIQUE (route_id, child_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_children TO authenticated;
GRANT ALL ON public.route_children TO service_role;
ALTER TABLE public.route_children ENABLE ROW LEVEL SECURITY;

-- TRIPS
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  trip_type public.trip_type NOT NULL,
  status public.trip_status NOT NULL DEFAULT 'STARTED',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  eta_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE INDEX trips_active_idx ON public.trips (status, started_at DESC);

CREATE TABLE public.trip_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  seq integer NOT NULL DEFAULT 1,
  status public.child_trip_status NOT NULL DEFAULT 'WAITING_FOR_PICKUP',
  picked_at timestamptz,
  pickup_lat double precision,
  pickup_lng double precision,
  dropped_at timestamptz,
  dropoff_lat double precision,
  dropoff_lng double precision,
  absent_reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, child_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_children TO authenticated;
GRANT ALL ON public.trip_children TO service_role;
ALTER TABLE public.trip_children ENABLE ROW LEVEL SECURITY;

-- LIVE LOCATION
CREATE TABLE public.vehicle_live (
  trip_id uuid PRIMARY KEY REFERENCES public.trips(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  speed double precision,
  heading double precision,
  accuracy double precision,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_live TO authenticated;
GRANT ALL ON public.vehicle_live TO service_role;
ALTER TABLE public.vehicle_live ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.location_history (
  id bigserial PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  speed double precision,
  heading double precision,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.location_history TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.location_history_id_seq TO authenticated;
GRANT ALL ON public.location_history TO service_role;
ALTER TABLE public.location_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX location_history_trip_idx ON public.location_history (trip_id, recorded_at);

CREATE TABLE public.trip_events (
  id bigserial PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.children(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.trip_events TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.trip_events_id_seq TO authenticated;
GRANT ALL ON public.trip_events TO service_role;
ALTER TABLE public.trip_events ENABLE ROW LEVEL SECURITY;

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  child_id uuid REFERENCES public.children(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);

CREATE TABLE public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'web',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_logs (
  id bigserial PRIMARY KEY,
  actor uuid,
  action text NOT NULL,
  entity text,
  entity_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.audit_logs_id_seq TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- AUTHORIZATION HELPERS
CREATE OR REPLACE FUNCTION public.is_parent_of(_child_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.children c WHERE c.id = _child_id AND c.parent_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_trip_driver(_trip_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.trips t WHERE t.id = _trip_id AND t.driver_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.parent_can_see_trip(_trip_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_children tc
    JOIN public.children c ON c.id = tc.child_id
    WHERE tc.trip_id = _trip_id AND c.parent_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.child_on_driver_trip(_child_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_children tc
    JOIN public.trips t ON t.id = tc.trip_id
    WHERE tc.child_id = _child_id AND t.driver_id = auth.uid()
      AND t.status IN ('STARTED','IN_PROGRESS','DELAYED')
  ) OR EXISTS (
    SELECT 1 FROM public.route_children rc
    JOIN public.routes r ON r.id = rc.route_id
    WHERE rc.child_id = _child_id AND r.driver_id = auth.uid()
  );
$$;

-- POLICIES
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin()) WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "drivers read" ON public.drivers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "drivers self upsert" ON public.drivers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "drivers update" ON public.drivers FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin()) WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "drivers admin delete" ON public.drivers FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "schools read" ON public.schools FOR SELECT TO authenticated USING (true);
CREATE POLICY "schools admin write" ON public.schools FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "vehicles read" ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "vehicles admin write" ON public.vehicles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "children parent read" ON public.children FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR public.is_admin() OR public.child_on_driver_trip(id));
CREATE POLICY "children write" ON public.children FOR INSERT TO authenticated
  WITH CHECK (parent_id = auth.uid() OR public.is_admin());
CREATE POLICY "children update" ON public.children FOR UPDATE TO authenticated
  USING (parent_id = auth.uid() OR public.is_admin()) WITH CHECK (parent_id = auth.uid() OR public.is_admin());
CREATE POLICY "children delete" ON public.children FOR DELETE TO authenticated
  USING (parent_id = auth.uid() OR public.is_admin());

CREATE POLICY "routes read" ON public.routes FOR SELECT TO authenticated
  USING (public.is_admin() OR driver_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.route_children rc JOIN public.children c ON c.id = rc.child_id
    WHERE rc.route_id = routes.id AND c.parent_id = auth.uid()));
CREATE POLICY "routes admin write" ON public.routes FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "route stops read" ON public.route_stops FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.routes r WHERE r.id = route_id AND (r.driver_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.route_children rc JOIN public.children c ON c.id = rc.child_id
      WHERE rc.route_id = r.id AND c.parent_id = auth.uid()))));
CREATE POLICY "route stops admin write" ON public.route_stops FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "route children read" ON public.route_children FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_parent_of(child_id) OR EXISTS (
    SELECT 1 FROM public.routes r WHERE r.id = route_id AND r.driver_id = auth.uid()));
CREATE POLICY "route children admin write" ON public.route_children FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "trips read" ON public.trips FOR SELECT TO authenticated
  USING (public.is_admin() OR driver_id = auth.uid() OR public.parent_can_see_trip(id));
CREATE POLICY "trips driver insert" ON public.trips FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid() OR public.is_admin());
CREATE POLICY "trips driver update" ON public.trips FOR UPDATE TO authenticated
  USING (driver_id = auth.uid() OR public.is_admin()) WITH CHECK (driver_id = auth.uid() OR public.is_admin());

CREATE POLICY "trip children read" ON public.trip_children FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_parent_of(child_id) OR public.is_trip_driver(trip_id));
CREATE POLICY "trip children insert" ON public.trip_children FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_trip_driver(trip_id));
CREATE POLICY "trip children update" ON public.trip_children FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_trip_driver(trip_id))
  WITH CHECK (public.is_admin() OR public.is_trip_driver(trip_id));

CREATE POLICY "live read" ON public.vehicle_live FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_trip_driver(trip_id) OR public.parent_can_see_trip(trip_id));
CREATE POLICY "live driver write" ON public.vehicle_live FOR INSERT TO authenticated
  WITH CHECK (public.is_trip_driver(trip_id));
CREATE POLICY "live driver update" ON public.vehicle_live FOR UPDATE TO authenticated
  USING (public.is_trip_driver(trip_id)) WITH CHECK (public.is_trip_driver(trip_id));
CREATE POLICY "live driver delete" ON public.vehicle_live FOR DELETE TO authenticated
  USING (public.is_trip_driver(trip_id) OR public.is_admin());

CREATE POLICY "history read" ON public.location_history FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_trip_driver(trip_id) OR public.parent_can_see_trip(trip_id));
CREATE POLICY "history driver insert" ON public.location_history FOR INSERT TO authenticated
  WITH CHECK (public.is_trip_driver(trip_id));

CREATE POLICY "events read" ON public.trip_events FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_trip_driver(trip_id) OR public.parent_can_see_trip(trip_id));
CREATE POLICY "events insert" ON public.trip_events FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_trip_driver(trip_id));

CREATE POLICY "notifications read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "notifications insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.children c WHERE c.id = child_id AND c.parent_id = notifications.user_id
      AND public.child_on_driver_trip(c.id)));
CREATE POLICY "notifications update own" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "tokens own" ON public.device_tokens FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "audit admin read" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "audit insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (actor = auth.uid());

-- updated_at triggers
CREATE TRIGGER t_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_children BEFORE UPDATE ON public.children FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_routes BEFORE UPDATE ON public.routes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_trips BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_trip_children BEFORE UPDATE ON public.trip_children FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_vehicles BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_drivers BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- REALTIME
ALTER TABLE public.vehicle_live REPLICA IDENTITY FULL;
ALTER TABLE public.trips REPLICA IDENTITY FULL;
ALTER TABLE public.trip_children REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_live;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_children;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- DEMO REFERENCE DATA (no accounts; children are unclaimed until a demo parent claims them)
INSERT INTO public.schools (id, name, address, lat, lng, geofence_m) VALUES
  ('11111111-1111-1111-1111-111111111111','ABC School','Gulberg III, Lahore', 31.5100, 74.3450, 150);

INSERT INTO public.vehicles (id, reg_no, vehicle_type, capacity) VALUES
  ('22222222-2222-2222-2222-222222222222','LEA-1234','VAN',15);

INSERT INTO public.routes (id, name, school_id, vehicle_id, est_minutes) VALUES
  ('33333333-3333-3333-3333-333333333333','Route A — Gulberg','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',40);

INSERT INTO public.route_stops (route_id, seq, label, lat, lng) VALUES
  ('33333333-3333-3333-3333-333333333333',1,'Ali — Home', 31.5204, 74.3587),
  ('33333333-3333-3333-3333-333333333333',2,'Sara — Home', 31.5165, 74.3520),
  ('33333333-3333-3333-3333-333333333333',3,'Ahmed — Home', 31.5132, 74.3488),
  ('33333333-3333-3333-3333-333333333333',4,'ABC School', 31.5100, 74.3450);

INSERT INTO public.children (id, parent_id, name, grade, school_id, home_lat, home_lng, home_address, emergency_contact, is_demo) VALUES
  ('44444444-4444-4444-4444-444444444401', NULL, 'Ali', 'Grade 5','11111111-1111-1111-1111-111111111111',31.5204,74.3587,'Gulberg, Lahore','+92 300 1112222', true),
  ('44444444-4444-4444-4444-444444444402', NULL, 'Sara','Grade 3','11111111-1111-1111-1111-111111111111',31.5165,74.3520,'Gulberg, Lahore','+92 300 1112222', true),
  ('44444444-4444-4444-4444-444444444403', NULL, 'Ahmed','Grade 7','11111111-1111-1111-1111-111111111111',31.5132,74.3488,'Gulberg, Lahore','+92 300 1112222', true);

INSERT INTO public.route_children (route_id, child_id, seq) VALUES
  ('33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444401',1),
  ('33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444402',2),
  ('33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444403',3);
