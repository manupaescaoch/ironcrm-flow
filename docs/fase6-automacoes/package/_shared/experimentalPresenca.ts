// Regras puras da confirmação de comparecimento à experimental pelo Telegram.
// Sem acesso a banco/rede: fácil de testar isoladamente.

export const PREFIXO_COMPARECEU = 'expc:';
export const PREFIXO_NAO_COMPARECEU = 'expn:';
export const PREFIXOS_PRESENCA = [PREFIXO_COMPARECEU, PREFIXO_NAO_COMPARECEU];

export const JANELA_MIN_MINUTOS = 30; // envia 30 min após o início
export const JANELA_MAX_MINUTOS = 360; // ignora aulas que começaram há mais de 6h

export interface SlotAula {
  data: string; // yyyy-mm-dd
  hora: string; // HH:mm ou HH:mm:ss
}

/** Momento de início da aula em UTC, considerando o horário local de Recife (UTC-3). */
export function inicioAulaUtc(slot: SlotAula): Date {
  const [h, m] = String(slot.hora).slice(0, 5).split(':').map(Number);
  return new Date(`${slot.data}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-03:00`);
}

/** True quando já se passaram 30 min do início e a aula não é antiga demais. */
export function dentroDaJanelaEnvio(slot: SlotAula, agora: Date = new Date()): boolean {
  const diffMin = (agora.getTime() - inicioAulaUtc(slot).getTime()) / 60000;
  return diffMin >= JANELA_MIN_MINUTOS && diffMin <= JANELA_MAX_MINUTOS;
}

export function dataBR(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function horaHHMM(hora: string): string {
  return String(hora).slice(0, 5);
}

export function unidadeCurta(nome: string | null | undefined): string {
  return (nome ?? '').replace(/^(EVO|IRON)\s+/i, '').trim().toUpperCase() || 'UNIDADE';
}

export interface DadosMensagem {
  unidade: string;
  leadNome: string;
  leadTelefone: string;
  slot: SlotAula;
}

export function mensagemPresenca(d: DadosMensagem): string {
  return [
    `📍 Experimental | ${unidadeCurta(d.unidade)}`,
    '',
    `👤 Lead: ${d.leadNome}`,
    `📱 Telefone: ${d.leadTelefone}`,
    `📅 Data: ${dataBR(d.slot.data)}`,
    `🕐 Horário: ${horaHHMM(d.slot.hora)}`,
    '',
    'O lead compareceu à aula experimental?',
  ].join('\n');
}

export function tecladoPresenca(interacaoId: string) {
  return {
    inline_keyboard: [[
      { text: '✅ Compareceu', callback_data: `${PREFIXO_COMPARECEU}${interacaoId}` },
      { text: '❌ Não compareceu', callback_data: `${PREFIXO_NAO_COMPARECEU}${interacaoId}` },
    ]],
  };
}

export function agoraTextoBR(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Recife',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(agora);
}

/** Mensagem editada após resposta (Telegram ou painel): dados preservados, sem botões. */
export function mensagemRespondida(d: DadosMensagem, compareceu: boolean, responsavel: string, agora: Date = new Date()): string {
  const resultado = compareceu
    ? '✅ Comparecimento confirmado.'
    : '❌ Não comparecimento registrado.';
  return [
    `📍 Experimental | ${unidadeCurta(d.unidade)}`,
    '',
    `👤 Lead: ${d.leadNome}`,
    `📱 Telefone: ${d.leadTelefone}`,
    `📅 Data: ${dataBR(d.slot.data)}`,
    `🕐 Horário: ${horaHHMM(d.slot.hora)}`,
    '',
    resultado,
    `Respondido por: ${responsavel}`,
    `Em: ${agoraTextoBR(agora)}`,
  ].join('\n');
}

/** Mensagem editada quando o agendamento foi cancelado ou remarcado após o envio. */
export function mensagemInvalidada(d: DadosMensagem, motivo: 'cancelado' | 'remarcado'): string {
  const aviso = motivo === 'cancelado'
    ? '🚫 Agendamento cancelado. Esta confirmação não é mais necessária.'
    : '🔁 Agendamento remarcado. Aguarde a nova confirmação no novo horário.';
  return [
    `📍 Experimental | ${unidadeCurta(d.unidade)}`,
    '',
    `👤 Lead: ${d.leadNome}`,
    `📅 Data: ${dataBR(d.slot.data)}`,
    `🕐 Horário: ${horaHHMM(d.slot.hora)}`,
    '',
    aviso,
  ].join('\n');
}

export type SituacaoAgendamento =
  | 'ok' // pode registrar resposta
  | 'ja_respondido' // compareceu já preenchido (painel ou Telegram)
  | 'cancelado'
  | 'remarcado'; // data/hora atuais diferem do slot da mensagem

/** Valida o estado atual do agendamento antes de processar um clique. */
export function validarSituacao(
  interacao: { compareceu: boolean | null; cancelado: boolean; data_experimental: string | null; hora_experimental: string | null },
  slot: SlotAula,
): SituacaoAgendamento {
  if (interacao.cancelado) return 'cancelado';
  if (interacao.compareceu !== null && interacao.compareceu !== undefined) return 'ja_respondido';
  const dataAtual = String(interacao.data_experimental ?? '').slice(0, 10);
  const horaAtual = horaHHMM(interacao.hora_experimental ?? '');
  if (dataAtual !== slot.data || horaAtual !== horaHHMM(slot.hora)) return 'remarcado';
  return 'ok';
}
