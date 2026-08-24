// Envia (ou reenvia) ao grupo financeiro a mensagem de uma conta a pagar.
// Chamada pelo frontend após o cadastro e pelo botão de reenvio manual.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';
import { processarEnvio, TipoEnvio } from '../_shared/contasPagarEnvio.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validação por schema da entrada (mantém o mesmo contrato de resposta).
const BodySchema = z
  .object({
    conta_id: z.string().uuid(),
    tipo_envio: z.enum(['CADASTRO', 'VENCIMENTO']).optional(),
    reenviar: z.boolean().optional(),
  })
  .passthrough();

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

    const rawBody = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) return json({ error: 'conta_id inválido' }, 400);

    const contaId = parsed.data.conta_id;
    const tipo = parsed.data.tipo_envio === 'VENCIMENTO' ? 'VENCIMENTO' : 'CADASTRO';
    const reenviar = parsed.data.reenviar === true;


    const { data: conta } = await supabase
      .from('contas_pagar')
      .select('id, unidade_id')
      .eq('id', contaId)
      .maybeSingle();
    if (!conta) return json({ error: 'Conta não encontrada' }, 404);

    // Qualquer usuário com acesso à unidade pode disparar o envio de CADASTRO.
    // Reenvio manual continua restrito a quem gerencia contas a pagar.
    const { data: temAcesso } = await supabase.rpc('user_has_unidade_access', {
      _user_id: user.id,
      _unidade_id: conta.unidade_id,
    });
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!temAcesso && !isAdmin) return json({ error: 'Permissão negada' }, 403);

    if (reenviar) {
      const { data: podeGerenciar } = await supabase.rpc('can_manage_contas_pagar', { _user_id: user.id });
      if (!podeGerenciar && !isAdmin) return json({ error: 'Permissão negada' }, 403);
    }


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
