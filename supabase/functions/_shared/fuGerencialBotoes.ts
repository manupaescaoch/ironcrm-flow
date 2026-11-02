import { telegramApi } from './telegram.ts';
import { textoConfirmadoFuGerencial } from './fuGerencialRules.ts';
export async function receberBotaoFuGerencial(admin: any, cq: any, api = telegramApi): Promise<boolean> {
  if (typeof cq?.data !== 'string' || !cq.data.startsWith('fgc:')) return false;
  const answer = (text: string, show_alert = false) => api('answerCallbackQuery', { callback_query_id: cq.id, text, show_alert });
  const id = cq.data.slice(4), chat = cq.message?.chat?.id, message = cq.message?.message_id;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !Number.isSafeInteger(chat) || !Number.isSafeInteger(message) || !Number.isSafeInteger(cq.from?.id)) {
    await answer('Confirmação inválida.', true); return true;
  }
  const { data, error } = await admin.rpc('fu_gerencial_confirmar_envio', { p_task: id, p_telegram_user: cq.from.id, p_chat: chat, p_message: message });
  if (error || !data?.ok) { await answer(data?.erro ?? 'Não consegui registrar agora. Tente novamente.', true); return true; }
  const edited = await api('editMessageText', { chat_id: chat, message_id: message, parse_mode: 'HTML', text: textoConfirmadoFuGerencial(data.unidade, data.aluno, data.confirmado_em, data.responsavel, data.etapa ?? 'M+30'), reply_markup: { inline_keyboard: [] } });
  if (!edited.ok && !edited.description?.includes('message is not modified')) await answer('Registrado. Clique novamente para tentar atualizar o aviso.', true);
  else await answer(data.duplicado ? 'Envio já confirmado. Acompanhamento permanece aberto.' : 'Envio confirmado. Registre o resultado no CRM.');
  return true;
}