import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await authorizeCronOrJwt(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
      status: auth.status || 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json();
    const {
      task_id,
      task_title,
      task_description,
      responsavel_name,
      responsavel,
      tipo,
      creator_name,
      unidade_nome,
      prazo,
      hora_prazo,
    } = body ?? {};

    const targetName: string | undefined = responsavel_name || responsavel;
    const title: string | undefined = task_title;
    const notificationType: string = tipo || 'nova_tarefa';

    if (!targetName || !title) {
      return new Response(JSON.stringify({ error: 'responsavel e task_title são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.error('Erro ao listar usuários:', authError);
      return new Response(JSON.stringify({ error: 'Erro interno' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const target = authUsers.users.find((u) => {
      const name = (u.user_metadata?.full_name || u.user_metadata?.name || '') as string;
      return name.toUpperCase().trim() === String(targetName).toUpperCase().trim();
    });

    if (!target) {
      console.log(`Usuário não encontrado: ${targetName}`);
      return new Response(JSON.stringify({ success: false, reason: 'user_not_found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let prazoStr = '';
    if (prazo) {
      const [y, m, d] = String(prazo).slice(0, 10).split('-');
      prazoStr = `${d}/${m}/${y}`;
      if (hora_prazo) prazoStr += ` às ${String(hora_prazo).slice(0, 5)}`;
    }

    const titulos: Record<string, string> = {
      nova_tarefa: 'Nova tarefa atribuída',
      tarefa_atualizada: 'Tarefa transferida para você',
      prazo_24h: 'Tarefa vence amanhã',
      prazo_final: 'Prazo final da tarefa',
    };

    const linhas: string[] = [`Tarefa: ${title}`];
    if (unidade_nome) linhas.push(`Unidade: ${unidade_nome}`);
    if (prazoStr) linhas.push(`Prazo: ${prazoStr}`);
    if (creator_name) linhas.push(`Atribuída por: ${creator_name}`);
    if (task_description) linhas.push(`Descrição: ${task_description}`);

    const { error: insertError } = await supabase.from('ops_notificacoes').insert({
      usuario_id: target.id,
      tipo: notificationType,
      titulo: titulos[notificationType] || 'Atualização de tarefa',
      mensagem: linhas.join('\n'),
    });

    if (insertError) {
      console.error('Erro ao criar notificação OPS:', insertError);
      return new Response(JSON.stringify({ error: 'Erro ao criar notificação' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Notificação OPS criada para ${targetName} (task ${task_id ?? 'nova'})`);

    return new Response(JSON.stringify({ success: true, usuario_id: target.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    console.error('Erro em ops-notify-task:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
