import { FollowUpError, assertUnit, type FollowUpScope } from './followUpAuthorization.ts';
import { buildIdempotencyKey } from './zapi.ts';

export function validateExperimental(lead: any, interaction: any, scope: FollowUpScope, now = new Date()) {
  if (!lead) throw new FollowUpError(404, 'Lead indisponível');
  assertUnit(scope, lead.unidade_id);
  if (!interaction) throw new FollowUpError(404, 'Experimental indisponível');
  if (interaction.lead_id !== lead.id || interaction.unidade_id !== lead.unidade_id) throw new FollowUpError(409, 'Lead e interação incompatíveis');
  assertUnit(scope, interaction.unidade_id);
  const date = String(interaction.data_experimental ?? '').slice(0, 10);
  const time = String(interaction.hora_experimental ?? '').slice(0, 5);
  const starts = new Date(`${date}T${time}:00-03:00`).getTime();
  if (!lead.ativo || lead.is_matriculado || lead.pausado_fu || ['convertido','perdido'].includes(lead.status_funil)
    || interaction.compareceu !== false || interaction.cancelado || !interaction.agendou_experimental
    || !Number.isFinite(starts) || starts > now.getTime()
    || String(lead.data_aula_experimental ?? '').slice(0, 10) !== date
    || String(lead.hora_aula_experimental ?? '').slice(0, 5) !== time) {
    throw new FollowUpError(409, 'Experimental não elegível para reagendamento');
  }
  return buildIdempotencyKey(['send-reagendamento-experimental', lead.id, date, time]);
}

// No provider call may precede the durable reservation; all failures are fail-closed.
export async function runReagendamento(deps: {
  reserve: () => Promise<any>;
  send: () => Promise<{ ok: boolean; skipped: boolean; status: number }>;
  finish: (reservation: any, state: string, status: number) => Promise<void>;
}) {
  const reservation = await deps.reserve();
  if (!reservation?.id) throw new FollowUpError(500, 'Não foi possível registrar o follow-up');
  if (!reservation.claimed) return { success: true, skipped: 'duplicado', followUpId: reservation.id };
  let result;
  try { result = await deps.send(); }
  catch (error) {
    await deps.finish(reservation, error instanceof FollowUpError ? 'falha_pre_envio' : 'ambiguo', 0);
    throw error instanceof FollowUpError ? error : new FollowUpError(502, 'Envio incerto; reconciliação necessária antes de nova tentativa');
  }
  const state = result.skipped ? 'reconciliacao' : result.ok ? 'enviado' : 'ambiguo';
  await deps.finish(reservation, state, result.status);
  if (!result.ok && !result.skipped) throw new FollowUpError(502, 'Envio não confirmado; reconciliação necessária');
  return { success: !result.skipped, skipped: result.skipped ? 'reconciliacao' : undefined, followUpId: reservation.id };
}