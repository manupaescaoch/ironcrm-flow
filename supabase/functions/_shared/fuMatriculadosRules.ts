import { telefoneFuTecnico, recifeTecnicoDia } from './fuTecnicoRules.ts';
export { recifeTecnicoDia };
const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const proper = (s: string) => s.toLocaleLowerCase('pt-BR').replace(/(^|\s)\p{L}/gu, c => c.toLocaleUpperCase('pt-BR'));
export type EtapaFuMatriculados = 'BV' | 'M+3' | 'M+32';
export function mensagemFuMatriculados(etapa: EtapaFuMatriculados, nome: string, unidade: string) {
  const primeiro = proper(nome.trim().split(/\s+/)[0]);
  const local = proper(unidade.replace(/^EVO\s+/i, ''));
  if (etapa === 'M+3') return `Oi, ${primeiro}! Tudo bem?\n\nPassando pra saber como estão sendo seus primeiros dias na EVO. 💙\n\nEstá conseguindo organizar seus horários e utilizar tudo direitinho?\n\nSe precisar de alguma ajuda, pode contar com a gente!`;
  if (etapa === 'M+32') return `Oi, ${primeiro}! Tudo bem?\n\nVocê já completou seu primeiro mês com a gente!\n\nQueria saber como está sua rotina de treinos e se precisamos ajudar com alguma coisa.\n\nEstamos por aqui! 💙`;
  return `Oi, ${primeiro}! Seja bem-vindo à EVO ${local}!\n\nSua matrícula está confirmada. Estamos felizes em ter você com a gente!\n\nQualquer dúvida, nossa equipe está à disposição.`;
}
export const tituloFuMatriculados = (etapa: string) => etapa === 'M+3' || etapa === 'M+32' ? `FU | RECEPÇÃO | ${etapa}` : 'FU | MATRICULADOS';
export function notificacaoFuMatriculados(nome: string, unidade: string, telefone: string | null, etapa: EtapaFuMatriculados = 'BV') {
  const local = unidade.replace(/^EVO\s+/i, '');
  const mensagem = mensagemFuMatriculados(etapa, nome, unidade);
  const numero = telefoneFuTecnico(telefone);
  return { mensagem, link: numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}` : null,
    text: `<b>${tituloFuMatriculados(etapa)}</b>\n\n📍 <b>Unidade:</b> ${html(local)}\n👤 <b>Aluno:</b> ${html(nome)}\n${etapa === 'BV' ? '' : '👤 <b>Responsável:</b> Recepção\n'}📞 <b>Contato:</b> ${html(numero ?? telefone ?? 'Não informado')}\n\n<b>Mensagem proposta:</b>\n\n${html(mensagem)}${numero ? '' : '\n\n⚠️ Telefone inválido: conferir cadastro.'}` };
}
export function tecladoFuMatriculados(id: string, link: string | null) {
  return { inline_keyboard: [[...(link ? [{ text: '💬 Abrir', url: link }] : []), { text: '✅ Enviado', callback_data: `fmc:${id}` }]] };
}
export function textoConfirmadoFuMatriculados(unidade: string, aluno: string, quando: string, responsavel: string, etapa = 'BV') {
  return `<b>✅ Envio confirmado | ${tituloFuMatriculados(etapa).replace(/^FU \| /, '')}</b>\n\n📍 <b>Unidade:</b> ${html(unidade)}\n👤 <b>Aluno:</b> ${html(aluno)}\n🕒 <b>Confirmado:</b> ${html(new Date(quando).toLocaleString('pt-BR', { timeZone: 'America/Recife' }))}\n👤 <b>Responsável:</b> ${html(responsavel)}\n\nConfirmação manual de envio; acompanhamento separado no CRM.`;
}