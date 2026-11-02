import { telegramApi } from './telegram.ts';
import { textoConfirmadoFuTecnico } from './fuTecnicoRules.ts';

/** Webhook already validates Telegram's secret. This RPC independently validates identity and scope. */
export async function receberBotaoFuTecnico(admin: any, cq: any, api = telegramApi): Promise<boolean> {
  if (typeof cq?.data !== 'string' || !cq.data.startsWith('ftc:')) return false;
  const answer = (text: string, show_alert = false) => api('answerCallbackQuery', { callback_query_id: cq.id, text, show_alert });
  const taskId = cq.data.slice(4);
  const chat = cq.message?.chat?.id;
  const message = cq.message?.message_id;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId) || !Number.isSafeInteger(chat) || !Number.isSafeInteger(message) || !Number.isSafeInteger(cq.from?.id)) {
    await answer('Confirmação inválida.', true); return true;
  }
  const { data, error } = await admin.rpc('fu_tecnico_confirmar_envio', { p_task: taskId, p_telegram_user: cq.from.id, p_chat: chat, p_message: message });
  if (error || !data?.ok) {
    await answer(data?.erro ?? 'Não consegui registrar agora. Tente novamente.', true); return true;
  }
  // Repeated clicks may repair a failed Telegram edit, never repeat the DB confirmation.
  const edited = await api('editMessageText', {
    chat_id: chat, message_id: message, parse_mode: 'HTML',
    text: textoConfirmadoFuTecnico(data.unidade, data.aluno, data.etapa, data.confirmado_em, data.responsavel),
    reply_markup: { inline_keyboard: [] },
  });
  if (!edited.ok && !edited.description?.includes('message is not modified')) {
    console.warn('[fuTecnico] edição Telegram falhou:', edited.description);
    await answer('Envio registrado. Não consegui atualizar o aviso; clique novamente para tentar.', true);
  } else await answer(data.duplicado ? 'Envio já confirmado. O acompanhamento não foi concluído.' : 'Envio confirmado. Registre o resultado técnico no CRM.');
  return true;
}