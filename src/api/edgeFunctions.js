import { supabase } from '../lib/supabaseClient';

export async function insertWasteProtected({ product_id, qty, type, notes = '' }) {
  // Use Supabase Functions if available
  try {
    if (supabase.functions && supabase.functions.invoke) {
      const res = await supabase.functions.invoke('insert_waste_protected', { body: { product_id, qty, type, notes } });
      return res;
    }
    // Fallback: direct REST call to Functions URL via env
    const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const resp = await fetch(`${functionsUrl}/insert_waste_protected`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({ product_id, qty, type, notes })
    });
    return resp.json();
  } catch (error) {
    return { error };
  }
}
