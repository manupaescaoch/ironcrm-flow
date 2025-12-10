import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Validate JWT
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Verify admin role
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const { userId, role } = await req.json();

    if (!userId || !role) {
      throw new Error('userId and role are required');
    }

    const allowedRoles = ['admin', 'recepcao', 'comercial'];
    if (!allowedRoles.includes(role)) {
      throw new Error(`Invalid role. Allowed roles: ${allowedRoles.join(', ')}`);
    }

    console.log(`Admin ${user.id} updating user ${userId} role to ${role}...`);

    // Update user_metadata
    const { data: updatedUser, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { user_metadata: { role } }
    );

    if (error) {
      console.error('Error updating user role:', error);
      throw error;
    }

    // Sync to user_roles table
    const appRole = role === 'admin' ? 'admin' : role === 'recepcao' ? 'moderator' : 'user';
    
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role: appRole });

    console.log(`Successfully updated user ${userId} role to ${role}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: updatedUser.user.id,
          email: updatedUser.user.email,
          role: updatedUser.user.user_metadata?.role
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
