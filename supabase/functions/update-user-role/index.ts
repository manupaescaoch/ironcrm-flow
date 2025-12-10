import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, role } = await req.json();

    console.log(`Updating user ${userId} role to: ${role}`);

    // Validate role
    const validRoles = ['admin', 'recepcao', 'comercial', null];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role: ${role}. Must be one of: admin, recepcao, comercial`);
    }

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

    // Update user metadata
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { role },
    });

    if (error) {
      console.error('Error updating user role:', error);
      throw error;
    }

    console.log(`Successfully updated user ${userId} role to ${role}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: data.user.id,
          email: data.user.email,
          role: data.user.user_metadata?.role,
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
