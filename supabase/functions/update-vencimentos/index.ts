import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateItem {
  nome: string;
  vencimento: string;
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const parseVencimentoDate = (dateStr: string): string | null => {
  if (!dateStr) return null;
  try {
    const [day, month, year] = dateStr.trim().split('/');
    if (!day || !month || !year) return null;
    const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return iso;
  } catch {
    return null;
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1. Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json(401, { error: 'Não autenticado' });
    }
    const token = authHeader.replace('Bearer ', '');

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json(401, { error: 'Não autenticado' });
    }
    const userId = userData.user.id;

    // Service-role client for privileged validations/writes
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Authorization — admin OR user role (financeiro/comercial)
    const { data: isAdminData } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    });
    const isAdmin = !!isAdminData;

    let isAuthorizedUser = isAdmin;
    if (!isAdmin) {
      const { data: isUserRole } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'user',
      });
      isAuthorizedUser = !!isUserRole;
    }
    if (!isAuthorizedUser) {
      return json(403, { error: 'Sem permissão' });
    }

    // Parse + validate body
    let body: { updates?: UpdateItem[]; unidade_id?: string };
    try {
      body = await req.json();
    } catch {
      return json(400, { error: 'Payload inválido' });
    }
    const { updates, unidade_id } = body;

    if (!unidade_id || typeof unidade_id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(unidade_id)) {
      return json(400, { error: 'unidade_id inválido' });
    }
    if (!Array.isArray(updates) || updates.length === 0) {
      return json(400, { error: 'Lista de atualizações vazia ou inválida' });
    }
    if (updates.length > 1000) {
      return json(400, { error: 'Lista excede o limite permitido' });
    }

    // 3. Scope by unit — non-admin must belong to the requested unidade
    if (!isAdmin) {
      const { data: unidades, error: unidadesErr } = await supabase.rpc('get_user_unidades', {
        _user_id: userId,
      });
      if (unidadesErr) {
        console.error('get_user_unidades error', unidadesErr);
        return json(500, { error: 'Erro ao validar unidade' });
      }
      const allowed = (unidades as string[] | null)?.includes(unidade_id);
      if (!allowed) {
        return json(403, { error: 'Sem acesso à unidade informada' });
      }
    }

    const results = { success: 0, notFound: 0, errors: [] as string[] };

    for (const item of updates) {
      try {
        if (!item || typeof item.nome !== 'string' || typeof item.vencimento !== 'string') {
          results.errors.push('item inválido');
          continue;
        }
        const nome = item.nome.trim().slice(0, 255);
        if (!nome) {
          results.errors.push('nome vazio');
          continue;
        }

        const dataVencimento = parseVencimentoDate(item.vencimento);
        if (!dataVencimento) {
          results.errors.push(`${nome}: data de vencimento inválida`);
          continue;
        }

        // Find lead by name within the validated unit
        const { data: lead, error: leadErr } = await supabase
          .from('leads')
          .select('id, unidade_id')
          .eq('unidade_id', unidade_id)
          .ilike('nome', nome)
          .maybeSingle();

        if (leadErr) {
          console.error('lead lookup error', leadErr);
          results.errors.push(`${nome}: erro ao localizar`);
          continue;
        }
        if (!lead) {
          results.notFound++;
          continue;
        }

        // Find the most recent matricula interaction (also scoped by unidade)
        const { data: interacao, error: intErr } = await supabase
          .from('interacoes')
          .select('id, data_vencimento, unidade_id')
          .eq('lead_id', lead.id)
          .eq('unidade_id', unidade_id)
          .eq('fechou_matricula', true)
          .order('data_fechamento', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (intErr) {
          console.error('interacao lookup error', intErr);
          results.errors.push(`${nome}: erro ao localizar matrícula`);
          continue;
        }
        if (!interacao) {
          results.notFound++;
          continue;
        }

        const previousVencimento = interacao.data_vencimento;

        const { error: updateError } = await supabase
          .from('interacoes')
          .update({ data_vencimento: dataVencimento })
          .eq('id', interacao.id)
          .eq('unidade_id', unidade_id);

        if (updateError) {
          console.error('update error', updateError);
          results.errors.push(`${nome}: falha ao atualizar`);
          continue;
        }

        // 7. Audit log
        console.log(JSON.stringify({
          audit: 'update_vencimento',
          user_id: userId,
          interacao_id: interacao.id,
          lead_id: lead.id,
          unidade_id,
          previous_vencimento: previousVencimento,
          new_vencimento: dataVencimento,
          at: new Date().toISOString(),
        }));

        results.success++;
      } catch (err) {
        console.error('item processing error', err);
        results.errors.push('erro ao processar item');
      }
    }

    return json(200, {
      message: `Atualização concluída: ${results.success} atualizados, ${results.notFound} não encontrados`,
      ...results,
    });
  } catch (error) {
    console.error('update-vencimentos fatal', error);
    return json(500, { error: 'Erro interno' });
  }
});
