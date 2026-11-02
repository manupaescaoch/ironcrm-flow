import { telefoneFuTecnico, recifeTecnicoDia } from './fuTecnicoRules.ts';
export { recifeTecnicoDia };
const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const proper = (s: string) => s.toLocaleLowerCase('pt-BR').replace(/(^|\s)\p{L}/gu, c => c.toLocaleUpperCase('pt-BR'));
export function notificacaoFuMatriculados(nome: string, unidade: string, telefone: string | null) {
  const local = unidade.replace(/^EVO\s+/i, '');
  const mensagem = `Oi, ${proper(nome.trim().split(/\s+/)[0])}! Seja bem-vindo à EVO ${proper(local)}!\n\nSua matrícula está confirmada. Estamos felizes em ter você com a gente!\n\nQualquer dúvida, nossa equipe está à disposição.`;
  const numero = telefoneFuTecnico(telefone);
  return { mensagem, link: numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}` : null,
    text: `<b>FU | MATRICULADOS</b>\n\n📍 <b>Unidade:</b> ${html(local)}\n👤 <b>Aluno:</b> ${html(nome)}\n📞 <b>Contato:</b> ${html(numero ?? telefone ?? 'Não informado')}\n\n<b>Mensagem proposta:</b>\n\n${html(mensagem)}${numero ? '' : '\n\n⚠️ Telefone inválido: conferir cadastro.'}` };
}
export function tecladoFuMatriculados(id: string, link: string | null) {
  return { inline_keyboard: [[...(link ? [{ text: '💬 Abrir', url: link }] : []), { text: '✅ Enviado', callback_data: `fmc:${id}` }]] };
}
export function textoConfirmadoFuMatriculados(unidade: string, aluno: string, quando: string, responsavel: string) {
  return `<b>✅ Envio confirmado | FU MATRICULADOS</b>\n\n📍 <b>Unidade:</b> ${html(unidade)}\n👤 <b>Aluno:</b> ${html(aluno)}\n🕒 <b>Confirmado:</b> ${html(new Date(quando).toLocaleString('pt-BR', { timeZone: 'America/Recife' }))}\n👤 <b>Responsável:</b> ${html(responsavel)}\n\nConfirmação manual de envio; acompanhamento separado no CRM.`;
}