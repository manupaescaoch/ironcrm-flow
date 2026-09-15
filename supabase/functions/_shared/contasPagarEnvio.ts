// Núcleo do envio de contas a pagar para o grupo financeiro no Telegram.
// O token do bot é lido apenas no servidor (helpers de _shared/telegram.ts).
import { sendTelegramGroupText, TelegramGrupoUnidade } from './telegram.ts';
import { montarMensagemConta } from './contasPagarMensagem.ts';

export type TipoEnvio = 'CADASTRO' | 'VENCIMENTO';

const MAX_TENTATIVAS = 3;
const RETRY_MINUTOS = 5;

export interface ResultadoEnvio {
  ok: boolean;
  skipped?: string;
  erro?: string;
  message_id?: string | null;
}

/**
 * Grupo do Telegram de contas a pagar: grupo da unidade (se existir)
 * ou o grupo geral (unidade_id nulo).
 */
export async function resolverGrupoContasPagar(
  supabase: any,
  unidadeId: string | null,
): Promise<TelegramGrupoUnidade | null> {
  const { data } = await supabase
    .from('telegram_groups')
    .select('id, group_type, telegram_chat_id, telegram_title, unidade_id')
    .eq('group_type', 'contas_pagar')
    .eq('status', 'conectado')
    .not('telegram_chat_id', 'is', null);

  if (!data || data.length === 0) return null;

  const escolhido =
    data.find((g: any) => unidadeId && g.unidade_id === unidadeId) ??
    data.find((g: any) => g.unidade_id === null) ??
    null;

  if (!escolhido) return null;

  return {
    id: escolhido.id,
    group_type: 'contas_pagar' as any,
    telegram_chat_id: Number(escolhido.telegram_chat_id),
    telegram_title: escolhido.telegram_title ?? null,
  };
}

async function marcarFalha(supabase: any, envioId: string, tentativas: number, erro: string) {
  const esgotou = (tentativas ?? 0) >= MAX_TENTATIVAS;
  await supabase
    .from('contas_pagar_envios')
    .update({
      status: 'falhou',
      erro_msg: erro.slice(0, 500),
      proxima_tentativa_em: esgotou
        ? null
        : new Date(Date.now() + RETRY_MINUTOS * 60_000).toISOString(),
    })
    .eq('id', envioId);
}

/**
 * Processa um envio de forma idempotente.
 * A reserva atômica (reservar_envio_conta) garante que nunca haja mensagem duplicada.
 */
export async function processarEnvio(
  supabase: any,
  contaId: string,
  tipo: TipoEnvio,
): Promise<ResultadoEnvio> {
  // 1. Reconsulta a conta com o status mais recente
  const { data: conta, error: contaErr } = await supabase
    .from('contas_pagar')
    .select('*')
    .eq('id', contaId)
    .maybeSingle();

  if (contaErr || !conta) return { ok: false, erro: 'Conta não encontrada' };
  if (conta.deleted_at) return { ok: false, skipped: 'conta_excluida' };
  if (conta.status === 'paga') return { ok: false, skipped: 'conta_paga' };
  if (conta.status === 'cancelada') return { ok: false, skipped: 'conta_cancelada' };

  // Regra: só é enviado ao grupo no DIA do vencimento.
  const hojeBRT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  if (String(conta.data_vencimento).slice(0, 10) !== hojeBRT) {
    return { ok: false, skipped: 'fora_do_dia_de_vencimento' };
  }

  // 2. Reserva atômica do envio (unique constraint + update condicional)
  const { data: reserva, error: reservaErr } = await supabase.rpc('reservar_envio_conta', {
    p_conta_id: contaId,
    p_tipo: tipo,
  });

  if (reservaErr) return { ok: false, erro: 'Falha ao reservar envio' };

  const envio = Array.isArray(reserva) ? reserva[0] : reserva;
  if (!envio?.id) return { ok: false, skipped: 'envio_ja_processado' };

  // 3. Grupo do Telegram
  const grupo = await resolverGrupoContasPagar(supabase, conta.unidade_id);
  if (!grupo) {
    await marcarFalha(supabase, envio.id, envio.tentativas, 'Grupo de contas a pagar no Telegram não configurado');
    return { ok: false, erro: 'Grupo de contas a pagar no Telegram não configurado' };
  }

  const destino = String(grupo.telegram_chat_id);

  // 4. Nome da unidade (sempre dinâmico)
  const { data: unidade } = await supabase
    .from('unidades')
    .select('nome')
    .eq('id', conta.unidade_id)
    .maybeSingle();

  const mensagem = montarMensagemConta(conta, unidade?.nome ?? '');

  // 5. Envio
  const resp = await sendTelegramGroupText(
    supabase,
    grupo,
    mensagem,
    `contas_pagar_${tipo.toLowerCase()}`,
  );
  const messageId = resp.message_id ?? null;

  if (!resp.ok) {
    const erro = `Telegram: ${resp.error ?? 'falha no envio'}`;
    await supabase
      .from('contas_pagar_envios')
      .update({ grupo_destino: destino, mensagem_enviada: mensagem })
      .eq('id', envio.id);
    await marcarFalha(supabase, envio.id, envio.tentativas, erro);
    return { ok: false, erro };
  }

  await supabase
    .from('contas_pagar_envios')
    .update({
      status: 'enviado',
      grupo_destino: destino,
      zapi_message_id: messageId ? String(messageId) : null,
      mensagem_enviada: mensagem,
      erro_msg: null,
      proxima_tentativa_em: null,
    })
    .eq('id', envio.id);

  await supabase.from('contas_pagar_historico').insert({
    conta_id: contaId,
    acao: 'edicao',
    campo: 'telegram',
    valor_novo: `Mensagem de ${tipo === 'CADASTRO' ? 'cadastro' : 'vencimento'} enviada ao grupo do Telegram`,
    user_nome: 'SISTEMA',
  });

  return { ok: true, message_id: messageId ? String(messageId) : null };
}
