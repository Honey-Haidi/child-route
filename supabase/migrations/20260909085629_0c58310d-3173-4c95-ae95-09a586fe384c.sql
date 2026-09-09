CREATE POLICY "Parents can see driver name on their child's trip"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.driver_id = profiles.user_id
      AND public.parent_can_see_trip(t.id)
  )
);