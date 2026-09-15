// Envio de teste: respostas de formulários de uma data para os grupos do Telegram.
import { adminClient, sendTelegramMessage } from '../_shared/telegram.ts';
import { buildMessage, TipoFormulario } from '../_shared/notifyFormularioCore.ts';

const TIPO_TABLE: Record<TipoFormulario, string> = {
  estagiario_lider: 'encerramento_turno_respostas',
  coordenador_unidade: 'encerramento_coordenador_respostas',
  coordenador_horario: 'encerramento_horario_respostas',
  relatorio_comercial: 'relatorio_diario_comercial_respostas',
  coordenador_tecnico: 'encerramento_tecnico_respostas',
};

const TIPO_GRUPO: Record<TipoFormulario, string> = {
  estagiario_lider: 'coordenadores',
  coordenador_unidade: 'gerencia',
  coordenador_horario: 'coordenadores',
  relatorio_comercial: 'comercial',
  coordenador_tecnico: 'gerencia',
};

const UNIDADE_ID: Record<string, string> = {
  'MADALENA': 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6',
  'BOA VIAGEM': 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a',
  'SETUBAL': '00000000-0000-0000-0000-000000000000',
  'SETÚBAL': '00000000-0000-0000-0000-000000000000',
};

function normalizeUnidade(u: unknown): string {
  return String(u ?? '').toUpperCase().trim().replace(/^EVO\s+/, '');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const expected = Deno.env.get('TELEGRAM_TEST_SECRET');
  if (!expected || req.headers.get('x-test-secret') !== expected) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const date = String(body?.date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response(JSON.stringify({ error: 'date inválida (YYYY-MM-DD)' }), { status: 400 });
  }
  const dryRun = body?.dry_run === true;

  const admin = adminClient();
  const { data: grupos } = await admin
    .from('telegram_groups')
    .select('id, group_type, unidade_id, telegram_chat_id, telegram_title, status')
    .eq('status', 'conectado');

  const results: unknown[] = [];

  for (const [tipo, table] of Object.entries(TIPO_TABLE) as [TipoFormulario, string][]) {
    const { data: rows, error } = await admin
      .from(table)
      .select('*')
      .gte('created_at', `${date}T00:00:00Z`)
      .lt('created_at', `${date}T23:59:59.999Z`)
      .order('created_at', { ascending: true });
    if (error) {
      results.push({ tipo, error: error.message });
      continue;
    }
    for (const row of rows ?? []) {
      const unidade = normalizeUnidade((row as any).unidade);
      const unidadeId = UNIDADE_ID[unidade];
      const grupo = (grupos ?? []).find(
        (g: any) => g.group_type === TIPO_GRUPO[tipo] && String(g.unidade_id) === unidadeId,
      );
      if (!grupo) {
        results.push({ tipo, id: (row as any).id, unidade, status: 'sem_grupo' });
        continue;
      }
      const canonical = unidade === 'SETUBAL' ? 'SETUBAL' : unidade;
      const text = `🧪 *TESTE DE INTEGRAÇÃO — TELEGRAM*\n\n${buildMessage(tipo, canonical, row as Record<string, unknown>)}`;

      if (dryRun) {
        results.push({ tipo, id: (row as any).id, unidade, grupo: grupo.telegram_title, chars: text.length, status: 'dry_run' });
        continue;
      }

      let r = await sendTelegramMessage({
        chat_id: Number(grupo.telegram_chat_id),
        text,
        parse_mode: 'Markdown',
        recipient_type: 'grupo',
        recipient_id: grupo.id,
        message_type: `teste_${tipo}`,
      }, admin);

      if (!r.ok) {
        // Fallback sem formatação, caso o texto quebre o parser do Telegram.
        r = await sendTelegramMessage({
          chat_id: Number(grupo.telegram_chat_id),
          text: text.replace(/\*/g, ''),
          recipient_type: 'grupo',
          recipient_id: grupo.id,
          message_type: `teste_${tipo}`,
        }, admin);
      }

      results.push({
        tipo,
        id: (row as any).id,
        unidade,
        grupo: grupo.telegram_title,
        status: r.ok ? 'enviado' : 'erro',
        error: r.error ?? null,
      });
    }
  }

  return new Response(JSON.stringify({ date, total: results.length, results }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
});
