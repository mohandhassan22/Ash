-- Migration: 002_complete_waste_tables_with_data.sql
-- Creates waste/gift tables and special prices tables with sample data

-- ============================================================
-- TABLE 1: waste_logs (manual waste/gift log - kept as reference)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.waste_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id bigint NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  qty numeric NOT NULL CHECK (qty > 0),
  type text NOT NULL CHECK (type IN ('gift', 'waste')),
  cost numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE INDEX IF NOT EXISTS idx_waste_logs_product_id ON public.waste_logs (product_id);
CREATE INDEX IF NOT EXISTS idx_waste_logs_type_created_at ON public.waste_logs (type, created_at DESC);

-- ============================================================
-- TABLE 2: customer_special_prices
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customer_special_prices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  special_price numeric NOT NULL CHECK (special_price >= 0),
  min_qty integer DEFAULT 1 CHECK (min_qty >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_csp_customer_id ON public.customer_special_prices (customer_id);
CREATE INDEX IF NOT EXISTS idx_csp_product_id ON public.customer_special_prices (product_id);

-- ============================================================
-- TRIGGER: auto-update updated_at on customer_special_prices
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_update_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_csp_update_ts ON public.customer_special_prices;
CREATE TRIGGER trg_csp_update_ts
  BEFORE UPDATE ON public.customer_special_prices
  FOR EACH ROW EXECUTE FUNCTION public.trg_update_timestamp();

-- ============================================================
-- MOVEMENT TYPE COLUMN on invoice_items
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoice_items') THEN
    ALTER TABLE public.invoice_items
      ADD COLUMN IF NOT EXISTS movement_type text DEFAULT 'sale';
  END IF;
END$$;

-- ============================================================
-- TRIGGER: handle_invoice_item_movement
-- Deducts stock and logs to waste_logs when movement_type = gift/waste
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_invoice_item_movement()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  p_cost numeric;
BEGIN
  IF NEW.movement_type IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.movement_type IN ('gift', 'waste') THEN
    -- Deduct stock
    UPDATE public.products
      SET stock = stock - NEW.qty
      WHERE id = NEW.product_id;

    -- Get product cost per unit
    SELECT cost INTO p_cost FROM public.products WHERE id = NEW.product_id LIMIT 1;
    IF p_cost IS NULL THEN
      p_cost := 0;
    END IF;

    -- Log to waste_logs (triggered automatically)
    INSERT INTO public.waste_logs(product_id, qty, type, cost, created_by, created_at)
    VALUES (NEW.product_id, NEW.qty, NEW.movement_type, p_cost * NEW.qty, auth.uid(), now());
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if present, then recreate
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoice_items') THEN
    IF EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      WHERE c.relname = 'invoice_items' AND t.tgname = 'trg_handle_invoice_item_movement'
    ) THEN
      DROP TRIGGER IF EXISTS trg_handle_invoice_item_movement ON public.invoice_items;
    END IF;

    CREATE TRIGGER trg_handle_invoice_item_movement
      AFTER INSERT ON public.invoice_items
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_invoice_item_movement();
  END IF;
END$$;

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE IF EXISTS public.waste_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customer_special_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_items ENABLE ROW LEVEL SECURITY;

-- waste_logs: only admin can insert, authenticated users can select
DROP POLICY IF EXISTS allow_admin_insert_waste_logs ON public.waste_logs;
CREATE POLICY allow_admin_insert_waste_logs ON public.waste_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS select_waste_logs_public ON public.waste_logs;
CREATE POLICY select_waste_logs_public ON public.waste_logs
  FOR SELECT USING (auth.role() IS NOT NULL);

-- invoice_items: restrict waste to admin, gift to admin/sales
DROP POLICY IF EXISTS insert_invoice_items_restrict ON public.invoice_items;
CREATE POLICY insert_invoice_items_restrict ON public.invoice_items
  FOR INSERT WITH CHECK (
    (NEW.movement_type IS DISTINCT FROM 'waste')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS insert_invoice_items_gift ON public.invoice_items;
CREATE POLICY insert_invoice_items_gift ON public.invoice_items
  FOR INSERT WITH CHECK (
    (NEW.movement_type IS DISTINCT FROM 'gift')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'sales'))
  );

-- customer_special_prices: admin only
DROP POLICY IF EXISTS manage_customer_special_prices ON public.customer_special_prices;
CREATE POLICY manage_customer_special_prices ON public.customer_special_prices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- SAMPLE DATA (adjust IDs to match your existing records)
-- ============================================================

-- Sample products (if products table is empty)
INSERT INTO public.products (name, stock, cost, price_retail, price_specialist, price_dealer, traderPrice, specialistPrice, clientPrice)
VALUES
  ('Product A', 100, 10.00, 25.00, 22.00, 18.00, 18.00, 22.00, 25.00),
  ('Product B', 50, 5.50, 15.00, 13.00, 11.00, 11.00, 13.00, 15.00),
  ('Product C', 200, 2.00, 8.00, 7.00, 5.50, 5.50, 7.00, 8.00)
ON CONFLICT DO NOTHING;

-- Sample customers (if customers table is empty)
INSERT INTO public.customers (name, type, phone)
VALUES
  ('Customer Retail', 'retail', '01000000001'),
  ('Customer Specialist', 'specialist', '01000000002'),
  ('Customer Dealer', 'dealer', '01000000003')
ON CONFLICT DO NOTHING;

-- Sample waste logs
INSERT INTO public.waste_logs (product_id, qty, type, cost, notes)
SELECT p.id, 3, 'waste', p.cost * 3, 'Damaged goods from warehouse'
FROM public.products p WHERE p.name = 'Product A' LIMIT 1;

INSERT INTO public.waste_logs (product_id, qty, type, cost, notes)
SELECT p.id, 2, 'gift', p.cost * 2, 'Free sample for new client'
FROM public.products p WHERE p.name = 'Product B' LIMIT 1;

-- Sample customer special prices
WITH p AS (SELECT id FROM public.products WHERE name = 'Product A' LIMIT 1),
     c AS (SELECT id FROM public.customers WHERE name = 'Customer Retail' LIMIT 1)
INSERT INTO public.customer_special_prices (customer_id, product_id, special_price, min_qty)
SELECT c.id, p.id, 20.00, 5 FROM p, c
ON CONFLICT DO NOTHING;

WITH p AS (SELECT id FROM public.products WHERE name = 'Product B' LIMIT 1),
     c AS (SELECT id FROM public.customers WHERE name = 'Customer Specialist' LIMIT 1)
INSERT INTO public.customer_special_prices (customer_id, product_id, special_price, min_qty)
SELECT c.id, p.id, 10.00, 10 FROM p, c
ON CONFLICT DO NOTHING;