import { telegramApi } from './telegram.ts';
import { textoConfirmadoFuMatriculados } from './fuMatriculadosRules.ts';
import { recoverFuTelegramVisual } from './fuTelegramVisualRecovery.ts';
export async function receberBotaoFuMatriculados(admin: any, cq: any, api = telegramApi): Promise<boolean> {
  if (typeof cq?.data !== 'string' || !cq.data.startsWith('fmc:')) return false;
  const answer = (text: string, show_alert = false) => recoverFuTelegramVisual(() => api('answerCallbackQuery', { callback_query_id: cq.id, text, show_alert }));
  const id = cq.data.slice(4), chat = cq.message?.chat?.id, message = cq.message?.message_id;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !Number.isSafeInteger(chat) || !Number.isSafeInteger(message) || !Number.isSafeInteger(cq.from?.id)) {
    await answer('Confirmação inválida.', true); return true;
  }
  const { data, error } = await admin.rpc('fu_matriculados_confirmar_envio', { p_task: id, p_telegram_user: cq.from.id, p_chat: chat, p_message: message });
  if (error || !data?.ok) { await answer(data?.erro ?? 'Não consegui registrar agora. Tente novamente.', true); return true; }
  const edited = await recoverFuTelegramVisual(() => api('editMessageText', { chat_id: chat, message_id: message, parse_mode: 'HTML', text: textoConfirmadoFuMatriculados(data.unidade, data.aluno, data.confirmado_em, data.responsavel, data.etapa ?? 'BV'), reply_markup: { inline_keyboard: [] } }));
  await answer(!edited.ok && !edited.description?.includes('message is not modified') ? 'Registrado. Clique novamente para atualizar o aviso.' : data.duplicado ? 'Envio já confirmado.' : 'Envio confirmado. Acompanhamento permanece no CRM.');
  return true;
}