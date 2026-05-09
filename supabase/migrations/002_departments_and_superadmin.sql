-- ============================================================
-- 002: Add department column + super_admin role
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add department column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department text;

-- 2. Add department column to parks
ALTER TABLE public.parks
  ADD COLUMN IF NOT EXISTS department text;

-- 3. Seed department values for existing parks
UPDATE public.parks SET department = 'india'  WHERE country = 'India';
UPDATE public.parks SET department = 'africa' WHERE country IN ('Kenya', 'South Africa');

-- 4. Allow super_admin role (just a text value, no constraint change needed)
-- The role column is already text type, so 'super_admin' works directly.

-- 5. Update RLS policy for parks: government users see only their department
DROP POLICY IF EXISTS "Government users can view parks" ON public.parks;
CREATE POLICY "Government users can view their department parks"
  ON public.parks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role = 'super_admin'
          OR (profiles.role = 'government' AND profiles.department = parks.department)
        )
    )
  );

-- 6. Grant super_admin full access to all tables
-- Parks: super_admin can see all
-- (The policy above already handles super_admin for parks)

-- Estates: super_admin can see all estates
DROP POLICY IF EXISTS "Users can view own estates" ON public.estates;
CREATE POLICY "Users can view own estates or super_admin sees all"
  ON public.estates FOR SELECT
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

-- Done!
-- To make yourself super_admin, run:
-- UPDATE public.profiles SET role = 'super_admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL');
