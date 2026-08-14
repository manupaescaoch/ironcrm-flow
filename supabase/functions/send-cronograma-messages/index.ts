import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
import { buildIdempotencyKey, checkZapiStatus, getZapiCreds, lookupWhatsAppPhone, sendTextIdempotent } from '../_shared/zapi.ts';
import { maybeSendZapiOfflineAlert } from '../_shared/zapi-alert.ts';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/\D/g, '');
  if (!normalized.startsWith('55')) {
    normalized = '55' + normalized;
  }
  return normalized;
}

const wheyMessages = [
  (name: string) => `${name}, confere pra mim se precisa repor o whey e se a máquina está funcionando certinho?`,
  (name: string) => `${name}, dá uma olhada na máquina do whey e vê se está tudo ok com a reposição.`,
  (name: string) => `${name}, verifica o nível do whey e confirma se a máquina está normal.`,
  (name: string) => `${name}, pode checar se o whey precisa ser completado e se a máquina está rodando bem?`,
  (name: string) => `${name}, olha pra mim a situação do whey e me avisa se tiver algo errado com a máquina.`,
  (name: string) => `${name}, confere a reposição do whey e confirma se a máquina está pronta para uso.`,
  (name: string) => `${name}, verifica se o whey está baixo e se a máquina está funcionando sem problema.`,
  (name: string) => `${name}, dá uma passada na máquina do whey e vê se precisa fazer reposição.`,
  (name: string) => `${name}, checa o whey e confirma se a máquina está ok, por favor.`,
  (name: string) => `${name}, olha o nível do whey e me avisa se a máquina estiver com qualquer problema.`,
];

function generateWheyMessage(responsibleName: string): string {
  const firstName = responsibleName.split(' ')[0];
  const idx = Math.floor(Math.random() * wheyMessages.length);
  return wheyMessages[idx](firstName);
}

const gradeVariants: Array<{ titulo: string; abertura: (nome: string, horario: string) => string }> = [
  { titulo: '📋 *Conferência da próxima grade*', abertura: (n, h) => `${n}, dá uma olhada agora na grade do horário das ${h} e já alinha o time antes da entrada dos alunos.` },
  { titulo: '🧭 *Alinhamento do próximo horário*', abertura: (n, h) => `${n}, confere a grade das ${h} e garante que o time já esteja alinhado antes dos alunos entrarem.` },
  { titulo: '📌 *Próximo horário chegando*', abertura: (n, h) => `${n}, verifica agora a grade das ${h} e alinha o time antes do início do horário.` },
  { titulo: '✅ *Checagem da grade*', abertura: (n, h) => `${n}, passa agora na grade do horário das ${h} e confirma se está tudo alinhado com o time.` },
  { titulo: '📋 *Organização do próximo horário*', abertura: (n, h) => `${n}, confere a grade das ${h} e garante que o time saiba exatamente o que precisa fazer antes dos alunos entrarem.` },
  { titulo: '🕒 *Preparação da próxima grade*', abertura: (n, h) => `${n}, verifica a grade do horário das ${h} e faz o alinhamento com o time antes da entrada dos alunos.` },
  { titulo: '📍 *Alinhamento de horário*', abertura: (n, h) => `${n}, olha agora a grade das ${h} e confirma se o time está pronto para receber os alunos.` },
  { titulo: '⚡ *Hora de alinhar a grade*', abertura: (n, h) => `${n}, confere a grade do próximo horário (${h}) e alinha o time antes da entrada dos alunos.` },
  { titulo: '📋 *Grade em conferência*', abertura: (n, h) => `${n}, verifica a grade das ${h} e confirma se está tudo certo com o time antes da entrada dos alunos.` },
  { titulo: '🧠 *Organização antes da entrada*', abertura: (n, h) => `${n}, confere agora a grade das ${h} e faz o alinhamento necessário com o time.` },
  { titulo: '📌 *Próxima grade no radar*', abertura: (n, h) => `${n}, olha a grade das ${h} e garante que tudo esteja organizado antes do início do horário.` },
  { titulo: '✅ *Conferência antes do horário*', abertura: (n, h) => `${n}, verifica agora a grade das ${h} e confirma o alinhamento com o time.` },
];

