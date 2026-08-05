import { adminCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';


Deno.serve(async (req) => {
  const corsHeaders = adminCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { data: isAdmin, error: roleErr } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const adminScopedSupabase = createClient(supabaseUrl, serviceRoleKey, {
      global: {
        headers: {
          Authorization: authHeader!,
        },
      },
    });

    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (userId === user.id) {
      return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log(`Admin ${user.id} (${user.email}) deleting user ${userId}...`);

    // Clean up direct ownership records before deleting the auth user
    const deleteOperations = [
      { table: 'user_roles', column: 'user_id' },
      { table: 'user_unidades', column: 'user_id' },
      { table: 'user_profiles', column: 'user_id' },
      { table: 'task_notifications', column: 'user_id' },
    ];

    for (const { table, column } of deleteOperations) {
      const { error: cleanupErr } = await supabase
        .from(table)
        .delete()
        .eq(column, userId);

      if (cleanupErr) {
        console.log(`Warning: delete cleanup on ${table}.${column} failed:`, cleanupErr.message);
      }
    }

    // Preserve historical data while removing auth-user references that can block deletion
    const nullifyOperations = [
      { table: 'task_comments', column: 'user_id' },
      { table: 'task_history', column: 'user_id' },
      { table: 'leads', column: 'created_by' },
      { table: 'leads', column: 'user_id' },
      { table: 'interacoes', column: 'created_by' },
      { table: 'tasks', column: 'created_by' },
      { table: 'escala', column: 'created_by' },
      { table: 'formularios', column: 'created_by' },
      { table: 'investimentos_marketing', column: 'created_by' },
      { table: 'movimentacoes_estoque', column: 'created_by' },
      { table: 'relatorio_gerencial_zn', column: 'created_by' },
      { table: 'rotinas', column: 'created_by' },
    ];

    for (const { table, column } of nullifyOperations) {
      const cleanupClient = table === 'leads' ? adminScopedSupabase : supabase;

      const { error: cleanupErr } = await cleanupClient
        .from(table)
        .update({ [column]: null })
        .eq(column, userId);

      if (cleanupErr) {
        console.log(`Warning: nullify cleanup on ${table}.${column} failed:`, cleanupErr.message);
      }
    }

    // Now delete the auth user
    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      if (error.message === 'User not found' || (error as any).code === 'user_not_found') {
        console.log(`User ${userId} already deleted`);
        return new Response(
          JSON.stringify({ success: true, message: 'User already deleted' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      console.error('Error deleting user:', error);
      throw error;
    }

    console.log(`Successfully deleted user ${userId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Internal server error';
    console.error('Error in delete-user function:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
