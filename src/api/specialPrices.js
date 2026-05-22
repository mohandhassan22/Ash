import { supabase } from '../lib/supabaseClient';

export async function getSpecialPrice(customerId, productId) {
  const { data, error } = await supabase
    .from('customer_special_prices')
    .select('special_price, min_qty')
    .eq('customer_id', customerId)
    .eq('product_id', productId)
    .limit(1)
    .maybeSingle();
  return { data, error };
}

export async function listCustomerSpecialPrices(customerId) {
  const { data, error } = await supabase
    .from('customer_special_prices')
    .select('*')
    .eq('customer_id', customerId);
  return { data, error };
}

export async function addSpecialPrice({ customer_id, product_id, special_price, min_qty = 1 }) {
  const { data, error } = await supabase
    .from('customer_special_prices')
    .insert([{ customer_id, product_id, special_price, min_qty }]);
  return { data, error };
}

export async function updateSpecialPrice(id, fields) {
  const { data, error } = await supabase
    .from('customer_special_prices')
    .update(fields)
    .eq('id', id);
  return { data, error };
}

export async function deleteSpecialPrice(id) {
  const { data, error } = await supabase
    .from('customer_special_prices')
    .delete()
    .eq('id', id);
  return { data, error };
}

export async function importSpecialPrices(rows) {
  // rows: [{customer_id, product_id, special_price, min_qty}, ...]
  const { data, error } = await supabase
    .from('customer_special_prices')
    .upsert(rows, { onConflict: ['customer_id', 'product_id'] });
  return { data, error };
}
