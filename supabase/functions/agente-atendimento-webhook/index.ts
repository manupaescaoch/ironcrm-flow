// Webhook público para receber mensagens (Z-API) e acionar o agente SDR
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');
const WEBHOOK_SECRET = Deno.env.get('AGENTE_WEBHOOK_SECRET');

function normalizePhone(p: string): string {
  return (p || '').replace(/\D/g, '');
}

function extractPayload(body: any): {
  telefone: string;
  nome?: string;
  mensagem: string;
  fromMe: boolean;
  messageId?: string;
} | null {
  if (!body) return null;
  // Z-API format
  const telefone = normalizePhone(body.phone || body.from || body.sender || body.telefone || '');
  const nome = body.senderName || body.chatName || body.nome || undefined;
  const mensagem =
    body?.text?.message ||
    body?.message?.text ||
    body?.mensagem ||
    body?.body ||
    body?.text ||
    '';
  const fromMe = !!(body.fromMe || body.isFromMe);
  const messageId = body.messageId || body.id || undefined;
  if (!telefone || !mensagem || typeof mensagem !== 'string') return null;
  return { telefone, nome, mensagem, fromMe, messageId };
}

async function sendWhatsApp(phone: string, message: string) {
  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
    console.warn('Z-API não configurada — resposta não enviada');
    return;
  }
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ZAPI_CLIENT_TOKEN ? { 'Client-Token': ZAPI_CLIENT_TOKEN } : {}),
      },
      body: JSON.stringify({ phone, message }),
    });
    if (!resp.ok) console.error('Z-API erro:', resp.status, await resp.text());
  } catch (e) {
    console.error('Falha enviando Z-API:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const url = new URL(req.url);
    const agenteId = url.searchParams.get('agente_id');
    const token = url.searchParams.get('token') || req.headers.get('x-webhook-token');

    if (!agenteId) return json({ error: 'agente_id obrigatório' }, 400);
    if (WEBHOOK_SECRET && token !== WEBHOOK_SECRET) {
      return json({ error: 'Token inválido' }, 401);
    }

    const body = await req.json().catch(() => null);
    const payload = extractPayload(body);
    if (!payload) return json({ ok: true, ignored: 'payload sem telefone/mensagem' });
    if (payload.fromMe) return json({ ok: true, ignored: 'fromMe' });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Buscar agente
    const { data: agente, error: agErr } = await supabase
      .from('agentes_atendimento')
      .select('*')
      .eq('id', agenteId)
      .maybeSingle();

    if (agErr || !agente) return json({ error: 'Agente não encontrado' }, 404);
    if (agente.status !== 'ativo') {
      return json({ ok: true, ignored: 'agente inativo' });
    }

    const unidadeId = agente.unidade_id;
    const telefone = payload.telefone;

    // Localizar lead por telefone normalizado na mesma unidade
    const { data: leadsMatch } = await supabase
      .from('leads')
      .select('id, nome, telefone, unidade_id')
      .eq('unidade_id', unidadeId)
      .eq('ativo', true);

    let leadId: string | null = null;
    if (leadsMatch) {
      const found = leadsMatch.find((l: any) => normalizePhone(l.telefone) === telefone);
      if (found) leadId = found.id;
    }

    // Localizar atendimento aberto
    let { data: atendimento } = await supabase
      .from('agente_atendimentos')
      .select('*')
      .eq('agente_id', agente.id)
      .eq('telefone', telefone)
      .not('status', 'in', '("finalizado")')
      .order('ultima_interacao_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Gatilho de ativação: se ainda não há atendimento ativo, exige a frase configurada
    const normalize = (s: string) =>
      (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const gatilho: string | null = agente.gatilho_ativacao || null;
    if (!atendimento) {
      if (gatilho && gatilho.trim()) {
        const gNorm = normalize(gatilho);
        const mNorm = normalize(payload.mensagem);
        if (!mNorm.includes(gNorm)) {
          return json({ ok: true, ignored: 'aguardando gatilho de ativação' });
        }
      }
      const { data: novo, error: insErr } = await supabase
        .from('agente_atendimentos')
        .insert({
          agente_id: agente.id,
          unidade_id: unidadeId,
          lead_id: leadId,
          nome: payload.nome || null,
          telefone,
          canal: 'whatsapp',
          status: 'em_atendimento',
        })
        .select()
        .single();
      if (insErr) {
        console.error('Erro criando atendimento:', insErr);
        return json({ error: 'Falha ao criar atendimento' }, 500);
      }
      atendimento = novo;
    } else {
      await supabase
        .from('agente_atendimentos')
        .update({
          ultima_interacao_at: new Date().toISOString(),
          status: atendimento.status === 'novo' ? 'em_atendimento' : atendimento.status,
          ...(payload.nome && !atendimento.nome ? { nome: payload.nome } : {}),
          ...(leadId && !atendimento.lead_id ? { lead_id: leadId } : {}),
        })
        .eq('id', atendimento.id);
    }

    // Salvar mensagem do usuário
    await supabase.from('agente_mensagens').insert({
      atendimento_id: atendimento.id,
      unidade_id: unidadeId,
      role: 'user',
      conteudo: payload.mensagem,
      external_message_id: payload.messageId || null,
    });

    // Montar histórico
    const { data: historico } = await supabase
      .from('agente_mensagens')
      .select('role, conteudo')
      .eq('atendimento_id', atendimento.id)
      .order('created_at', { ascending: true })
      .limit(40);

    const reforco =
      '\n\nINSTRUÇÕES DE FORMATAÇÃO (OBRIGATÓRIAS, NÃO IGNORE):\n' +
      '- Siga EXATAMENTE a formatação, tom, emojis, quebras de linha e estrutura definidos acima.\n' +
      '- Você responde via WhatsApp: use *texto* para negrito (UM asterisco), nunca **texto** nem markdown de cabeçalho (#).\n' +
      '- Use _texto_ para itálico e ~texto~ para tachado, padrão WhatsApp.\n' +
      '- Mantenha mensagens curtas, divididas em blocos quando o prompt pedir.\n' +
      '- Use os emojis especificados no prompt nos locais indicados.\n' +
      '- Não invente informações fora do escopo do prompt.\n' +
      '- IMPORTANTE: Quando o prompt pedir para dividir em mensagens separadas (ex: "envie em 2/3 mensagens"), separe cada mensagem usando exclusivamente o delimitador "---" em uma linha sozinha entre elas. Não use "---" para qualquer outra finalidade.';

    const basePrompt = agente.prompt || 'Você é um SDR cordial do Iron Club.';
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: basePrompt + reforco },
    ];
    if (agente.mensagem_inicial && !(historico && historico.some((m: any) => m.role === 'assistant'))) {
      messages.push({ role: 'assistant', content: agente.mensagem_inicial });
    }
    for (const m of historico || []) {
      if (m.role === 'user' || m.role === 'assistant') {
        messages.push({ role: m.role, content: m.conteudo });
      }
    }

    // Chamar IA
    if (!LOVABLE_API_KEY) return json({ error: 'IA não configurada' }, 500);

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'google/gemini-2.5-pro', temperature: 0.4, messages }),
    });

    if (!aiResp.ok) {
      console.error('IA falhou:', aiResp.status, await aiResp.text());
      return json({ error: 'Falha IA' }, 500);
    }
    const aiData = await aiResp.json();
    const resposta: string = aiData?.choices?.[0]?.message?.content ?? '';
    if (!resposta) return json({ ok: true, warn: 'resposta vazia' });

    // Detectar solicitação de experimental (heurística)
    const lower = resposta.toLowerCase() + ' ' + payload.mensagem.toLowerCase();
    const experimentalDetectada =
      /experimental/.test(lower) && /(agend|marc|solicit|confirm|reserv)/.test(lower);

    // Dividir resposta em múltiplas mensagens (delimitador "---" em linha própria)
    const partes = resposta
      .split(/\n\s*-{3,}\s*\n/g)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    // Salvar resposta completa (com delimitadores removidos)
    await supabase.from('agente_mensagens').insert({
      atendimento_id: atendimento.id,
      unidade_id: unidadeId,
      role: 'assistant',
      conteudo: partes.join('\n\n'),
    });

    const updates: Record<string, unknown> = {
      ultima_interacao_at: new Date().toISOString(),
    };
    if (experimentalDetectada && !atendimento.experimental_solicitada) {
      updates.experimental_solicitada = true;
      updates.status = 'experimental_solicitada';
    } else if (atendimento.status === 'novo') {
      updates.status = 'em_atendimento';
    }
    await supabase.from('agente_atendimentos').update(updates).eq('id', atendimento.id);

    // Enviar via Z-API (uma mensagem por parte)
    for (let i = 0; i < partes.length; i++) {
      await sendWhatsApp(telefone, partes[i]);
      if (i < partes.length - 1) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    // Mensagem pós-solicitação configurada
    if (experimentalDetectada && agente.mensagem_pos_solicitacao && !atendimento.experimental_solicitada) {
      await sendWhatsApp(telefone, agente.mensagem_pos_solicitacao);
      await supabase.from('agente_mensagens').insert({
        atendimento_id: atendimento.id,
        unidade_id: unidadeId,
        role: 'assistant',
        conteudo: agente.mensagem_pos_solicitacao,
      });
    }

    return json({ ok: true, atendimento_id: atendimento.id, experimental: experimentalDetectada });
  } catch (err) {
    console.error('Webhook erro:', err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
