// Supabase Edge Function (Deno) - insert_waste_protected
// Deploy via `supabase functions deploy insert_waste_protected`

import { serve } from "jsr:@std/http/server";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization Header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // --- Parse & Validate Body ---
    const body = await req.json();
    const { product_id, qty, type, notes, invoice_id } = body;

    if (!product_id || typeof product_id !== 'number') {
      return new Response(JSON.stringify({ error: 'Invalid or missing product_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!qty || typeof qty !== 'number' || qty <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid or missing qty (must be > 0)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!type || !['gift', 'waste'].includes(type)) {
      return new Response(JSON.stringify({ error: 'Invalid or missing type (must be gift or waste)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // --- Check User Role from profiles table ---
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Failed to fetch user profile' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Restrict waste only to admins
    if (type === 'waste' && profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Only admin can record waste' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Allow gift for admin or sales
    if (type === 'gift' && !['admin', 'sales'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden: Only admin or sales can record gifts' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // --- Insert into invoice_items with movement_type (triggers handle_invoice_item_movement -> waste_logs) ---
    // invoice_id is optional; if not provided, the trigger still logs to waste_logs
    const insertPayload: Record<string, unknown> = {
      product_id,
      qty,
      movement_type: type,
      notes: notes ?? null,
    };

    // Only add invoice_id if it was provided
    if (invoice_id) {
      insertPayload.invoice_id = invoice_id;
    }

    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('invoice_items')
      .insert([insertPayload])
      .select();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ data: insertData }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});