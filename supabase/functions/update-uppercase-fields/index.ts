import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função de padronização de nomes (mesmas regras dos mappers)
function padronizarNome(nome: string | null): string {
  if (!nome) return '';
  
  const normalizado = nome.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Excluir MANU e valores inválidos
  if (/^manu/.test(normalizado)) return '';
  if (/^0+$/.test(normalizado) || normalizado === '') return '';
  
  // Treinadores conhecidos
  if (/^josadaque/.test(normalizado)) return 'JOSADAQUE JOSE DA SILVA';
  if (/^(lucia|helena\s*leite)/.test(normalizado)) return 'LUCIA HELENA PINTO LOPES';
  if (/^(estela|stela)/.test(normalizado)) return 'STELA';
  if (/^thais/.test(normalizado)) return 'THAIS';
  if (/^(gabriela|gabi)/.test(normalizado)) return 'GABRIELA LIMA';
  if (/^natan/.test(normalizado)) return 'NATANAEL DA SILVA';
  if (/^andreza/.test(normalizado)) return 'ANDREZA TEODORO';
  if (/^gabriel/.test(normalizado)) return 'GABRIEL ARAUJO';
  if (/^giovan[na]/.test(normalizado)) return 'GIOVANNA KELLY DA SILVA';
  if (/^luan/.test(normalizado)) return 'LUAN MONTEIRO TEIXEIRA';
  if (/^(ana|bia)/.test(normalizado)) return 'ANA BEATRIZ';
  if (/^andre/.test(normalizado)) return 'ANDRE MOREIRA';
  if (/^charles/.test(normalizado)) return 'CHARLES';
  if (/^eduarda/.test(normalizado)) return 'EDUARDA';
  if (/^eduardo/.test(normalizado)) return 'EDUARDO';
  if (/^davi/.test(normalizado)) return 'DAVI';
  if (/^r[iy]an/.test(normalizado)) return 'RYAN';
  if (/^sistema/.test(normalizado)) return 'SISTEMA';
  
  // Se não encontrou padrão, retorna em maiúsculas
  return nome.trim().toUpperCase();
}

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
          persistSession: false
        }
      }
    )

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

    console.log('Starting name consolidation for leads and interacoes...')

    // Fetch all leads
    const { data: leads, error: leadsError } = await supabaseAdmin
      .from('leads')
      .select('id, cadastrado_por, atendido_por')

    if (leadsError) {
      console.error('Error fetching leads:', leadsError)
      throw leadsError
    }

    let leadsUpdated = 0
    for (const lead of leads || []) {
      const updates: Record<string, string | null> = {}
      
      if (lead.cadastrado_por) {
        const padronizado = padronizarNome(lead.cadastrado_por)
        if (padronizado !== lead.cadastrado_por) {
          updates.cadastrado_por = padronizado || null
        }
      }
      if (lead.atendido_por) {
        const padronizado = padronizarNome(lead.atendido_por)
        if (padronizado !== lead.atendido_por) {
          updates.atendido_por = padronizado || null
        }
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

    // Fetch all interacoes
    const { data: interacoes, error: interacoesError } = await supabaseAdmin
      .from('interacoes')
      .select('id, cadastrado_por, atendido_por, treinador_responsavel, treinador_experimental, responsavel_fechamento')

    if (interacoesError) {
      console.error('Error fetching interacoes:', interacoesError)
      throw interacoesError
    }

    let interacoesUpdated = 0
    for (const int of interacoes || []) {
      const updates: Record<string, string | null> = {}
      
      const fields = ['cadastrado_por', 'atendido_por', 'treinador_responsavel', 'treinador_experimental', 'responsavel_fechamento']
      
      for (const field of fields) {
        const valor = int[field as keyof typeof int] as string | null
        if (valor) {
          const padronizado = padronizarNome(valor)
          if (padronizado !== valor) {
            updates[field] = padronizado || null
          }
        }
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
        message: `Padronizados ${leadsUpdated} leads e ${interacoesUpdated} interações.`
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
