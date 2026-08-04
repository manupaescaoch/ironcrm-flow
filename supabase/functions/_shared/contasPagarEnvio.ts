// Núcleo do envio de contas a pagar para o grupo financeiro no WhatsApp.
// Usa exclusivamente o canal COMERCIAL (Z-API) já configurado em secrets.
// Nunca expõe token/client-token em retornos, logs ou mensagens.
import { checkZapiStatus, getZapiCreds, logEnvio, sendText } from './zapi.ts';
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

/** ID do grupo financeiro: config da unidade → qualquer config preenchida → secret global. */
export async function resolverGrupoContasPagar(
  supabase: any,
  unidadeId: string,
): Promise<{ id: string | null; nome: string | null }> {
  const { data: cfg } = await supabase
    .from('unidade_whatsapp_config')
    .select('grupo_contas_pagar_id, grupo_contas_pagar_nome')
    .eq('unidade_id', unidadeId)
    .maybeSingle();

  if (cfg?.grupo_contas_pagar_id) {
    return { id: cfg.grupo_contas_pagar_id, nome: cfg.grupo_contas_pagar_nome ?? null };
  }

  const { data: qualquer } = await supabase
    .from('unidade_whatsapp_config')
    .select('grupo_contas_pagar_id, grupo_contas_pagar_nome')
    .not('grupo_contas_pagar_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (qualquer?.grupo_contas_pagar_id) {
    return { id: qualquer.grupo_contas_pagar_id, nome: qualquer.grupo_contas_pagar_nome ?? null };
  }

  const secret = Deno.env.get('WHATSAPP_GRUPO_CONTAS_PAGAR');
  return { id: secret || null, nome: null };
}

export function normalizeGrupoId(id: string): string {
  return String(id).replace(/@g\.us$/i, '').trim();
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

  // 2. Reserva atômica do envio (unique constraint + update condicional)
  const { data: reserva, error: reservaErr } = await supabase.rpc('reservar_envio_conta', {
    p_conta_id: contaId,
    p_tipo: tipo,
  });

  if (reservaErr) return { ok: false, erro: 'Falha ao reservar envio' };

  const envio = Array.isArray(reserva) ? reserva[0] : reserva;
  if (!envio?.id) return { ok: false, skipped: 'envio_ja_processado' };

  // 3. Credenciais e grupo
  const creds = getZapiCreds('comercial');
  if (!creds) {
    await marcarFalha(supabase, envio.id, envio.tentativas, 'Integração Z-API Comercial não configurada');
    return { ok: false, erro: 'Integração Z-API Comercial não configurada' };
  }

  const grupo = await resolverGrupoContasPagar(supabase, conta.unidade_id);
  if (!grupo.id) {
    await marcarFalha(supabase, envio.id, envio.tentativas, 'Grupo de contas a pagar não configurado');
    return { ok: false, erro: 'Grupo de contas a pagar não configurado' };
  }

  const destino = normalizeGrupoId(grupo.id);

  const status = await checkZapiStatus(creds);
  if (!status.connected) {
    await marcarFalha(supabase, envio.id, envio.tentativas, 'Integração Z-API Comercial desconectada');
    await logEnvio(supabase, {
      funcao: 'contas-pagar',
      destino,
      tipo_destino: 'grupo',
      unidade_id: conta.unidade_id,
      sucesso: false,
      canal: 'comercial',
      status_envio: 'falhou',
      erro_msg: 'Integração Z-API Comercial desconectada',
    });
    return { ok: false, erro: 'Integração Z-API Comercial desconectada' };
  }

  // 4. Nome da unidade (sempre dinâmico)
  const { data: unidade } = await supabase
    .from('unidades')
    .select('nome')
    .eq('id', conta.unidade_id)
    .maybeSingle();

  const mensagem = montarMensagemConta(conta, unidade?.nome ?? '');

  // 5. Envio
  const resp = await sendText(creds, destino, mensagem);
  const messageId = resp.body?.messageId ?? resp.body?.id ?? null;

  await logEnvio(supabase, {
    funcao: `contas-pagar-${tipo.toLowerCase()}`,
    destino,
    tipo_destino: 'grupo',
    unidade_id: conta.unidade_id,
    sucesso: resp.ok,
    canal: 'comercial',
    zapi_status_code: resp.status,
    status_envio: resp.ok ? 'enviado' : 'falhou',
    erro_msg: resp.ok ? null : `HTTP ${resp.status}`,
    resposta_completa: resp.body,
  });

  if (!resp.ok) {
    const erro = `Z-API retornou ${resp.status}${resp.body?.error ? `: ${resp.body.error}` : ''}`;
    await supabase
      .from('contas_pagar_envios')
      .update({ instancia_id: creds.instanceId, grupo_destino: destino, mensagem_enviada: mensagem })
      .eq('id', envio.id);
    await marcarFalha(supabase, envio.id, envio.tentativas, erro);
    return { ok: false, erro };
  }

  await supabase
    .from('contas_pagar_envios')
    .update({
      status: 'enviado',
      instancia_id: creds.instanceId,
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
    campo: 'whatsapp',
    valor_novo: `Mensagem de ${tipo === 'CADASTRO' ? 'cadastro' : 'vencimento'} enviada ao grupo`,
    user_nome: 'SISTEMA',
  });

  return { ok: true, message_id: messageId ? String(messageId) : null };
}
