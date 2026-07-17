// One-off: envia aviso de troca de número operacional aos grupos internos.
// Executado manualmente. Delay randômico de 20-30s entre envios para evitar bloqueio.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getZapiCreds, sendText, sleep, logEnvio } from '../_shared/zapi.ts';

const GROUPS: { id: string; nome: string }[] = [
  { id: '120363403516159035-group', nome: 'IRON CLUB ZN GERAL' },
  { id: '120363285373147512-group', nome: 'IRON CLUB ZS GERAL' },
  { id: '120363423846997807-group', nome: 'SUPERVISÃO COMERCIAL ZN' },
  { id: '120363425937067624-group', nome: 'COORDENAÇÃO IRON ZN' },
  { id: '120363419881143524-group', nome: 'SUPERVISÃO COMERCIAL ZS' },
  { id: '120363400297699123-group', nome: 'TREINADORES IRON ZS' },
  { id: '120363421534618488-group', nome: 'TREINADORES IRON ZN' },
  { id: '120363405337702455-group', nome: 'COORDENAÇÃO IRON ZS' },
];

const MESSAGE = `Boa noite!

Foi necessário trocar o número operacional por conta de bloqueios na API.

Para evitar que isso aconteça novamente, pedimos que salvem este novo contato. Sempre que receberem alguma notificação, respondam em seguida com qualquer mensagem, mesmo que seja apenas um "ok", para que a conversa não seja identificada como automação.`;

function toDapiJid(id: string): string {
  // Converte `120363xxx-group` (formato Z-API) para `120363xxx@g.us` (formato D-API)
  const digits = id.replace(/-group$/i, '').replace(/@g\.us$/i, '');
  return `${digits}@g.us`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: claimsData } = await supabase.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (isAdmin !== true) return json({ error: 'Forbidden' }, 403);

    const creds = getZapiCreds('operacional');
    if (!creds) return json({ error: 'credenciais operacional ausentes' }, 500);

    const results: any[] = [];

    // Processa em background para não estourar timeout HTTP
    const run = async () => {
      for (let i = 0; i < GROUPS.length; i++) {
        const g = GROUPS[i];
        const to = creds.provider === 'dapi' ? toDapiJid(g.id) : g.id;
        try {
          const r = await sendText(creds, to, MESSAGE);
          const messageId = r.body?.messageId || r.body?.id || null;
          const ok = r.ok && !!messageId;
          results.push({ nome: g.nome, to, ok, status: r.status, messageId, body: r.body });
          console.log(`[broadcast-troca] ${g.nome} ok=${ok} status=${r.status}`, JSON.stringify(r.body).slice(0, 300));
          await logEnvio(supabase, {
            funcao: 'broadcast-troca-numero',
            destino: to,
            tipo_destino: 'grupo',
            sucesso: ok,
            erro_msg: ok ? null : JSON.stringify(r.body).slice(0, 500),
            zapi_status_code: r.status,
            canal: 'operacional',
            resposta_completa: r.body,
          });
        } catch (e) {
          console.error(`[broadcast-troca] erro ${g.nome}`, e);
          results.push({ nome: g.nome, to, ok: false, error: String(e) });
        }

        if (i < GROUPS.length - 1) {
          const delay = 20000 + Math.floor(Math.random() * 10001); // 20000-30000ms
          console.log(`[broadcast-troca] aguardando ${delay}ms antes do próximo envio`);
          await sleep(delay);
        }
      }
      console.log('[broadcast-troca] concluído', JSON.stringify(results));
    };

    // @ts-ignore EdgeRuntime
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(run());
    } else {
      run();
    }

    return json({
      ok: true,
      queued: GROUPS.length,
      message: 'Broadcast iniciado em background. Confira whatsapp_envios_log para detalhes.',
      groups: GROUPS.map((g) => g.nome),
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
