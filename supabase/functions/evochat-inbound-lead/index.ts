// Webhook de entrada do EVO Chat: cria lead com aula experimental agendada.
// Autenticação: header x-evochat-secret comparado em tempo constante com EVOCHAT_INBOUND_SECRET.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-evochat-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const UNIDADES: Record<string, string> = {
  boa_viagem: 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a',
  madalena: 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6',
  setubal: '00000000-0000-0000-0000-000000000000',
};

const PLANOS_VALIDOS = [
  'Executivo Mensal',
  'Mensal',
  'Trimestral',
  'Semestral',
  'Anual',
  'Executivo Anual',
];

const BodySchema = z.object({
  nome: z.string().trim().min(2).max(150),
  telefone: z.string().trim().min(8).max(30),
  unidade: z.enum(['boa_viagem', 'madalena', 'setubal']),
  data_aula_experimental: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'formato esperado YYYY-MM-DD'),
  hora_aula_experimental: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'formato esperado HH:MM'),
  email: z.string().trim().email().max(255).optional().nullable(),
  plano_escolhido: z.string().trim().max(100).optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const expected = Deno.env.get('EVOCHAT_INBOUND_SECRET');
  if (!expected || expected.length < 16) {
    console.error('[evochat-inbound-lead] EVOCHAT_INBOUND_SECRET ausente/curto');
    return json({ error: 'Servidor mal configurado' }, 500);
  }
  const provided = req.headers.get('x-evochat-secret') ?? '';
  if (!constantTimeEqual(provided, expected)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: 'Payload inválido', detalhes: parsed.error.flatten().fieldErrors }, 400);
  }
  const body = parsed.data;

  const unidadeId = UNIDADES[body.unidade];
  const plano =
    body.plano_escolhido && PLANOS_VALIDOS.includes(body.plano_escolhido)
      ? body.plano_escolhido
      : null;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // Duplicidade por unidade (mesma regra do trigger check_duplicate_lead)
    const { data: canon, error: canonErr } = await supabase.rpc('canonical_phone', {
      phone: body.telefone,
    });
    if (canonErr) throw canonErr;
    const telefoneCanonico = canon as string | null;

    if (telefoneCanonico) {
      const { data: existentes, error: dupErr } = await supabase
        .from('leads')
        .select('id, nome, ativo, telefone')
        .eq('unidade_id', unidadeId)
        .eq('telefone_normalizado', telefoneCanonico)
        .limit(1);
      if (dupErr) throw dupErr;
      if (existentes && existentes.length > 0) {
        const ex = existentes[0];
        return json(
          {
            error: 'lead_duplicado',
            message: `Já existe um lead com este telefone nesta unidade (${ex.nome}).`,
            lead_id: ex.id,
            ativo: ex.ativo,
          },
          409,
        );
      }
    }

    const dataHoraExperimental = `${body.data_aula_experimental}T${body.hora_aula_experimental}:00-03:00`;

    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .insert({
        nome: body.nome.toUpperCase(),
        email: body.email ?? null,
        telefone: body.telefone,
        origem: 'WHATSAPP',
        fonte: 'EVO CHAT',
        status_funil: 'aula_agendada',
        plano_escolhido: plano,
        data_aula_experimental: dataHoraExperimental,
        hora_aula_experimental: body.hora_aula_experimental,
        observacoes: body.observacoes ?? 'Confirmado via EVO Chat (WhatsApp)',
        unidade_id: unidadeId,
        cadastrado_por: 'EVO CHAT',
        ativo: true,
      })
      .select('id')
      .single();

    if (leadErr) {
      // 23505 = unique_violation (trigger de duplicidade)
      if ((leadErr as { code?: string }).code === '23505') {
        return json(
          { error: 'lead_duplicado', message: 'Telefone já cadastrado nesta unidade.' },
          409,
        );
      }
      throw leadErr;
    }

    const { error: intErr } = await supabase.from('interacoes').insert({
      lead_id: lead.id,
      tipo: 'WhatsApp',
      descricao: body.observacoes ?? 'Aula experimental confirmada via EVO Chat (WhatsApp)',
      agendou_experimental: true,
      data_experimental: body.data_aula_experimental,
      hora_experimental: body.hora_aula_experimental,
      tipo_atendimento: 'EVO CHAT (WHATSAPP)',
      atendido_por: 'EVO CHAT',
      atendido_por_tipo: 'evo_chat',
      cadastrado_por: 'EVO CHAT',
      quem_agendou: 'EVO CHAT',
      unidade_id: unidadeId,
      plano_escolhido: plano,
    });

    if (intErr) {
      console.error('[evochat-inbound-lead] falha ao gravar interação', intErr.message);
      return json(
        {
          ok: true,
          lead_id: lead.id,
          warning: 'Lead criado, mas a interação não foi registrada.',
        },
        201,
      );
    }

    console.log('[evochat-inbound-lead] lead criado', lead.id, body.unidade);
    return json(
      {
        ok: true,
        lead_id: lead.id,
        status_funil: 'aula_agendada',
        unidade_id: unidadeId,
        data_aula_experimental: body.data_aula_experimental,
        hora_aula_experimental: body.hora_aula_experimental,
      },
      201,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro desconhecido';
    console.error('[evochat-inbound-lead] erro', msg);
    if (msg.includes('Lead duplicado')) {
      return json({ error: 'lead_duplicado', message: msg }, 409);
    }
    return json({ error: 'Erro ao criar lead' }, 500);
  }
});
