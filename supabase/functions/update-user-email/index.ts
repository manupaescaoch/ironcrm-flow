import { adminCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const corsHeaders = {
    ...adminCorsHeaders(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    // 1. Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ error: 'No authorization header' }, 401);
    }

    // 2. Create Supabase admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // 3. Create a client with the user's token to verify their identity
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );

    // 4. Verify the user is authenticated and is an admin
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if (roleError || !isAdmin) {
      return json({ error: 'Forbidden: Admin access required' }, 403);
    }

    // 5. Parse request body
    const { userId, email } = await req.json();

    const normalizedEmail = email?.trim().toLowerCase();
    if (!userId || !normalizedEmail) {
      return json({ error: 'userId and email are required' }, 400);
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return json({ error: 'E-mail inválido' }, 400);
    }

    console.log(`Admin ${user.id} (${user.email}) updating email for user ${userId} to "${normalizedEmail}"...`);

    // 6. Update the user's email via the admin API.
    // email_confirm=true so the new email is usable immediately (no confirmation loop).
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { email: normalizedEmail, email_confirm: true },
    );

    if (updateError) {
      console.error('Failed to update user email:', updateError);
      return json({ error: updateError.message || 'Não foi possível atualizar o e-mail do usuário.' }, 400);
    }

    console.log(`Successfully updated email for user ${userId}`);

    return json({
      success: true,
      user: {
        id: updatedUser.user.id,
        email: updatedUser.user.email,
        name: updatedUser.user.user_metadata?.full_name,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    console.error('update-user-email error:', msg);
    return json({ error: msg }, 500);
  }
});
