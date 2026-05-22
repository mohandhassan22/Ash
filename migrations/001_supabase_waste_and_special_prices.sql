-- Migration: 001_supabase_waste_and_special_prices.sql
-- For Supabase / PostgreSQL

-- 1) جدول تسجيل الهوالك والهدايا
CREATE TABLE IF NOT EXISTS public.waste_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id bigint NOT NULL,
  qty numeric NOT NULL CHECK (qty > 0),
  type text NOT NULL CHECK (type IN ('gift','waste')),
  cost numeric NOT NULL DEFAULT 0, -- إجمالي التكلفة (cost per unit * qty)
  created_by uuid, -- يقترح استخدام auth.uid()
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

-- فهرس على المنتج
CREATE INDEX IF NOT EXISTS idx_waste_logs_product_id ON public.waste_logs (product_id);
CREATE INDEX IF NOT EXISTS idx_waste_logs_type_created_at ON public.waste_logs (type, created_at);

-- 2) جدول الأسعار الخاصة بالعملاء
CREATE TABLE IF NOT EXISTS public.customer_special_prices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id uuid NOT NULL,
  product_id bigint NOT NULL,
  special_price numeric NOT NULL CHECK (special_price >= 0),
  min_qty integer DEFAULT 1 CHECK (min_qty >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_csp_customer_id ON public.customer_special_prices (customer_id);
CREATE INDEX IF NOT EXISTS idx_csp_product_id ON public.customer_special_prices (product_id);

-- 3) إضافة حقل نوع الحركة لجدول بنود الفاتورة (invoice_items)
-- Adjust the table name/column names if your schema differs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoice_items') THEN
    ALTER TABLE public.invoice_items
      ADD COLUMN IF NOT EXISTS movement_type text DEFAULT 'sale';
    -- movement_type values: 'sale' (default), 'gift', 'waste'
  END IF;
END$$;

-- 4) Trigger: عند إضافة بند فاتورة من نوع هدية أو هالك
-- Assumptions:
-- - يوجد جدول "products" مع الأعمدة: id (bigint), stock (numeric), cost (numeric)
-- - عمود qty في invoice_items يمثل الكمية المخصومة
-- - user profiles table is public.profiles with id = auth.uid() and column role text

CREATE OR REPLACE FUNCTION public.handle_invoice_item_movement()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  p_cost numeric;
BEGIN
  IF NEW.movement_type IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.movement_type = 'gift' OR NEW.movement_type = 'waste' THEN
    -- deduct stock (assumes products.stock exists)
    UPDATE public.products
      SET stock = stock - NEW.qty
      WHERE id = NEW.product_id;

    -- get product cost (per unit) if available
    SELECT cost INTO p_cost FROM public.products WHERE id = NEW.product_id LIMIT 1;
    IF p_cost IS NULL THEN
      p_cost := 0;
    END IF;

    -- insert into waste_logs for reporting (type gift / waste)
    INSERT INTO public.waste_logs(product_id, qty, type, cost, created_by, created_at)
    VALUES (NEW.product_id, NEW.qty, NEW.movement_type, COALESCE(p_cost,0) * NEW.qty, auth.uid(), now());
  END IF;

  RETURN NEW;
END;
$$;

-- create trigger only if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoice_items') THEN
    -- drop existing trigger to avoid duplicates
    IF EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE c.relname = 'invoice_items' AND t.tgname = 'trg_handle_invoice_item_movement') THEN
      PERFORM pg_catalog.pg_trigger_drop((SELECT oid FROM pg_trigger WHERE tgname = 'trg_handle_invoice_item_movement'));
    END IF;
    CREATE TRIGGER trg_handle_invoice_item_movement
      AFTER INSERT ON public.invoice_items
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_invoice_item_movement();
  END IF;
END$$;

-- 5) وظيفة جلب السعر المناسب للعميل لمنتج معيّن
-- افتراضات:
-- - جدول products يحتوي على الأعمدة: price_retail, price_specialist, price_dealer
-- - جدول customers يحتوي على العمود type مع القيم: 'retail','specialist','dealer'

DO $$
BEGIN
  -- Create a robust get_price_for_customer function only if required tables exist.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='customer_special_prices') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='products')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='customers') THEN
      -- Create function using common product price columns used by the frontend (traderPrice, specialistPrice, clientPrice)
      EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.get_price_for_customer(p_product_id bigint, p_customer_id uuid)
      RETURNS numeric LANGUAGE sql STABLE AS $$
        WITH sp AS (
          SELECT special_price FROM public.customer_special_prices
          WHERE customer_id = p_customer_id AND product_id = p_product_id
          LIMIT 1
        )
        SELECT COALESCE(
          (SELECT special_price FROM sp),
          (SELECT CASE c.type
            WHEN 'trader' THEN p.traderPrice
            WHEN 'specialist' THEN p.specialistPrice
            ELSE p.clientPrice
          END
          FROM public.products p CROSS JOIN public.customers c WHERE p.id = p_product_id AND c.id = p_customer_id LIMIT 1)
        , 0);
      $$;
      $fn$;
    ELSE
      -- Fallback: create a safe function that returns 0 when products/customers tables are not present
      EXECUTE $$
        CREATE OR REPLACE FUNCTION public.get_price_for_customer(p_product_id bigint, p_customer_id uuid)
        RETURNS numeric LANGUAGE sql STABLE AS $$
          SELECT 0::numeric;
        $$;
      $$;
    END IF;
  END IF;
