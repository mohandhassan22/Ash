-- ================================================================
-- ASH PURE ERP — AUTH & SECURITY FULL SETUP
-- شغّل الـ SQL ده كله مرة واحدة في Supabase SQL Editor
-- ================================================================


-- ================================================================
-- 1. جدول PROFILES
--    مربوط بـ auth.users — username للدخول بدل الإيميل
-- ================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username     text        UNIQUE NOT NULL,
  full_name    text,
  role         text        NOT NULL DEFAULT 'sales'
                           CHECK (role IN ('admin', 'sales', 'warehouse')),
  permissions  jsonb       NOT NULL DEFAULT '{
    "dashboard": true,
    "pos":       true,
    "products":  true,
    "customers": true,
    "invoices":  true,
    "reports":   false,
    "settings":  false
  }'::jsonb,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Index سريع على username
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_idx
  ON public.profiles (lower(username));


-- ================================================================
-- 2. ROW LEVEL SECURITY (RLS)
--    البيانات مش بتظهر إلا للمستخدم المصرّح له بالتوكن
-- ================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- كل مستخدم يشوف بروفايل نفسه بس
CREATE POLICY "own_profile_select"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- الأدمن يشوف كل المستخدمين
CREATE POLICY "admin_select_all"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- المستخدم يعدّل بياناته الشخصية بس (مش role أو permissions)
CREATE POLICY "own_profile_update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role    = (SELECT role        FROM public.profiles WHERE id = auth.uid())
    AND permissions = (SELECT permissions FROM public.profiles WHERE id = auth.uid())
  );

-- الأدمن يعدّل أي مستخدم (بما فيهم role و permissions)
CREATE POLICY "admin_update_all"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- الأدمن بس يقدر يضيف مستخدمين
CREATE POLICY "admin_insert"
  ON public.profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
    OR
    -- استثناء: أول يوزر في النظام (الجدول فاضي) يقدر يسجّل نفسه أدمن
    NOT EXISTS (SELECT 1 FROM public.profiles)
  );

-- الأدمن بس يحذف
CREATE POLICY "admin_delete"
  ON public.profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );


-- ================================================================
-- 3. RLS على باقي الجداول
--    كل الداتا مش بتظهر غير بـ valid session token
-- ================================================================

-- PRODUCTS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_products"  ON public.products FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_products" ON public.products FOR ALL    USING (auth.role() = 'authenticated');

-- CUSTOMERS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_customers"  ON public.customers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_customers" ON public.customers FOR ALL    USING (auth.role() = 'authenticated');

-- INVOICES
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_invoices"  ON public.invoices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_invoices" ON public.invoices FOR ALL    USING (auth.role() = 'authenticated');

-- INVOICE ITEMS
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_invoice_items"  ON public.invoice_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_invoice_items" ON public.invoice_items FOR ALL    USING (auth.role() = 'authenticated');

-- WASTE LOGS
ALTER TABLE public.waste_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_waste"  ON public.waste_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_waste" ON public.waste_logs FOR ALL    USING (auth.role() = 'authenticated');

-- CUSTOMER SPECIAL PRICES
ALTER TABLE public.customer_special_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_special"  ON public.customer_special_prices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_special" ON public.customer_special_prices FOR ALL    USING (auth.role() = 'authenticated');


-- ================================================================
-- 4. TRIGGER — ينشئ profile تلقائياً لكل يوزر جديد في auth
-- ================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _username  text;
  _role      text;
BEGIN
  -- استخرج username من metadata، وإلا استخدم الجزء قبل @
  _username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );
  _role := COALESCE(NEW.raw_user_meta_data->>'role', 'sales');

  INSERT INTO public.profiles (id, username, full_name, role, permissions, is_active)
  VALUES (
    NEW.id,
    lower(_username),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    _role,
    CASE _role
      WHEN 'admin'     THEN '{"dashboard":true,"pos":true,"products":true,"customers":true,"invoices":true,"reports":true,"settings":false}'::jsonb
      WHEN 'warehouse' THEN '{"dashboard":false,"pos":false,"products":true,"customers":false,"invoices":false,"reports":false,"settings":false}'::jsonb
      ELSE                  '{"dashboard":false,"pos":true,"products":false,"customers":true,"invoices":true,"reports":false,"settings":false}'::jsonb
    END,
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ================================================================
-- 5. TRIGGER — يحدّث updated_at تلقائياً
-- ================================================================
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
-- 6. إنشاء أول أدمن يدوياً
--
-- خطوات:
--   أ) اعمل اليوزر من Supabase Dashboard → Authentication → Users
--      Email:    admin@ashpure.internal
--      Password: (كلمة مرور قوية)
--
--   ب) استخدم الـ UUID اللي ظهر وشغّل الـ UPDATE دي:
-- ================================================================

/*
UPDATE public.profiles
SET
  role        = 'admin',
  username    = 'admin',
  full_name   = 'المدير العام',
  permissions = '{"dashboard":true,"pos":true,"products":true,"customers":true,"invoices":true,"reports":true,"settings":true}'::jsonb,
  is_active   = true
WHERE id = 'PASTE_ADMIN_UUID_HERE';
*/


-- ================================================================
-- 7. التحقق — شوف كل المستخدمين بعد الإعداد
-- ================================================================
-- SELECT id, username, full_name, role, is_active, created_at
-- FROM public.profiles
-- ORDER BY created_at;


-- ================================================================
-- 8. تحديث صلاحيات الـ roles الموجودة
--    شغّل بعد أي تغيير في هيكل الصلاحيات
-- ================================================================

-- مدير: كل الصفحات ما عدا الإعدادات
UPDATE public.profiles
SET permissions = '{"dashboard":true,"pos":true,"products":true,"customers":true,"invoices":true,"reports":true,"settings":false}'::jsonb
WHERE role = 'admin';

-- موظف مبيعات: نقطة البيع + العملاء + الفواتير
UPDATE public.profiles
SET permissions = '{"dashboard":false,"pos":true,"products":false,"customers":true,"invoices":true,"reports":false,"settings":false}'::jsonb
WHERE role = 'sales';

-- مدير مخزن: المنتجات والمخزون والهوالك فقط
UPDATE public.profiles
SET permissions = '{"dashboard":false,"pos":false,"products":true,"customers":false,"invoices":false,"reports":false,"settings":false}'::jsonb
WHERE role = 'warehouse';

-- تحديث الـ constraint لإضافة warehouse
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'sales', 'warehouse'));
