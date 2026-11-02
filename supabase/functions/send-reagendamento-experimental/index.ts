import { controlledSend } from '../_shared/contactControl.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';
import { authorizeFollowUp, FollowUpError, assertUnit } from '../_shared/followUpAuthorization.ts';
import { validateExperimental, runReagendamento } from '../_shared/reagendamentoFlow.ts';
import { checkZapiStatus, getZapiCreds, phoneExists, sendTextIdempotent } from '../_shared/zapi.ts';

const FUNC = 'send-reagendamento-experimental';
const BodySchema = z.object({ lead_id: z.string().uuid(), interacao_id: z.string().uuid().optional(), responsavel_nome: z.string().max(200).optional() }).strict();
export async function handleReagendamento(req: Request) {
  const headers = { ...corsHeaders, 'Access-Control-Allow-Headers': `${corsHeaders['Access-Control-Allow-Headers']}, x-cron-secret`, 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  try {
    const scope = await authorizeFollowUp(req, 'reagendar');
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) throw new FollowUpError(400, 'Solicitação inválida');
    const body = parsed.data;
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: lead, error: leadError } = await admin.from('leads')
      .select('id,nome,telefone,unidade_id,ativo,is_matriculado,pausado_fu,status_funil,data_aula_experimental,hora_aula_experimental').eq('id', body.lead_id).maybeSingle();
    if (leadError || !lead) throw new FollowUpError(404, 'Lead indisponível');
    assertUnit(scope, lead.unidade_id);
    let query = admin.from('interacoes').select('id,lead_id,unidade_id,agendou_experimental,data_experimental,hora_experimental,compareceu,cancelado');
    if (body.interacao_id) query = query.eq('id', body.interacao_id);
    else query = query.eq('lead_id', lead.id).eq('unidade_id', lead.unidade_id).eq('agendou_experimental', true)
      .eq('data_experimental', lead.data_aula_experimental ?? '').eq('hora_experimental', lead.hora_aula_experimental ?? '').order('created_at', { ascending: false }).limit(1);
    const { data: interaction, error: interactionError } = await query.maybeSingle();
    if (interactionError || !interaction) throw new FollowUpError(404, 'Experimental indisponível');
    const key = validateExperimental(lead, interaction, scope);
    const { data: unit, error: unitError } = await admin.from('unidades').select('nome').eq('id', lead.unidade_id).maybeSingle();
    if (unitError || !unit?.nome) throw new FollowUpError(404, 'Unidade indisponível');
    const responsible = scope.automatic ? body.responsavel_nome ?? 'SISTEMA' : scope.caller;
    const result = await runReagendamento({
      reserve: async () => {
        const { data, error } = await admin.rpc('fu_reag_reservar', { p_lead: lead.id, p_interacao: interaction.id, p_chave: key, p_responsavel: responsible });
        if (error) throw new FollowUpError(error.message.includes('elegível') ? 409 : 500, 'Não foi possível reservar o reagendamento');
        return data;
      },
      send: async () => {
        const creds = getZapiCreds('comercial');
        if (!creds) throw new FollowUpError(503, 'WhatsApp comercial não configurado');
        if (!lead.telefone) throw new FollowUpError(409, 'Lead sem telefone');
        let phone = lead.telefone.replace(/\D/g, '');
        if (!phone.startsWith('55')) phone = `55${phone}`;
        if (!(await checkZapiStatus(creds)).connected) throw new FollowUpError(503, 'WhatsApp comercial desconectado');
        if (await phoneExists(creds, phone) !== true) throw new FollowUpError(409, 'Telefone WhatsApp não confirmado');
        // Honor the old day-key as well: previously sent legacy events must never be sent again.
        const legacyKey = `${FUNC}:${lead.id}:${String(lead.data_aula_experimental).slice(0, 10)}`;
        const { data: old, error } = await admin.from('whatsapp_idempotencia').select('id').eq('chave', legacyKey).limit(1);
        if (error) throw new FollowUpError(500, 'Não foi possível conferir histórico de envio');
        if (old?.length) return { ok: false, skipped: true, status: 0 };
        const name = lead.nome.trim().split(/\s+/)[0];
        const unitName = unit.nome.replace(/^(EVO|IRON)(\s+CLUB)?\s*/i, '').trim();
        const message = `Oi, ${name}! Tudo bem?\n\nVi que você não conseguiu comparecer à sua aula experimental na EVO ${unitName}.\n\nGostaria de reagendar para outro dia?\n\nPosso verificar os horários disponíveis para você.`;
        return await controlledSend(admin, { lead_id: lead.id, unidade_id:lead.unidade_id,ciclo_id:interaction.id,chave:key,fluxo:'reagendamento',objetivo:'reagendamento_experimental',tipo_fu:'REAG',setor:'comercial',canal:'whatsapp',prioridade:1,nao_urgente:false,excecao:'reagendamento_experimental_elegivel',responsavel:responsible }, () => sendTextIdempotent(admin, creds, phone, message, { chave:key,funcao:FUNC }));
      },
      finish: async (reservation, state, status) => {
        const { error } = await admin.rpc('fu_reag_finalizar', { p_id: reservation.id, p_chave: key, p_estado: state, p_status: status });
        if (error) throw new FollowUpError(500, 'Resultado pendente de reconciliação; não repetir o envio');
      },
    });
    return new Response(JSON.stringify(result), { headers });
  } catch (error) {
    const status = error instanceof FollowUpError ? error.status : error instanceof SyntaxError ? 400 : 500;
    return new Response(JSON.stringify({ error: error instanceof FollowUpError ? error.message : 'Solicitação não concluída' }), { headers, status });
  }
}
if (import.meta.main) Deno.serve(handleReagendamento);
