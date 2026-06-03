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

    // 4. Determine caller role: admin > coordenador > comercial (user). Others denied.
    const checkRole = async (role: 'admin' | 'coordenador' | 'user') => {
      const { data } = await supabaseAdmin.rpc('has_role', { _user_id: user.id, _role: role });
      return !!data;
    };

    const isAdmin = await checkRole('admin');
    const isCoordenador = !isAdmin && (await checkRole('coordenador'));
    const isComercial = !isAdmin && !isCoordenador && (await checkRole('user'));

    if (!isAdmin && !isCoordenador && !isComercial) {
      console.log(`User ${user.id} does not have access, denied`);
      return new Response(
        JSON.stringify({ error: 'Forbidden', message: 'Sem permissão para listar usuários' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    // 5. List all users (admin operation)
    console.log(`Caller ${user.id} (${user.email}) [${isAdmin ? 'admin' : isCoordenador ? 'coordenador' : 'comercial'}] listing users...`);

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
    }

    // 7. Get unidades from user_unidades table for each user
    const { data: userUnidades, error: unidadesError } = await supabaseAdmin
      .from('user_unidades')
      .select('user_id, unidade_id');

    if (unidadesError) {
      console.error('Error fetching user unidades:', unidadesError);
    }

    // 8. Get telefones from user_profiles table (admin only)
    let userProfiles: Array<{ user_id: string; telefone: string | null }> | null = null;
    if (isAdmin) {
      const { data, error: profilesError } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, telefone');
      if (profilesError) console.error('Error fetching user profiles:', profilesError);
      userProfiles = data ?? null;
    }

    // Map roles by user_id
    const roleMap = new Map<string, string>();
    if (userRoles && Array.isArray(userRoles)) {
      userRoles.forEach((ur: { user_id: string; role: string }) => {
        let displayRole: string | null = null;
        if (ur.role === 'admin') displayRole = 'admin';
        else if (ur.role === 'moderator') displayRole = 'recepcao';
        else if (ur.role === 'user') displayRole = 'comercial';
        else if (ur.role === 'coordenador') displayRole = 'coordenador';
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

    // Map telefone by user_id (admin only)
    const phoneMap = new Map<string, string | null>();
    if (userProfiles) {
      userProfiles.forEach((up) => phoneMap.set(up.user_id, up.telefone));
    }

    // Caller unidades for non-admin scoping
    const callerUnits = unidadesMap.get(user.id) || [];
    const callerUnitSet = new Set(callerUnits);

    let formattedUsers = users.map(u => {
      const unidade_ids = unidadesMap.get(u.id) || [];
      return {
        id: u.id,
        email: isAdmin ? (u.email || null) : null,
        name: u.user_metadata?.full_name || null,
        role: roleMap.get(u.id) || null,
        created_at: u.created_at,
        last_sign_in_at: isAdmin ? (u.last_sign_in_at || null) : null,
        unidade_ids,
        telefone: isAdmin ? (phoneMap.get(u.id) || null) : null,
      };
    });

    if (!isAdmin) {
      // Scope to users sharing at least one unidade with the caller
      formattedUsers = formattedUsers.filter(u =>
        u.unidade_ids.some(id => callerUnitSet.has(id))
      );
    }

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