const gradeFechamentos = [
  'Se tiver alguma pendência, resolve antes do início do horário.',
  'Qualquer pendência, ajusta agora para não virar problema depois.',
  'Se tiver algo fora do lugar, resolve antes da entrada dos alunos.',
  'Se aparecer alguma pendência, ajusta antes do horário começar.',
  'Pendência vista antes vira ajuste. Pendência vista depois vira dor de cabeça.',
  'Se tiver algo pendente, resolve agora.',
  'Qualquer ajuste necessário, faz antes do início.',
  'Não deixa pendência passar para o próximo horário.',
  'Pendência identificada agora já precisa ser resolvida.',
];

function generateGradeMessage(params: { nome: string; unidade: string; horario: string; coordenador: string | null }): string {
  const firstName = (params.nome || '').split(' ')[0];
  const variant = gradeVariants[Math.floor(Math.random() * gradeVariants.length)];
  const fechamento = gradeFechamentos[Math.floor(Math.random() * gradeFechamentos.length)];

  let msg = `${variant.titulo}\n\n${variant.abertura(firstName, params.horario)}\n\n`;
  msg += `📍 *Unidade:* ${params.unidade}\n`;
  msg += `🕒 *Horário da grade:* ${params.horario}\n`;
  if (params.coordenador) {
    msg += `🧭 *Coordenador de horário:* ${params.coordenador}\n`;
  }
  msg += `\n${fechamento}`;
  return msg;
}

// Retorna o telefone canônico (aquele que o WhatsApp reconhece), ou null se o
// número não existir no WhatsApp. Preserva a resposta bruta do provedor para log.
async function resolveSendPhone(
  creds: NonNullable<ReturnType<typeof getZapiCreds>>,
  rawPhone: string,
): Promise<{ phone: string | null; exists: boolean | null; raw: unknown }> {
  const normalized = normalizePhone(rawPhone);
  const lookup = await lookupWhatsAppPhone(creds, normalized);
  if (lookup.exists === false) {
    return { phone: null, exists: false, raw: lookup.raw };
  }
  // Se existe, usa o phone canônico retornado (JID sem @, sem o "9" quando aplicável).
  // Caso o provedor não devolva phone canônico, cai no normalizado como último recurso.
  return {
    phone: (lookup.exists && lookup.phone) ? lookup.phone : normalized,
    exists: lookup.exists,
    raw: lookup.raw,
  };
}

/**
 * Retorna a hora atual em Brasília (UTC-3) como { hour, minute, dayOfWeek, dateStr }
 */
