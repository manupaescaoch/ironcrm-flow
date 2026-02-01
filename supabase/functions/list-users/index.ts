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
    // 1. Get token from header first
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Token de acesso não fornecido' }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token || token.trim() === '') {
      console.log('Empty token provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Token de acesso vazio' }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // 2. Create Supabase client with SERVICE_ROLE_KEY for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 3. Validate the user's JWT token using the admin API
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);

    if (userErr || !userData?.user) {
      console.log('Token validation failed:', userErr?.message || 'No user data');
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Sessão expirada ou inválida. Faça login novamente.' }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const user = userData.user;
    console.log(`User ${user.id} (${user.email}) authenticated successfully`);

    // 4. Check if user is ADMIN using has_role function
    const { data: isAdmin, error: roleErr } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if (roleErr) {
      console.error('Role check error:', roleErr);
      return new Response(
        JSON.stringify({ error: 'Server error', message: 'Erro ao verificar permissões' }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    if (!isAdmin) {
      console.log(`User ${user.id} is not an admin, access denied`);
      return new Response(
        JSON.stringify({ error: 'Forbidden', message: 'Apenas administradores podem listar usuários' }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    // 5. List all users (admin operation)
    console.log(`Admin ${user.id} (${user.email}) listing users...`);

    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('Error listing users:', listError);
      return new Response(
        JSON.stringify({ error: 'Server error', message: 'Erro ao listar usuários' }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    const users = listData?.users || [];

    // 6. Get roles from user_roles table for each user
    const { data: userRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      // Continue without roles - not a critical error
    }

    // 7. Get unidades from user_unidades table for each user
    const { data: userUnidades, error: unidadesError } = await supabaseAdmin
      .from('user_unidades')
      .select('user_id, unidade_id');

    if (unidadesError) {
      console.error('Error fetching user unidades:', unidadesError);
      // Continue without unidades - not a critical error
    }

    // 8. Get telefones from user_profiles table
    const { data: userProfiles, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, telefone');

    if (profilesError) {
      console.error('Error fetching user profiles:', profilesError);
      // Continue without profiles - not a critical error
    }

    // Map roles by user_id
    const roleMap = new Map<string, string>();
    if (userRoles && Array.isArray(userRoles)) {
      userRoles.forEach((ur: { user_id: string; role: string }) => {
        // Convert app_role to display role
        let displayRole: string | null = null;
        if (ur.role === 'admin') displayRole = 'admin';
        else if (ur.role === 'moderator') displayRole = 'recepcao';
        else if (ur.role === 'user') displayRole = 'comercial';
        if (displayRole) roleMap.set(ur.user_id, displayRole);
      });
    }

    // Map unidades by user_id
    const unidadesMap = new Map<string, string[]>();
    if (userUnidades && Array.isArray(userUnidades)) {
      userUnidades.forEach((uu: { user_id: string; unidade_id: string }) => {
        const existing = unidadesMap.get(uu.user_id) || [];
        existing.push(uu.unidade_id);
        unidadesMap.set(uu.user_id, existing);
      });
    }

    // Map telefone by user_id
    const phoneMap = new Map<string, string | null>();
    if (userProfiles && Array.isArray(userProfiles)) {
      userProfiles.forEach((up: { user_id: string; telefone: string | null }) => {
        phoneMap.set(up.user_id, up.telefone);
      });
    }

    const formattedUsers = users.map(u => ({
      id: u.id,
      email: u.email || null,
      name: u.user_metadata?.full_name || null,
      role: roleMap.get(u.id) || null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at || null,
      unidade_ids: unidadesMap.get(u.id) || [],
      telefone: phoneMap.get(u.id) || null,
    }));

    console.log(`Successfully listed ${formattedUsers.length} users`);

    return new Response(
      JSON.stringify({ users: formattedUsers }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Internal server error';
    console.error('Unexpected error in list-users function:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Server error', message: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
