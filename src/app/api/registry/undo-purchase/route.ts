import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    // This route bypasses RLS via the service-role client and /api is excluded
    // from the site-wide password gate in middleware.ts, so it must check the
    // site password itself — otherwise anyone who knows/guesses a registry_items
    // id can anonymously wipe a real buyer's purchase.
    const sitePassword = process.env.SITE_PASSWORD;
    if (sitePassword) {
      const accessToken = (await cookies()).get('site-access-token')?.value;
      if (accessToken !== sitePassword) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin
      .from('registry_items')
      .update({
        is_purchased: false,
        purchaser_name: null,
        purchaser_email: null,
        purchaser_phone: null,
        purchaser_message: null,
      })
      .eq('id', id);

    if (error) {
      console.error('Undo purchase error:', error);
      return NextResponse.json({ error: 'Failed to undo purchase' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Undo purchase unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
