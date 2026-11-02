import { telefoneFuTecnico, recifeTecnicoDia } from './fuTecnicoRules.ts';
export { recifeTecnicoDia };
const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const proper = (s: string) => s.toLocaleLowerCase('pt-BR').replace(/(^|\s)\p{L}/gu, c => c.toLocaleUpperCase('pt-BR'));
export function notificacaoFuGerencial(nome: string, unidade: string, telefone: string | null, gerente: string | null, avisos: string[] = []) {
  const responsavel = gerente && gerente !== '[GERENTE]' ? proper(gerente) : '[GERENTE]';
  const mensagem = `Oi, ${proper(nome.trim().split(/\s+/)[0])}! Aqui é ${responsavel}, gerente da EVO ${proper(unidade.replace(/^EVO\s+/i, ''))}.\n\nVocê já completou seu primeiro mês com a gente! Queria saber como está sendo sua experiência na EVO. Tem algo que podemos melhorar?`;
  const numero = telefoneFuTecnico(telefone);
  return { mensagem, link: numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}` : null,
    text: `<b>ACOMPANHAMENTO GERENCIAL | M+30</b>\n\n📍 <b>Unidade:</b> ${html(unidade)}\n👤 <b>Aluno:</b> ${html(nome)}\n📞 <b>Contato:</b> ${html(numero ?? telefone ?? 'Não informado')}\n\n<b>Mensagem proposta:</b>\n\n${html(mensagem)}\n\n${avisos.map(a => `⚠️ ${html(a)}`).join('\n')}\n${!numero ? '⚠️ Telefone inválido: acompanhamento presencial disponível.\n' : ''}${responsavel === '[GERENTE]' ? '⚠️ Preencha [GERENTE] antes do envio manual.\n' : ''}Consulte o histórico: não repita perguntas já respondidas. Confirme apenas após enviar manualmente; registre o resultado no CRM.` };
}
export function tecladoFuGerencial(task: string, link: string | null) {
  return { inline_keyboard: [[...(link ? [{ text: '💬 Abrir', url: link }] : []), { text: '✅ Enviado', callback_data: `fgc:${task}` }]] };
}
export function textoConfirmadoFuGerencial(unidade: string, aluno: string, quando: string, gerente: string) {
  return `<b>✅ ENVIO CONFIRMADO | M+30</b>\n\n📍 <b>Unidade:</b> ${html(unidade)}\n👤 <b>Aluno:</b> ${html(aluno)}\n🕒 <b>Confirmado:</b> ${html(new Date(quando).toLocaleString('pt-BR', { timeZone: 'America/Recife' }))}\n👤 <b>Responsável:</b> ${html(gerente)}\n\nConfirmação manual de envio. O acompanhamento permanece disponível no CRM para registrar o resultado.`;
}