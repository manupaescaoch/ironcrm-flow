import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get authorization header to verify user is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    })

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only admins can run this operation' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Starting uppercase update for leads and interacoes...')

    // Fetch all leads with non-null cadastrado_por or atendido_por
    const { data: leads, error: leadsError } = await supabaseAdmin
      .from('leads')
      .select('id, cadastrado_por, atendido_por')

    if (leadsError) {
      console.error('Error fetching leads:', leadsError)
      throw leadsError
    }

    let leadsUpdated = 0
    for (const lead of leads || []) {
      const updates: Record<string, string> = {}
      
      if (lead.cadastrado_por && lead.cadastrado_por !== lead.cadastrado_por.toUpperCase()) {
        updates.cadastrado_por = lead.cadastrado_por.toUpperCase()
      }
      if (lead.atendido_por && lead.atendido_por !== lead.atendido_por.toUpperCase()) {
        updates.atendido_por = lead.atendido_por.toUpperCase()
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabaseAdmin
          .from('leads')
          .update(updates)
          .eq('id', lead.id)

        if (error) {
          console.error(`Error updating lead ${lead.id}:`, error)
        } else {
          leadsUpdated++
        }
      }
    }

    console.log(`Updated ${leadsUpdated} leads`)

    // Fetch all interacoes with non-null cadastrado_por or atendido_por
    const { data: interacoes, error: interacoesError } = await supabaseAdmin
      .from('interacoes')
      .select('id, cadastrado_por, atendido_por')

    if (interacoesError) {
      console.error('Error fetching interacoes:', interacoesError)
      throw interacoesError
    }

    let interacoesUpdated = 0
    for (const int of interacoes || []) {
      const updates: Record<string, string> = {}
      
      if (int.cadastrado_por && int.cadastrado_por !== int.cadastrado_por.toUpperCase()) {
        updates.cadastrado_por = int.cadastrado_por.toUpperCase()
      }
      if (int.atendido_por && int.atendido_por !== int.atendido_por.toUpperCase()) {
        updates.atendido_por = int.atendido_por.toUpperCase()
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabaseAdmin
          .from('interacoes')
          .update(updates)
          .eq('id', int.id)

        if (error) {
          console.error(`Error updating interacao ${int.id}:`, error)
        } else {
          interacoesUpdated++
        }
      }
    }

    console.log(`Updated ${interacoesUpdated} interacoes`)

    return new Response(
      JSON.stringify({ 
        success: true,
        leadsUpdated,
        interacoesUpdated,
        message: `Atualizados ${leadsUpdated} leads e ${interacoesUpdated} interações para caixa alta.`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
