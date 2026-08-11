-- 1. design_doc_versions: scope reads to creator
DROP POLICY IF EXISTS "Authenticated users can view all design doc versions" ON public.design_doc_versions;
CREATE POLICY "Users can view own design doc versions"
ON public.design_doc_versions
FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

-- 2. profiles: remove public readability
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
REVOKE SELECT ON public.profiles FROM anon;

-- 3. storage: enforce folder ownership on upload
DROP POLICY IF EXISTS "Authenticated users can upload brand assets" ON storage.objects;
CREATE POLICY "Authenticated users can upload own brand assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'brand-assets'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 4. SECURITY DEFINER functions: not callable from the Data API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;