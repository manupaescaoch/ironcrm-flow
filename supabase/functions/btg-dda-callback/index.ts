import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { adminClient } from '../_shared/telegram.ts';
import { hash, trocarCodigo, cifrar } from '../_shared/btgDdaOAuth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const reply = (ok: boolean, message: string) => new Response(JSON.stringify({ ok, mensagem: message }), { status: ok ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  if (req.method !== 'GET') return reply(false, 'Método não permitido');
  try {
    const url = new URL(req.url);
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    if (!state || state.length > 200) return reply(false, 'Autorização inválida');
    const admin = adminClient();
    const { data: row, error } = await admin.from('btg_dda_oauth_estados').update({ consumido_em: new Date().toISOString() })
      .eq('state_hash', await hash(state)).is('consumido_em', null).gt('expira_em', new Date().toISOString()).select('*').maybeSingle();
    if (error || !row) return reply(false, 'Autorização expirada ou já utilizada');
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: row.user_id, _role: 'admin' });
    const { data: unit } = await admin.from('unidades').select('cnpj').eq('id', row.unidade_id).eq('ativo', true).maybeSingle();
    if (!isAdmin || unit?.cnpj?.replace(/\D/g, '') !== row.cnpj) return reply(false, 'Cadastro ou acesso mudou; inicie uma nova autorização');
    if (url.searchParams.has('error') || !code || code.length > 5000) return reply(false, 'Consentimento não concluído no BTG');
    const base = Deno.env.get('SUPABASE_URL');
    if (!base) throw new Error('Retorno bancário indisponível');
    const tokens = await trocarCodigo(code, `${base}/functions/v1/btg-dda-callback`);
    const { error: saveError } = await admin.from('btg_dda_conexoes').upsert({ unidade_id: row.unidade_id, cnpj: row.cnpj, tokens_cifrados: await cifrar(tokens), conectado_em: new Date().toISOString(), atualizado_por: row.user_id, ultimo_erro: null });
    if (saveError) throw new Error('Não foi possível salvar a autorização');
    return reply(true, 'Consentimento recebido. Volte ao Contas a Pagar e atualize o status. A consulta ainda depende da referência de listagem do BTG.');
  } catch (e) {
    return reply(false, e instanceof Error ? e.message : 'Não foi possível concluir a autorização');
  }
});