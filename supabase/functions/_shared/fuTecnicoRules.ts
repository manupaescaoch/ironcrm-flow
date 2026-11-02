export function recifeTecnicoDia(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function telefoneFuTecnico(raw: string | null): string | null {
  let d = (raw ?? '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return /^55[1-9]\d(?:[2-5]\d{7}|9\d{8})$/.test(d) ? d : null;
}
const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const proper = (s: string) => s.toLocaleLowerCase('pt-BR').replace(/(^|\s)\p{L}/gu, c => c.toLocaleUpperCase('pt-BR'));
export function notificacaoFuTecnico(etapa: string, nome: string, unidade: string, telefone: string | null, coordenador: string | null, treinador: string | null) {
  const primeiro = proper(nome.trim().split(/\s+/)[0]);
  const local = proper(unidade.replace(/^EVO\s+/i, ''));
  const coord = coordenador && coordenador !== '[COORDENADOR]' ? proper(coordenador) : '[COORDENADOR]';
  const mensagem = etapa === 'M+7'
    ? `Oi, ${primeiro}! Aqui é ${coord}, da EVO ${local}.\n\nComo está sua adaptação aos treinos? Alguma dificuldade com os exercícios?`
    : `Oi, ${primeiro}! Aqui é ${coord}, da EVO ${local}.\n\nComo estão os treinos? Já percebe alguma evolução ou tem algo que podemos ajustar?`;
  const numero = telefoneFuTecnico(telefone);
  const link = numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}` : null;
  return { mensagem, link, text: `<b>ACOMPANHAMENTO TÉCNICO | ${html(etapa)}</b>\n\n📍 <b>Unidade:</b> ${html(unidade)}\n👤 <b>Aluno:</b> ${html(nome)}\n📞 <b>Contato:</b> ${html(numero ?? telefone ?? 'Não informado')}\n\n<b>Mensagem proposta:</b>\n\n${html(mensagem)}\n\n${link ? '' : '⚠️ Telefone inválido: contato presencial disponível.\n'}${treinador ? `Treinador: ${html(treinador)}` : '⚠️ Treinador não identificado.'}\n${coord === '[COORDENADOR]' ? '⚠️ Preencha [COORDENADOR] antes do envio manual.\n' : ''}Consulte o histórico antes do contato. Confirme o envio manual em ✅ Enviado; registre o resultado técnico no CRM.` };
}

export function tecladoFuTecnico(taskId: string, link: string | null) {
  return { inline_keyboard: [[...(link ? [{ text: '💬 Abrir', url: link }] : []), { text: '✅ Enviado', callback_data: `ftc:${taskId}` }]] };
}
export function textoConfirmadoFuTecnico(unidade: string, aluno: string, etapa: string, confirmado: string, responsavel: string) {
  const when = new Date(confirmado).toLocaleString('pt-BR', { timeZone: 'America/Recife' });
  return `<b>✅ ENVIO CONFIRMADO</b>\n\n📍 <b>Unidade:</b> ${html(unidade)}\n👤 <b>Aluno:</b> ${html(aluno)}\n📋 <b>FU:</b> ${html(etapa)}\n🕒 <b>Confirmado:</b> ${html(when)}\n👤 <b>Responsável:</b> ${html(responsavel)}\n\nConfirmação manual de envio — não comprova entrega pelo WhatsApp. O acompanhamento técnico permanece no CRM para registrar o resultado.`;
}