// Envia (ou reenvia) ao grupo financeiro a mensagem de uma conta a pagar.
// Chamada pelo frontend após o cadastro e pelo botão de reenvio manual.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processarEnvio, TipoEnvio } from '../_shared/contasPagarEnvio.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const contaId = typeof body?.conta_id === 'string' ? body.conta_id : '';
    const tipo = body?.tipo_envio === 'VENCIMENTO' ? 'VENCIMENTO' : 'CADASTRO';
    const reenviar = body?.reenviar === true;

    if (!/^[0-9a-f-]{36}$/i.test(contaId)) return json({ error: 'conta_id inválido' }, 400);

    // Permissão: só quem gerencia contas a pagar (admin/comercial) e tem acesso à unidade
    const { data: podeGerenciar } = await supabase.rpc('can_manage_contas_pagar', { _user_id: user.id });
    if (!podeGerenciar) return json({ error: 'Permissão negada' }, 403);

    const { data: conta } = await supabase
      .from('contas_pagar')
      .select('id, unidade_id')
      .eq('id', contaId)
      .maybeSingle();
    if (!conta) return json({ error: 'Conta não encontrada' }, 404);

    const { data: temAcesso } = await supabase.rpc('user_has_unidade_access', {
      _user_id: user.id,
      _unidade_id: conta.unidade_id,
    });
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!temAcesso && !isAdmin) return json({ error: 'Permissão negada' }, 403);

    // Reenvio manual: libera a fila para nova tentativa imediata
    if (reenviar) {
      await supabase
        .from('contas_pagar_envios')
        .update({ status: 'aguardando_envio', tentativas: 0, proxima_tentativa_em: new Date().toISOString() })
        .eq('conta_id', contaId)
        .eq('tipo_envio', tipo)
        .in('status', ['falhou', 'enviando']);
    }

    const result = await processarEnvio(supabase, contaId, tipo as TipoEnvio);
    return json(result, result.ok || result.skipped ? 200 : 502);
  } catch (e) {
    console.error('[send-conta-pagar-whatsapp]', e);
    return json({ ok: false, erro: 'Erro interno no envio' }, 500);
  }
});
