import { supabase } from '../lib/supabaseClient';

export async function createWasteLog({ product_id, qty, type, notes = '' }) {
  // type: 'gift' | 'waste'
  // This endpoint inserts directly into `waste_logs`.
  // For stricter permission rules (only admin can insert 'waste'), implement an Edge Function on Supabase
  const { data, error } = await supabase
    .from('waste_logs')
    .insert([{ product_id, qty, type, notes }]);
  return { data, error };
}

export async function listWasteLogs({ from, to, type } = {}) {
  let q = supabase.from('waste_logs').select('*');
  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', to);
  if (type) q = q.eq('type', type);
  const { data, error } = await q.order('created_at', { ascending: false });
  return { data, error };
}

export async function getWasteReport({ from, to } = {}) {
  // basic report: fetch rows and aggregate in JS to avoid depending on a custom RPC
  let q = supabase.from('waste_logs').select('type, qty, cost, created_at');
  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', to);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) return { data: null, error };
  const summary = (data || []).reduce((acc, row) => {
    const t = row.type || 'unknown';
    acc[t] = acc[t] || { total_qty: 0, total_cost: 0 };
    acc[t].total_qty += parseFloat(row.qty || 0);
    acc[t].total_cost += parseFloat(row.cost || 0);
    return acc;
  }, {});
  return { data: summary, error: null };
}
