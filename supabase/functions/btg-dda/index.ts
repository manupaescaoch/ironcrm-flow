import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.25.76';
import { adminClient } from '../_shared/telegram.ts';
import { BTG_AUTHORIZE, BTG_READ_SCOPE, credenciaisBtg, hash } from '../_shared/btgDdaOAuth.ts';

const Body = z.object({ action: z.enum(['status', 'autorizar', 'consultar']), unidade_id: z.string().uuid() });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Não autorizado' }, 401);
    const admin = adminClient();
    const { data: claims } = await admin.auth.getClaims(auth.slice(7));
    const userId = claims?.claims?.sub;
    if (!userId) return json({ error: 'Sessão inválida' }, 401);
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (!isAdmin) return json({ error: 'Somente administradores podem conectar o BTG' }, 403);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'Ação ou unidade inválida' }, 400);
    const { action, unidade_id } = parsed.data;
    const { data: unit } = await admin.from('unidades').select('id, nome, cnpj').eq('id', unidade_id).eq('ativo', true).maybeSingle();
    if (!unit) return json({ error: 'Unidade não encontrada' }, 404);
    const cnpj = unit.cnpj?.replace(/\D/g, '') ?? '';
    const { data: connection } = await admin.from('btg_dda_conexoes').select('cnpj, conectado_em, ultima_consulta_em, ultimo_erro').eq('unidade_id', unidade_id).maybeSingle();
    const base = Deno.env.get('SUPABASE_URL');
    if (!base) throw new Error('Retorno bancário indisponível');
    const callback = `${base}/functions/v1/btg-dda-callback`;
    if (action === 'status') return json({ credenciais: !!Deno.env.get('BTG_DDA_CLIENT_ID') && !!Deno.env.get('BTG_DDA_CLIENT_SECRET'), cnpj, conectado: !!connection?.conectado_em && connection.cnpj === cnpj, conectado_em: connection?.conectado_em, ultima_consulta_em: connection?.ultima_consulta_em, consulta_disponivel: false, callback });
    if (action === 'consultar') return json({ error: 'A referência oficial ainda não confirmou o endereço e a paginação da listagem DDA. Nenhum boleto foi importado.' }, 409);
    if (cnpj.length !== 14) return json({ error: 'Cadastre o CNPJ da unidade antes de autorizar' }, 400);
    const { clientId } = credenciaisBtg();
    const state = crypto.randomUUID() + crypto.randomUUID();
    const { error } = await admin.from('btg_dda_oauth_estados').insert({ state_hash: await hash(state), unidade_id, cnpj, user_id: userId, expira_em: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
    if (error) throw new Error('Não foi possível iniciar o consentimento');
    const url = new URL(BTG_AUTHORIZE);
    url.search = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: callback, scope: BTG_READ_SCOPE, state }).toString();
    return json({ url: url.toString() });
  } catch (e) { return json({ error: e instanceof Error ? e.message : 'Não foi possível acessar o BTG' }, 500); }
});