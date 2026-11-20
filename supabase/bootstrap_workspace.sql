-- Jalankan setelah 001_init_muara.sql dan pembuatan akun di Authentication.
-- Akun ini mendapat akses kelola pada pabrik dan dua koperasi contoh.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE lower(email) = lower('bniventures@gmail.com')
  ) THEN
    RAISE EXCEPTION 'Ganti EMAIL_LOGIN_ANDA dengan email dari Authentication > Users.';
  END IF;
END;
$$;

INSERT INTO public.organizations (id, name, org_type, region, svlk_reference)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Pabrik Serat Teluk Jelutong', 'pulp_mill', 'Muaro Jambi, Jambi', 'SVLK-001'),
  ('20000000-0000-4000-8000-000000000001', 'Koperasi Rimba Muara', 'cooperative', 'Kumpeh Ulu, Muaro Jambi', NULL),
  ('20000000-0000-4000-8000-000000000002', 'Koperasi Tunas Batanghari', 'cooperative', 'Kumpeh, Muaro Jambi', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organization_members (organization_id, user_id)
SELECT o.id, u.id
FROM public.organizations o
CROSS JOIN auth.users u
WHERE o.id IN (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002'
)
AND lower(u.email) = lower('bniventures@gmail.com')
ON CONFLICT (organization_id, user_id) DO NOTHING;

COMMIT;

SELECT o.name, m.user_id
FROM public.organization_members m
JOIN public.organizations o ON o.id = m.organization_id
WHERE m.user_id IN (
  SELECT id FROM auth.users WHERE lower(email) = lower('bniventures@gmail.com')
);
