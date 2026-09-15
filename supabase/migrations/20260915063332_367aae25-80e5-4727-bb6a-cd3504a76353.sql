
create or replace function public.driver_on_route(_route_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.routes r where r.id = _route_id and r.driver_id = auth.uid());
$$;

create or replace function public.parent_on_route(_route_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.route_children rc
    join public.children c on c.id = rc.child_id
    where rc.route_id = _route_id and c.parent_id = auth.uid()
  );
$$;

revoke all on function public.driver_on_route(uuid) from public, anon;
revoke all on function public.parent_on_route(uuid) from public, anon;
grant execute on function public.driver_on_route(uuid) to authenticated;
grant execute on function public.parent_on_route(uuid) to authenticated;

drop policy if exists "routes read" on public.routes;
create policy "routes read" on public.routes for select to authenticated
using (is_admin() or driver_id = auth.uid() or public.parent_on_route(id));

drop policy if exists "route children read" on public.route_children;
create policy "route children read" on public.route_children for select to authenticated
using (is_admin() or is_parent_of(child_id) or public.driver_on_route(route_id));

drop policy if exists "route stops read" on public.route_stops;
create policy "route stops read" on public.route_stops for select to authenticated
using (is_admin() or public.driver_on_route(route_id) or public.parent_on_route(route_id));