END$$;

-- 6) Example policy templates (RLS) — adjust according to your profiles/customers schema
-- Enable RLS on relevant tables (only enable if you use RLS)

-- Enable RLS (uncomment if you want RLS enforced)
-- ALTER TABLE public.waste_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Policy: only admins may insert 'waste' movements
-- (assumes public.profiles table with id = auth.uid() and role text)

-- DROP POLICY IF EXISTS allow_insert_waste_on_invoice_items ON public.invoice_items;
-- CREATE POLICY allow_insert_waste_on_invoice_items ON public.invoice_items
--   FOR INSERT
--   USING (
--     (NEW.movement_type IS DISTINCT FROM 'waste') OR
--     EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
--   );

-- Policy: allow insert of 'gift' by sales or admin
-- DROP POLICY IF EXISTS allow_insert_gift_on_invoice_items ON public.invoice_items;
-- CREATE POLICY allow_insert_gift_on_invoice_items ON public.invoice_items
--   FOR INSERT
--   USING (
--     (NEW.movement_type IS DISTINCT FROM 'gift') OR
--     EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','sales'))
--   );

-- Policy: restrict direct inserts to waste_logs to admins (recommended)
-- DROP POLICY IF EXISTS allow_admin_insert_waste_logs ON public.waste_logs;
-- CREATE POLICY allow_admin_insert_waste_logs ON public.waste_logs
--   FOR INSERT
--   USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Note: RLS policies above are commented out by default. Review and enable after adapting to your auth schema.
-- 6) Row Level Security (RLS) policies
-- Enable RLS on relevant tables and create policies that enforce roles
-- Assumes a `public.profiles` table with `id uuid` = auth.uid() and `role text` with values like 'admin' and 'sales'

ALTER TABLE IF EXISTS public.waste_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customer_special_prices ENABLE ROW LEVEL SECURITY;

-- Remove any existing conflicting policies first
DROP POLICY IF EXISTS insert_invoice_items_restrict ON public.invoice_items;
DROP POLICY IF EXISTS insert_invoice_items_gift ON public.invoice_items;
DROP POLICY IF EXISTS allow_admin_insert_waste_logs ON public.waste_logs;

-- Policy: for INSERT on invoice_items: disallow movement_type='waste' unless user is admin
CREATE POLICY insert_invoice_items_restrict ON public.invoice_items
  FOR INSERT
  WITH CHECK (
    (NEW.movement_type IS DISTINCT FROM 'waste')
    OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Policy: for INSERT on invoice_items: allow movement_type='gift' only for sales or admin
CREATE POLICY insert_invoice_items_gift ON public.invoice_items
  FOR INSERT
  WITH CHECK (
    (NEW.movement_type IS DISTINCT FROM 'gift')
    OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','sales')
    )
  );

-- Policy: restrict direct inserts to waste_logs to admins only
CREATE POLICY allow_admin_insert_waste_logs ON public.waste_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Allow SELECT on waste_logs for authenticated users (adjust as needed)
DROP POLICY IF EXISTS select_waste_logs_public ON public.waste_logs;
CREATE POLICY select_waste_logs_public ON public.waste_logs
  FOR SELECT USING (auth.role() IS NOT NULL);

-- Allow customers to manage their own special prices? (typically admin only)
DROP POLICY IF EXISTS manage_customer_special_prices ON public.customer_special_prices;
CREATE POLICY manage_customer_special_prices ON public.customer_special_prices
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Note: Review roles and adapt `public.profiles` structure to match your auth setup.

-- 7) Maintenance: update timestamp trigger for customer_special_prices
CREATE OR REPLACE FUNCTION public.trg_update_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='customer_special_prices') THEN
    -- drop existing trigger if exists
    IF EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE c.relname = 'customer_special_prices' AND t.tgname = 'trg_csp_update_ts') THEN
      PERFORM pg_catalog.pg_trigger_drop((SELECT oid FROM pg_trigger WHERE tgname = 'trg_csp_update_ts'));
    END IF;
    CREATE TRIGGER trg_csp_update_ts
      BEFORE UPDATE ON public.customer_special_prices
      FOR EACH ROW EXECUTE FUNCTION public.trg_update_timestamp();
  END IF;
END$$;

-- End of migration

