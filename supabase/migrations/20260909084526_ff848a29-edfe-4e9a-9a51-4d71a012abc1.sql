
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_parent_of(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_trip_driver(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.parent_can_see_trip(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.child_on_driver_trip(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_parent_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_trip_driver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.parent_can_see_trip(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.child_on_driver_trip(uuid) TO authenticated;
