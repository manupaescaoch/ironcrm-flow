import { adminCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';


Deno.serve(async (req) => {
  const corsHeaders = adminCorsHeaders(req);
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
    const { name, email, password, role, unidade_ids, telefone } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'email and password are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Validate role if provided
    const allowedRoles = ['admin', 'recepcao', 'comercial', 'coordenador', 'gerente'];
    if (role && !allowedRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role. Allowed roles: ${allowedRoles.join(', ')}` }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log(`Admin ${user.id} (${user.email}) creating user ${email} with role ${role || 'none'}...`);

    // 6. Create user with user_metadata for the display name
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: name ? { full_name: name } : undefined,
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return new Response(JSON.stringify({ error: 'Não foi possível criar o usuário. Verifique os dados informados.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 7. Add role if specified
    if (role && newUser.user) {
      let appRole: 'admin' | 'moderator' | 'user' | 'coordenador' | 'gerente';
      if (role === 'admin') appRole = 'admin';
      else if (role === 'recepcao') appRole = 'moderator';
      else if (role === 'coordenador') appRole = 'coordenador';
      else if (role === 'gerente') appRole = 'gerente';
      else appRole = 'user'; // comercial

      const { error: roleInsertError } = await supabase
        .from('user_roles')
        .insert({ user_id: newUser.user.id, role: appRole });

      if (roleInsertError) {
        console.error('Error inserting role:', roleInsertError);
        // User was created but role failed - log but don't fail
      }
    }

    // 8. Add user_unidades if specified
    if (unidade_ids && Array.isArray(unidade_ids) && unidade_ids.length > 0 && newUser.user) {
      const userUnidadesData = unidade_ids.map((unidade_id: string, index: number) => ({
        user_id: newUser.user!.id,
        unidade_id,
        is_default: index === 0, // First one is default
      }));

      const { error: unidadesError } = await supabase
        .from('user_unidades')
        .insert(userUnidadesData);

      if (unidadesError) {
        console.error('Error inserting user_unidades:', unidadesError);
        // User was created but unidades failed - log but don't fail
      }
    }

    // 9. Create/update user profile: telefone (if specified) + force password change on first access
    if (newUser.user) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert(
          { user_id: newUser.user.id, telefone: telefone || null, must_change_password: true },
          { onConflict: 'user_id' },
        );

      if (profileError) {
        console.error('Error upserting user profile:', profileError);
        // User was created but profile failed - log but don't fail
      }
    }

    console.log(`Successfully created user ${email} with id ${newUser.user?.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUser.user?.id,
          email: newUser.user?.email,
          name: name || null,
          role: role || null,
          unidade_ids: unidade_ids || []
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Internal server error';
    console.error('Error in create-user function:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar a solicitação.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