function getBrasiliaTime() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const hour = Number(v.hour);
  const minute = Number(v.minute);
  // Calcular dia da semana usando data Brasília
  const brasiliaDate = new Date(`${v.year}-${v.month}-${v.day}T12:00:00Z`);
  return {
    hour,
    minute,
    dayOfWeek: brasiliaDate.getUTCDay(),
    dateStr: `${v.year}-${v.month}-${v.day}`,
    fullDate: brasiliaDate,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: require cron secret header OR valid Supabase JWT for any non-OPTIONS request.
  {
    const __auth = await authorizeCronOrJwt(req);
    if (!__auth.ok) {
      return new Response(
        JSON.stringify({ error: __auth.error || 'Unauthorized' }),
        { status: __auth.status || 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }

  try {
    const creds = getZapiCreds('operacional');

    if (!creds) {
      return new Response(
        JSON.stringify({ error: 'ZAPI credentials not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Verifica status do WhatsApp antes de qualquer envio
    let zapiConnected = false;
    let zapiStatusData: any = null;
    try {
      const status = await checkZapiStatus(creds);
      zapiConnected = status.connected;
      zapiStatusData = status.raw;
      console.log(`[send-cronograma] ${creds.provider} status: connected=${zapiConnected}`, zapiStatusData);
    } catch (e) {
      console.error(`[send-cronograma] Erro ao verificar status ${creds.provider}:`, e);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Aceitar force_hour e force_minute para disparo manual
    let body: any = {};
    try { body = await req.json(); } catch { /* sem body */ }

    const brasilia = getBrasiliaTime();
    const forceHour = body?.force_hour;
    const forceMinute = body?.force_minute ?? 0;
    const currentHour = forceHour !== undefined ? forceHour : brasilia.hour;
    const currentMinute = forceHour !== undefined ? forceMinute : brasilia.minute;
    const dayOfWeek = brasilia.dayOfWeek;
    const todayStr = brasilia.dateStr;
    const isForced = forceHour !== undefined;

    console.log(`[send-cronograma] Hora Brasília: ${currentHour}:${String(currentMinute).padStart(2, '0')}, dia semana: ${dayOfWeek}, data: ${todayStr}${isForced ? ' (FORÇADO)' : ''}`);

    // Buscar atividades ativas do dia da semana atual
    const { data: atividades, error: atividadesError } = await supabase
      .from('cronograma_atividades')
      .select(`
        id, titulo, horario, mensagem, formulario_id, unidade_id,
        responsavel:cronograma_funcionarios!cronograma_atividades_responsavel_id_fkey(id, nome, telefone)
      `)
      .eq('ativo', true)
      .eq('dia_semana', dayOfWeek);

    if (atividadesError) {
      console.error('[send-cronograma] Erro ao buscar atividades:', atividadesError);
      return new Response(
        JSON.stringify({ error: 'Erro interno ao processar a solicitação.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!atividades || atividades.length === 0) {
      console.log('[send-cronograma] Nenhuma atividade para hoje');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Nenhuma atividade para hoje' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filtrar atividades cujo horário está na janela atual
    const atividadesNaJanela = atividades.filter(a => {
      if (!a.horario) return false;
      const [hStr, mStr] = a.horario.split(':');
      const aHour = parseInt(hStr, 10);
      const aMinute = parseInt(mStr, 10);
      if (isForced) {
        // Quando forçado, enviar todas do horário exato
        return aHour === currentHour;
      }
      const aTotalMin = aHour * 60 + aMinute;
      const nowTotalMin = currentHour * 60 + currentMinute;
      // Janela de -240 a +2 minutos: cobre o horário-alvo + uma janela LONGA de
      // recuperação (4h). Se o provedor recusar (ex.: JID/LID inválido) ou a ponte
      // da D-API ficar fora do ar por horas (incidente de 13/08), a atividade continua
      // elegível e é reenviada automaticamente quando a ponte voltar.
      // Duplicação é impossível: `cronograma_envios` + `whatsapp_idempotencia`
      // (chave por atividade + data) só liberam nova tentativa após recusa definitiva.
      return aTotalMin >= nowTotalMin - 240 && aTotalMin <= nowTotalMin + 2;


    });

    console.log(`[send-cronograma] ${atividadesNaJanela.length} atividade(s) na janela de horário`);

    if (atividadesNaJanela.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Nenhuma atividade na janela atual' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar quais já foram enviadas COM SUCESSO hoje (para não duplicar).
    // Registros com status='erro' NÃO bloqueiam — permitem nova tentativa.
    const atividadeIds = atividadesNaJanela.map(a => a.id);
    const { data: enviosHoje } = await supabase
      .from('cronograma_envios')
      .select('atividade_id, funcionario_id')
      .in('atividade_id', atividadeIds)
      .eq('status', 'enviado')
      .gte('created_at', todayStr + 'T00:00:00-03:00')
      .lte('created_at', todayStr + 'T23:59:59-03:00');

    const enviosSet = new Set(
      (enviosHoje || []).map(e => `${e.atividade_id}_${e.funcionario_id}`)
    );

    // Buscar nomes das unidades
    const unidadeIds = [...new Set(atividadesNaJanela.map(a => a.unidade_id))];
    const { data: unidades } = await supabase
      .from('unidades')
      .select('id, nome')
      .in('id', unidadeIds);
    const unidadeMap = new Map((unidades || []).map(u => [u.id, u.nome]));

    // Buscar nomes dos formulários vinculados
    const formularioIds = atividadesNaJanela
      .filter(a => a.formulario_id)
      .map(a => a.formulario_id);
    
    let formularioMap = new Map<string, string>();
    if (formularioIds.length > 0) {
      const { data: formularios } = await supabase
        .from('formularios')
        .select('id, titulo')
        .in('id', formularioIds);
      formularioMap = new Map((formularios || []).map(f => [f.id, f.titulo]));
    }

    let sentCount = 0;
    let offlineErrorCount = 0;
    // Quando a ponte (bridge) do provedor está fora do ar, TODOS os envios falham.
    // Nesse caso abortamos o lote imediatamente: não faz sentido queimar dezenas de
    // tentativas e 10s de rate-limit por atividade. As atividades permanecem
    // elegíveis na janela de recuperação e saem no próximo cron.
    let bridgeOffline = false;
    const isBridgeOffline = (raw: string) =>
      /no responders|bridge offline|nats|session .* not (connected|found)|econnrefused|502|503|504/i.test(raw || '');
    const errors: string[] = [];
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const RATE_LIMIT_MS = 10000; // 10s entre envios para proteger o chip
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let isFirstSend = true;



    for (const atividade of atividadesNaJanela) {
      const resp = atividade.responsavel as any;
      if (!resp || !resp.telefone) {
        console.log(`[send-cronograma] Sem responsável/telefone para: ${atividade.titulo}`);
        continue;
      }

      const funcionarioId = resp.id;
      const chave = `${atividade.id}_${funcionarioId}`;
      if (enviosSet.has(chave)) {
        console.log(`[send-cronograma] Já enviado hoje: ${atividade.titulo} → ${resp.nome}`);
        continue;
      }

      const lookupResult = await resolveSendPhone(creds, resp.telefone);
      const normalizedPhone = lookupResult.phone;
      const unidadeNome = unidadeMap.get(atividade.unidade_id) || 'Unidade';

      // Se o número NÃO existe no WhatsApp, registra como nao_encontrado e pula (não é retentável).
      if (lookupResult.exists === false || !normalizedPhone) {
        console.error(`[send-cronograma] ⚠️ Número sem WhatsApp: ${resp.nome} (${resp.telefone})`);
        await supabase.from('whatsapp_envios_log').insert({
          funcao: 'send-cronograma-messages',
          destino: normalizePhone(resp.telefone),
          tipo_destino: 'funcionario',
          unidade_id: atividade.unidade_id,
          sucesso: false,
          status_envio: 'nao_encontrado',
          erro_msg: 'Número não registrado no WhatsApp (lookup)',
          resposta_completa: lookupResult.raw ?? null,
          zapi_status_code: null,
        });
        // NÃO grava em cronograma_envios → não bloqueia futuras execuções, mas também
        // não fica tentando eternamente porque o número simplesmente não tem WhatsApp.
        errors.push(`Número inexistente: ${resp.nome} - ${atividade.titulo}`);
        continue;
      }

      // Montar a mensagem
      let message = '';
      const tituloLower = (atividade.titulo || '').toLowerCase();
      const mensagemLower = (atividade.mensagem || '').toLowerCase();
      const isWhey = tituloLower.includes('whey');
      const isGrade = /grade de hor[áa]rio/i.test(atividade.titulo || '')
        || /grade do pr[óo]ximo hor[áa]rio/i.test(atividade.mensagem || '');

      if (isWhey) {
        message = generateWheyMessage(resp.nome);
        if (atividade.formulario_id) {
          const formLink = `${SUPABASE_URL.replace('.supabase.co', '.lovable.app')}/formulario/${atividade.formulario_id}`;
          message += `\n\n🔗 ${formLink}`;
        }
      } else if (isGrade) {
        const coordMatch = (atividade.mensagem || '').match(/Coordenador de hor[áa]rio[:\*\s]+([^\n*]+)/i);
        message = generateGradeMessage({
          nome: resp.nome,
          unidade: unidadeNome,
          horario: atividade.horario?.substring(0, 5) ?? '',
          coordenador: coordMatch ? coordMatch[1].trim() : null,
        });
      } else if (atividade.mensagem) {
        // Mensagem customizada — troca [NOME]/[nome]/{nome} pelo primeiro nome capitalizado
        const bruto = (resp.nome || '').trim().split(/\s+/)[0] || '';
        const primeiroNome = bruto ? bruto.charAt(0).toUpperCase() + bruto.slice(1).toLowerCase() : '';
        message = atividade.mensagem.replace(/[\[{]\s*nome\s*[\]}]/gi, primeiroNome);


      } else if (atividade.formulario_id) {
        const formTitulo = formularioMap.get(atividade.formulario_id) || 'Formulário';
        const formLink = `${SUPABASE_URL.replace('.supabase.co', '.lovable.app')}/formulario/${atividade.formulario_id}`;
        message =
          `✅ *${atividade.titulo}*\n` +
          `\n` +
          `📍 *Unidade:* ${unidadeNome}\n` +
          `🕒 *Horário:* ${atividade.horario?.substring(0, 5)}\n` +
          `👤 *Responsável:* ${resp.nome}\n` +
          `\n` +
          `📝 *Formulário:* ${formTitulo}\n` +
          `🔗 ${formLink}`;
      } else {
        message =
          `✅ *${atividade.titulo}*\n` +
          `\n` +
          `📍 *Unidade:* ${unidadeNome}\n` +
          `🕒 *Horário:* ${atividade.horario?.substring(0, 5)}\n` +
          `👤 *Responsável:* ${resp.nome}`;
      }

      console.log(`[send-cronograma] Enviando para ${resp.nome} (${normalizedPhone}): ${atividade.titulo}`);

      // Se Z-API está offline, registra erro imediatamente sem tentar enviar
      if (!zapiConnected) {
        console.error(`[send-cronograma] ❌ Z-API offline — marcando erro para ${resp.nome}`);
        await supabase.from('cronograma_envios').insert({
          atividade_id: atividade.id,
          formulario_id: atividade.formulario_id || null,
          funcionario_id: funcionarioId,
          unidade_id: atividade.unidade_id,
          status: 'erro',
          enviado_em: new Date().toISOString(),
        });
        await supabase.from('whatsapp_envios_log').insert({
          funcao: 'send-cronograma-messages',
          destino: normalizedPhone,
          tipo_destino: 'funcionario',
          unidade_id: atividade.unidade_id,
          sucesso: false,
          status_envio: 'falhou',
          erro_msg: `provedor offline: ${JSON.stringify(zapiStatusData || {})}`,
          resposta_completa: zapiStatusData ?? null,
          zapi_status_code: null,
        });
        errors.push(`Provedor offline: ${resp.nome} - ${atividade.titulo}`);
        offlineErrorCount++;
        continue;
      }

      // Rate limit: aguarda 10s entre envios sequenciais (não no primeiro)
      if (!isFirstSend) {
        await sleep(RATE_LIMIT_MS);
      }
      isFirstSend = false;

      try {
        // Usa helper compartilhado — roteia automaticamente para D-API ou Z-API.
        const idemKey = buildIdempotencyKey(['send-cronograma-messages', atividade.id, funcionarioId, todayStr, normalizedPhone]);

        // Atividades de ENCERRAMENTO com formulário recebem opções clicáveis
        // (CONCLUÍDO / PENDENTE). A resposta é processada pelo webhook
        // rotina-whatsapp-response e grava o status em cronograma_envios.
        const isEncerramento = /encerramento/i.test(atividade.titulo || '');
        const usaOpcoes = isEncerramento && !!atividade.formulario_id;

        const sendResult = usaOpcoes
          ? await sendListIdempotent(
              supabase,
              creds,
              normalizedPhone,
              {
                description: message,
                buttonText: 'Responder',
                footerText: 'Toque em Responder e escolha uma opção',
                sectionTitle: 'Status do encerramento',
                rows: [
                  {
                    rowId: `crono|${atividade.id}|${todayStr}|concluido`,
                    title: 'CONCLUÍDO',
                    description: 'Já preenchi o formulário de encerramento',
                  },
                  {
                    rowId: `crono|${atividade.id}|${todayStr}|pendente`,
                    title: 'PENDENTE',
                    description: 'Ainda vou preencher',
                  },
                ],
              },
              { chave: idemKey, funcao: 'send-cronograma-messages' },
            )
          : await sendTextIdempotent(supabase, creds, normalizedPhone, message, { chave: idemKey, funcao: 'send-cronograma-messages' });
        if (sendResult.skipped) {
          console.log(`[send-cronograma] Duplicidade bloqueada: ${atividade.titulo} → ${resp.nome}`);
          continue;
        }

        const body = sendResult.body ?? {};

        // Detecção de sucesso por provedor:
        //   D-API   → body.success === true (e sem body.error)
        //   Z-API   → HTTP ok + messageId presente + sem error
        let reallyOk = false;
        let statusEnvio: 'enviado' | 'falhou' | 'nao_encontrado' = 'falhou';
        let erroMsg: string | null = null;

        if (creds.provider === 'dapi') {
          reallyOk = sendResult.ok && body?.success === true && !body?.error;
          const raw = String(body?.message ?? body?.error ?? '');
          if (!reallyOk) {
            erroMsg = body?.message || body?.error || `HTTP ${sendResult.status}`;
            // "server returned error 463" = JID inválido / número sem WhatsApp para este JID
            if (/error 463/i.test(raw) || /not.?found/i.test(raw) || /not registered/i.test(raw)) {
              statusEnvio = 'nao_encontrado';
            }
          } else {
            statusEnvio = 'enviado';
          }
        } else {
          const messageId = body?.messageId || body?.id || null;
          const zapiError = body?.error || (typeof body?.message === 'string' ? body.message : null);
          reallyOk = sendResult.ok && !!messageId && !zapiError;
          if (!reallyOk) {
            erroMsg = zapiError || `sem messageId (HTTP ${sendResult.status})`;
            if (typeof zapiError === 'string' && /not.?found|not registered/i.test(zapiError)) {
              statusEnvio = 'nao_encontrado';
            }
          } else {
            statusEnvio = 'enviado';
          }
        }

        // Só grava cronograma_envios em caso de SUCESSO real (bloqueia duplicidade).
        // Falhas permanecem retentáveis na próxima execução do cron.
        if (reallyOk) {
          await supabase.from('cronograma_envios').insert({
            atividade_id: atividade.id,
            formulario_id: atividade.formulario_id || null,
            funcionario_id: funcionarioId,
            unidade_id: atividade.unidade_id,
            status: 'enviado',
            enviado_em: new Date().toISOString(),
          });
        }

        await supabase.from('whatsapp_envios_log').insert({
          funcao: 'send-cronograma-messages',
          destino: normalizedPhone,
          tipo_destino: 'funcionario',
          unidade_id: atividade.unidade_id,
          sucesso: reallyOk,
          status_envio: statusEnvio,
          erro_msg: erroMsg,
          resposta_completa: body,
          zapi_status_code: sendResult.status,
        });

        if (reallyOk) {
          sentCount++;
          console.log(`[send-cronograma] ✅ Enviado para ${resp.nome} (${statusEnvio})`);
        } else {
          console.error(`[send-cronograma] ❌ Falha (${statusEnvio}) para ${resp.nome}:`, body);
          errors.push(`${statusEnvio}: ${resp.nome} - ${atividade.titulo} - ${erroMsg || 'sem detalhe'}`);
          // Ponte do provedor fora do ar → aborta o lote e alerta.
          if (isBridgeOffline(`${erroMsg ?? ''} ${JSON.stringify(body ?? {})}`)) {
            bridgeOffline = true;
            offlineErrorCount++;
            console.error('[send-cronograma] 🛑 Ponte do provedor offline — abortando o lote (retry automático na janela de recuperação)');
            break;
          }
        }

      } catch (err) {
        console.error(`[send-cronograma] ❌ Erro ao enviar para ${resp.nome}:`, err);
        await supabase.from('whatsapp_envios_log').insert({
          funcao: 'send-cronograma-messages',
          destino: normalizedPhone,
          tipo_destino: 'funcionario',
          unidade_id: atividade.unidade_id,
          sucesso: false,
          status_envio: 'falhou',
          erro_msg: String((err as Error)?.message ?? err),
          resposta_completa: null,
          zapi_status_code: null,
        });
        errors.push(`Erro envio: ${resp.nome} - ${atividade.titulo}`);
      }
    }

    console.log(`[send-cronograma] Concluído: ${sentCount} enviado(s), ${errors.length} erro(s) (${offlineErrorCount} por Z-API offline)`);

    // Alerta (com throttle) se o provedor estiver offline / ponte caída
    if (offlineErrorCount >= 2 || bridgeOffline) {
      await maybeSendZapiOfflineAlert({
        supabase,
        funcao: 'send-cronograma-messages',
        affectedCount: Math.max(offlineErrorCount, 1),
        zapiStatus: bridgeOffline ? { motivo: 'bridge_offline', detalhe: errors.slice(0, 3) } : zapiStatusData,
      });
    }


    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        errors,
        bridge_offline: bridgeOffline,
        total_na_janela: atividadesNaJanela.length,
        hora_brasilia: `${currentHour}:${String(currentMinute).padStart(2, '0')}`,
      }),

      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[send-cronograma] Erro geral:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
