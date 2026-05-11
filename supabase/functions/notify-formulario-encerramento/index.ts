import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Item { label: string; value: string }
interface Payload {
  formulario_key: string;
  unidade: string;
  titulo?: string;
  items?: Item[];
  resumo?: string; // legado
}

// Mapeia emoji por palavra-chave do label
function emojiForLabel(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('nome')) return '👤';
  if (l.includes('unidade')) return '📍';
  if (l.includes('turno')) return '🕘';
  if (l.includes('horário') || l.includes('horario')) return '⏰';
  if (l.includes('experimenta')) return '🧪';
  if (l.includes('ocorrência') || l.includes('ocorrencia')) return '⚠️';
  if (l.includes('padrão') || l.includes('padrao') || l.includes('protocolo')) return '✅';
  if (l.includes('feedback')) return '💬';
  if (l.includes('clima')) return '🌡️';
  if (l.includes('equipamento')) return '🛠️';
  if (l.includes('faria diferente') || l.includes('observa') || l.includes('gestão') || l.includes('gestao')) return '📝';
  if (l.includes('suporte')) return '🆘';
  if (l.includes('matrícul') || l.includes('matricul')) return '🎟️';
  if (l.includes('lead')) return '🎯';
  if (l.includes('cancela')) return '❌';
  if (l.includes('renova')) return '🔁';
  if (l.includes('financ') || l.includes('venda') || l.includes('faturamento') || l.includes('valor')) return '💰';
  if (l.includes('presenç') || l.includes('presenc')) return '📊';
  if (l.includes('treinador') || l.includes('professor')) return '🏋️';
  if (l.includes('aluno')) return '🎓';
  if (l.includes('observ')) return '📝';
  return '•';
}

// Hash simples para idempotência
async function sha1(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Cache em memória (mesma instância) para deduplicar envios rápidos
const recentSends = new Map<string, number>();
function alreadySent(hash: string, windowMs = 90_000): boolean {
  const now = Date.now();
  // limpa antigos
  for (const [k, t] of recentSends) if (now - t > windowMs) recentSends.delete(k);
  if (recentSends.has(hash)) return true;
  recentSends.set(hash, now);
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<Payload>;
    const { formulario_key, unidade, titulo, items, resumo } = body;

    if (!formulario_key || !unidade || (!items?.length && !resumo)) {
      return new Response(
        JSON.stringify({ error: 'formulario_key, unidade e items/resumo são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: cfg } = await supabase
      .from('formulario_grupos_whatsapp')
      .select('grupo_id, ativo')
      .eq('formulario_key', formulario_key)
      .eq('unidade', unidade.toUpperCase())
      .maybeSingle();

    if (!cfg || !cfg.ativo || !cfg.grupo_id) {
      console.log('[encerramento] grupo não configurado/ativo — pulando envio.', { formulario_key, unidade });
      return new Response(JSON.stringify({ ok: true, sent: false, reason: 'no_group' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Idempotência: bloqueia envio idêntico em janela de 90s
    const payloadKey = JSON.stringify({ formulario_key, unidade, titulo, items, resumo });
    const hash = await sha1(payloadKey);
    if (alreadySent(hash)) {
      console.log('[encerramento] envio duplicado bloqueado', { formulario_key, unidade, hash });
      return new Response(JSON.stringify({ ok: true, sent: false, reason: 'duplicate' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
    const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN') || '';
    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) throw new Error('Z-API não configurada');

    const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const cabecalho = titulo ? `✅ *${titulo}*` : '✅ *Novo formulário recebido*';

    let corpo = '';
    if (items?.length) {
      corpo = items
        .map((it) => `${emojiForLabel(it.label)} *${it.label}:* ${it.value}`)
        .join('\n');
    } else {
      corpo = resumo || '';
    }

    const message = `${cabecalho}

📍 *Unidade:* ${unidade}
🕒 *Recebido em:* ${dataHora}

${corpo}`;

    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN },
      body: JSON.stringify({ phone: cfg.grupo_id, message }),
    });
    const result = await resp.json().catch(() => ({}));

    return new Response(
      JSON.stringify({ ok: resp.ok, status: resp.status, sent: resp.ok, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('[notify-formulario-encerramento] erro', e);
    return new Response(JSON.stringify({ error: e?.message ?? 'erro' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
