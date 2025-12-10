import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Create Supabase client with SERVICE_ROLE_KEY
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 2. Get token from header
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // 3. Validate logged user
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);

    if (userErr || !user) {
      console.error('Auth error:', userErr);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // 4. Check if user is ADMIN using has_role function
    const { data: isAdmin, error: roleErr } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if (roleErr) {
      console.error('Role check error:', roleErr);
      return new Response(JSON.stringify({ error: 'Error checking permissions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // 5. Parse request body
    const { userId, role } = await req.json();

    if (!userId || !role) {
      return new Response(JSON.stringify({ error: 'userId and role are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Validate role
    const allowedRoles = ['admin', 'recepcao', 'comercial'];
    if (!allowedRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role. Allowed roles: ${allowedRoles.join(', ')}` }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log(`Admin ${user.id} (${user.email}) updating user ${userId} role to ${role}...`);

    // 6. Convert display role to app_role enum
    let appRole: 'admin' | 'moderator' | 'user';
    if (role === 'admin') appRole = 'admin';
    else if (role === 'recepcao') appRole = 'moderator';
    else appRole = 'user'; // comercial

    // 7. Update user_roles table (delete existing, insert new)
    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting old role:', deleteError);
      throw deleteError;
    }

    const { error: insertError } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role: appRole });

    if (insertError) {
      console.error('Error inserting new role:', insertError);
      throw insertError;
    }

    console.log(`Successfully updated user ${userId} role to ${role} (app_role: ${appRole})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { id: userId, role }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Internal server error';
    console.error('Error in update-user-role function:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
