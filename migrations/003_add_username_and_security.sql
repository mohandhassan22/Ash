-- ================================================================
-- MIGRATION 003 — إضافة username + RLS الكامل
-- شغّل في Supabase SQL Editor مرة واحدة
-- ================================================================

-- 1. إضافة الأعمدة الناقصة لو مش موجودة
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username     text,
  ADD COLUMN IF NOT EXISTS full_name    text,
  ADD COLUMN IF NOT EXISTS permissions  jsonb NOT NULL DEFAULT '{
    "dashboard": true,
    "pos":       true,
    "products":  true,
    "customers": true,
    "invoices":  true,
    "reports":   false,
    "settings":  false
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();

-- 2. تحديث الأعمدة الموجودة بقيم افتراضية لو فارغة
UPDATE public.profiles
SET username = COALESCE(username, split_part(email, '@', 1))
WHERE username IS NULL;

-- 3. إضافة NOT NULL + UNIQUE على username بعد ملء القيم
ALTER TABLE public.profiles
  ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_idx
  ON public.profiles (lower(username));

-- 4. حذف الـ constraint القديم وإضافة الجديد مع warehouse
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'sales', 'warehouse'));

-- 5. تفعيل RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- 6. حذف الـ policies القديمة لو موجودة ثم إعادة إنشاءها
DROP POLICY IF EXISTS "own_profile_select"   ON public.profiles;
DROP POLICY IF EXISTS "admin_select_all"     ON public.profiles;
DROP POLICY IF EXISTS "own_profile_update"   ON public.profiles;
DROP POLICY IF EXISTS "admin_update_all"     ON public.profiles;
DROP POLICY IF EXISTS "admin_insert"         ON public.profiles;
DROP POLICY IF EXISTS "admin_delete"         ON public.profiles;

-- كل مستخدم يشوف بروفايله نفسه
CREATE POLICY "own_profile_select"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- الأدمن يشوف كل المستخدمين
CREATE POLICY "admin_select_all"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'admin' AND p2.is_active = true
    )
  );

-- المستخدم يعدّل بياناته الأساسية فقط (مش role ولا permissions)
CREATE POLICY "own_profile_update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND permissions = (SELECT permissions FROM public.profiles WHERE id = auth.uid())
  );

-- الأدمن يعدّل أي حساب
CREATE POLICY "admin_update_all"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'admin' AND p2.is_active = true
    )
  );

-- الأدمن يضيف مستخدمين، أو أول يوزر في النظام
CREATE POLICY "admin_insert"
  ON public.profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'admin' AND p2.is_active = true
    )
    OR NOT EXISTS (SELECT 1 FROM public.profiles)
  );

-- الأدمن يحذف
CREATE POLICY "admin_delete"
  ON public.profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'admin' AND p2.is_active = true
    )
  );

-- 7. RLS للجداول الأخرى — البيانات بالتوكن فقط
DROP POLICY IF EXISTS "auth_read_products"  ON public.products;
DROP POLICY IF EXISTS "auth_write_products" ON public.products;
CREATE POLICY "auth_read_products"  ON public.products FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_products" ON public.products FOR ALL    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_read_customers"  ON public.customers;
DROP POLICY IF EXISTS "auth_write_customers" ON public.customers;
CREATE POLICY "auth_read_customers"  ON public.customers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_customers" ON public.customers FOR ALL    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_read_invoices"  ON public.invoices;
DROP POLICY IF EXISTS "auth_write_invoices" ON public.invoices;
CREATE POLICY "auth_read_invoices"  ON public.invoices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_invoices" ON public.invoices FOR ALL    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_read_invoice_items"  ON public.invoice_items;
DROP POLICY IF EXISTS "auth_write_invoice_items" ON public.invoice_items;
CREATE POLICY "auth_read_invoice_items"  ON public.invoice_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_invoice_items" ON public.invoice_items FOR ALL    USING (auth.role() = 'authenticated');

-- 8. Trigger — ينشئ profile تلقائياً لكل يوزر جديد
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _username text;
  _role     text;
BEGIN
  _username := lower(COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  ));
  _role := COALESCE(NEW.raw_user_meta_data->>'role', 'sales');

  INSERT INTO public.profiles (id, username, full_name, role, permissions, is_active)
  VALUES (
    NEW.id,
    _username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    _role,
    CASE _role
      WHEN 'admin'     THEN '{"dashboard":true,"pos":true,"products":true,"customers":true,"invoices":true,"reports":true,"settings":true}'::jsonb
      WHEN 'warehouse' THEN '{"dashboard":false,"pos":false,"products":true,"customers":false,"invoices":false,"reports":false,"settings":false}'::jsonb
      ELSE                  '{"dashboard":false,"pos":true,"products":false,"customers":true,"invoices":true,"reports":false,"settings":false}'::jsonb
    END,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    username  = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    role      = EXCLUDED.role;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Trigger — يحدّث updated_at تلقائياً
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ================================================================
-- بعد الـ migration ده:
-- 1. اعمل يوزر أدمن من Supabase Auth → Users
--    Email: admin@ashpure.internal
--    Password: (قوية)
-- 2. شغّل الـ UPDATE دي بعد ما تاخد الـ UUID:
--
-- UPDATE public.profiles
-- SET role = 'admin',
--     username = 'admin',
--     full_name = 'المدير العام',
--     permissions = '{"dashboard":true,"pos":true,"products":true,"customers":true,"invoices":true,"reports":true,"settings":true}'::jsonb,
--     is_active = true
-- WHERE id = 'PASTE_UUID_HERE';
-- ================================================================
