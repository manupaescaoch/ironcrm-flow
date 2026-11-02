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
    ? `Oi, ${primeiro}! Tudo bem?\n\nAqui é ${coord}, coordenador técnico da EVO ${local}.\n\nQueria acompanhar sua adaptação aos exercícios nessa primeira semana.\n\nExiste algum movimento em que esteja sentindo dificuldade ou precisando de mais orientação?\n\nEstou à disposição!`
    : `Oi, ${primeiro}!\n\nAqui é ${coord}, da EVO ${local}.\n\nJá estamos chegando ao seu primeiro mês de treinamento.\n\nQueria saber se está percebendo alguma evolução na execução dos exercícios, nas cargas ou no condicionamento.\n\nSeu retorno vai nos ajudar a acompanhar o desenvolvimento do seu treino.`;
  const numero = telefoneFuTecnico(telefone);
  const link = numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}` : null;
  return { mensagem, link, text: `<b>ACOMPANHAMENTO TÉCNICO | ${html(etapa)}</b>\n\n📍 <b>Unidade:</b> ${html(unidade)}\n👤 <b>Aluno:</b> ${html(nome)}\n📞 <b>Contato:</b> ${html(numero ?? telefone ?? 'Não informado')}\n\n<b>Mensagem proposta:</b>\n\n${html(mensagem)}\n\n${link ? `<a href="${html(link)}">💬 Falar com o aluno</a>` : '⚠️ Telefone inválido: contato presencial disponível.'}\n${treinador ? `Treinador: ${html(treinador)}` : '⚠️ Treinador não identificado.'}\n${coord === '[COORDENADOR]' ? '⚠️ Preencha [COORDENADOR] antes do envio manual.\n' : ''}Consulte o histórico, os treinos e as pendências técnicas antes do contato. Registre o acompanhamento no CRM.` };
}