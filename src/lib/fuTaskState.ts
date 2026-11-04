import type { Task } from '@/hooks/useTarefasData';
import { effectiveFuDay, fuDay } from '@/lib/fuBusinessDays';
import { mensagemGerencial } from './fuGerencial';
import { mensagemTecnica, linkTecnico } from './fuTecnico';
import { mensagemFuMatriculados } from '../../supabase/functions/_shared/fuMatriculadosRules';
export type FuFamily = 'recepcao' | 'gerencia' | 'tecnico';
export type FuTaskItem = { id: string; leadId: string; enrollmentId: string; unitId: string; stage: string; due: string; confirmedAt: string | null; confirmedName: string | null; open: boolean; family: FuFamily; task: Task; lead: { nome: string; telefone: string | null } };
export function taskFuItem(task: Task): FuTaskItem | null {
  const family = task.fu_matriculados_etapa ? 'recepcao' : task.fu_gerencial_etapa ? 'gerencia' : task.fu_tecnico_etapa ? 'tecnico' : null;
  if (!family) return null;
  const stage = family === 'recepcao' ? task.fu_matriculados_etapa : family === 'gerencia' ? task.fu_gerencial_etapa : task.fu_tecnico_etapa;
  const leadId = family === 'recepcao' ? task.fu_matriculados_lead_id : family === 'gerencia' ? task.fu_gerencial_lead_id : task.fu_tecnico_lead_id;
  const enrollmentId = family === 'recepcao' ? task.fu_matriculados_matricula_id : family === 'gerencia' ? task.fu_gerencial_matricula_id : task.fu_tecnico_matricula_id;
  const status = family === 'gerencia' ? task.fu_gerencial_status : family === 'tecnico' ? task.fu_tecnico_status : null;
  if (!leadId || !enrollmentId || !stage || !task.prazo) return null;
  return { id: task.id, leadId, enrollmentId, unitId: task.unidade_id, family, stage, due: effectiveFuDay(task.prazo), task,
    confirmedAt: family === 'recepcao' ? task.fu_matriculados_confirmado_em ?? null : family === 'gerencia' ? task.fu_gerencial_confirmado_em ?? null : task.fu_tecnico_confirmado_em ?? null,
    confirmedName: family === 'recepcao' ? task.fu_matriculados_confirmado_nome ?? null : family === 'gerencia' ? task.fu_gerencial_confirmado_nome ?? null : task.fu_tecnico_confirmado_nome ?? null,
    open: !task.arquivada && task.status !== 'concluida' && !['concluido', 'dispensado', 'cancelado'].includes(status ?? ''),
    lead: { nome: task.titulo, telefone: null } };
}
export const pendingFuMessages = (items: FuTaskItem[], today = fuDay(new Date())) => items.filter(item => item.open && !item.confirmedAt && item.due <= today);
export const confirmedFuToday = (items: FuTaskItem[], today = fuDay(new Date())) => items.filter(item => item.confirmedAt && fuDay(new Date(item.confirmedAt)) === today);
export function fuItemMessage(item: FuTaskItem, unitName: string): string {
  if (item.family === 'gerencia') return mensagemGerencial(item.lead.nome, unitName, item.task.responsavel, item.stage);
  if (item.family === 'tecnico') return mensagemTecnica(item.stage === 'M+21' ? 'M+21' : 'M+7', item.lead.nome, unitName, item.task.responsavel);
  return mensagemFuMatriculados(item.stage === 'M+3' || item.stage === 'M+32' ? item.stage : 'BV', item.lead.nome, unitName);
}
export const fuItemLink = (item: FuTaskItem, unitName: string) => linkTecnico(item.lead.telefone, fuItemMessage(item, unitName));