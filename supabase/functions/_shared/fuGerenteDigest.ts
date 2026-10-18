import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { resolveGrupoUnidade, sendTelegramMessage } from './telegram.ts';
import { isManagerFuWeekday, managerFuStage, recifeDay, suppressManagerFu } from './fuGerenteRules.ts';
import { addFuBusinessDays, fuDay, fuDate } from './fuBusinessDays.ts';

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Reuses the existing 08:00 callback; never changes FU completion state. */
export async function sendManagerFuDigest(admin: SupabaseClient, dryRun = false, now = new Date()) {
  if (!dryRun && !isManagerFuWeekday(now)) return { success: true, skipped: 'fim_de_semana', results: [] };
  const today = recifeDay(now);
  const cutoff = new Date(`${today}T12:00:00-03:00`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 65);
  const { data: units, error: unitError } = await admin.from('unidades').select('id,nome').order('nome');
  if (unitError) throw unitError;
  const results = [];
  for (const unit of units ?? []) {
    const grupo = await resolveGrupoUnidade(admin, unit.id, ['gerencia']);
    if (!grupo) {
      results.push({ unidade: unit.nome, status: 'grupo_nao_conectado' });
      continue;
    }
    const enrollments = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await admin.from('interacoes')
        .select('id,lead_id,data_fechamento,leads!inner(id,nome,telefone,unidade_id,is_matriculado,ativo)')
        .eq('unidade_id', unit.id).eq('fechou_matricula', true)
        .gte('data_fechamento', cutoff.toISOString().slice(0, 10)).lte('data_fechamento', today)
        .order('data_fechamento', { ascending: false }).order('id').range(offset, offset + 499);
      if (error) throw error;
      enrollments.push(...(data ?? []));
      if ((data?.length ?? 0) < 500) break;
    }
    const latest = new Map();
    for (const row of enrollments) {
      const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
      if (lead?.unidade_id !== unit.id || lead?.is_matriculado !== true || lead?.ativo === false) continue;
      if (!latest.has(row.lead_id)) latest.set(row.lead_id, { ...row, lead });
    }
    const follows: { lead_id: string; tipo: string; status: string; data_prevista: string | null }[] = [];
    const ids = [...latest.keys()];
    for (let start = 0; start < ids.length; start += 100) {
      const { data, error } = await admin.from('follow_ups').select('lead_id,tipo,status,data_prevista')
        .eq('unidade_id', unit.id).in('lead_id', ids.slice(start, start + 100)).in('tipo', ['G+7', 'G+30']);
      if (error) throw error;
      follows.push(...(data ?? []));
    }
    const pending = [...latest.values()].flatMap(row => {
      const stage = managerFuStage(row.data_fechamento, today);
      if (!stage || suppressManagerFu(follows.filter(f => f.lead_id === row.lead_id && f.tipo === stage.tipo), today)) return [];
      if (fuDay(addFuBusinessDays(fuDate(row.data_fechamento), Number(stage.tipo.slice(2)))) > today) return [];
      return [{ ...stage, lead: row.lead }];
    }).sort((a, b) => b.atraso - a.atraso);
    if (!pending.length) {
      results.push({ unidade: unit.nome, status: 'sem_pendencias', total: 0 });
      continue;
    }
    const lines = pending.map((item, i) => `${i + 1}. <b>${escapeHtml(item.lead.nome)}</b>\n• FU ${item.tipo === 'G+7' ? 'D+7' : 'D+30'} — ${item.atraso ? `${item.atraso} dia(s) atrasado` : 'hoje'}\n• WhatsApp: ${escapeHtml(item.lead.telefone || 'Não informado')}`);
    // Chunk by whole entries so Telegram's 4096-character limit never truncates a student.
    const chunks: string[] = [];
    let chunk = '';
    for (const line of lines) {
      if (chunk.length + line.length > 3000) { chunks.push(chunk); chunk = ''; }
      chunk += `${line}\n\n`;
    }
    if (chunk) chunks.push(chunk);
    if (dryRun) {
      results.push({ unidade: unit.nome, status: 'preview', total: pending.length, partes: chunks.length });
      continue;
    }
    for (const [index, entries] of chunks.entries()) {
      const key = `fu-gerente|${unit.id}|${today}|${index}`;
      const { error: claimError } = await admin.from('formulario_envios_log').insert({
        idempotency_key: key, tipo_formulario: 'fu_gerente_digest', unidade: unit.nome,
        unidade_id: unit.id, origem: 'internal_test', status: 'pendente',
      });
      if (claimError) {
        if (claimError.code === '23505') {
          results.push({ unidade: unit.nome, status: 'ja_processado', parte: index + 1 });
          continue;
        }
        throw claimError;
      }
      const text = `📋 <b>FOLLOW-UPS DO GERENTE</b>\n📍 <b>${escapeHtml(unit.nome)}</b>\n📅 ${today.split('-').reverse().join('/')}\nPendentes: ${pending.length}${chunks.length > 1 ? ` · Parte ${index + 1}/${chunks.length}` : ''}\n\n${entries}✅ Após realizar cada contato, marque o FU como concluído no CRM.\nhttps://ironclub-app.com/dashboard`;
      const sent = await sendTelegramMessage({ chat_id: grupo.telegram_chat_id, text,
        recipient_type: 'grupo', recipient_id: grupo.id, message_type: 'fu_gerente_digest' }, admin);
      const { error: logError } = await admin.from('formulario_envios_log').update({
        status: sent.ok ? 'enviado' : 'erro', sent_at: sent.ok ? now.toISOString() : null,
        error_message: sent.error ?? null,
      }).eq('idempotency_key', key);
      if (logError) throw logError;
      results.push({ unidade: unit.nome, status: sent.ok ? 'enviado' : 'erro', total: pending.length, parte: index + 1 });
    }
  }
  return { success: results.every(r => !['erro', 'grupo_nao_conectado'].includes(r.status)), results };
}