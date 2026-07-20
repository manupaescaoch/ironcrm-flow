import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkZapiStatus, getZapiCreds, sendText, logEnvio } from '../_shared/zapi.ts';

const corsHeaders = {

  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function normalizePhoneNumber(phone: string): string {
  const formattedPhone = phone.replace(/\D/g, "");
  return formattedPhone.startsWith("55")
    ? formattedPhone
    : `55${formattedPhone}`;
}

interface Task {
  id: string;
  titulo: string;
  responsavel: string;
  prazo: string;
  hora_prazo: string | null;
  notificado_24h: boolean;
  notificado_prazo: boolean;
}

async function sendWhatsApp(phone: string, message: string, supabase: any): Promise<boolean> {
  const creds = getZapiCreds('operacional');
  if (!creds) {
    console.log("WhatsApp operacional não configurado");
    await logEnvio(supabase, {
      funcao: 'notify-task-deadlines',
      destino: normalizePhoneNumber(phone),
      tipo_destino: 'funcionario',
      sucesso: false,
      erro_msg: 'Credenciais WhatsApp operacional ausentes',
      canal: 'operacional',
    });
    return false;
  }

  const phoneToSend = normalizePhoneNumber(phone);

  try {
    const sendResult = await sendText(creds, phoneToSend, message);
    const success = sendResult.ok && !!(sendResult.body?.messageId || sendResult.body?.id);
    await logEnvio(supabase, {
      funcao: 'notify-task-deadlines',
      destino: phoneToSend,
      tipo_destino: 'funcionario',
      sucesso: success,
      erro_msg: success ? null : (sendResult.body?.error || JSON.stringify(sendResult.body).slice(0, 500)),
      zapi_status_code: sendResult.status,
      canal: 'operacional',
      resposta_completa: sendResult.body,
    });
    console.log(`[notify-task-deadlines] ${creds.provider} ${success ? 'enviado' : 'falhou'} para ${phoneToSend}`, sendResult.body);
    return success;
  } catch (error) {
    console.error("Failed to send WhatsApp:", error);
    await logEnvio(supabase, {
      funcao: 'notify-task-deadlines',
      destino: phoneToSend,
      tipo_destino: 'funcionario',
      sucesso: false,
      erro_msg: String(error).slice(0, 500),
      canal: 'operacional',
    });
    return false;
  }
}


async function getPhoneByName(
  supabase: any,
  name: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_user_phone_by_name", {
    p_name: name,
  });

  if (error) {
    console.error("Error getting phone:", error);
    return null;
  }

  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // [WhatsApp health] aborta cedo se o chip operacional estiver offline
    {
      const creds = getZapiCreds('operacional');
      if (!creds) {
        console.warn('[notify-task-deadlines] WhatsApp operacional não configurado');
        return new Response(
          JSON.stringify({ error: 'WhatsApp operacional não configurado' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const __st = await checkZapiStatus(creds);
      if (!__st.connected) {
        console.warn(`[notify-task-deadlines] ${creds.provider} offline — abortando`, __st.raw);
        return new Response(
          JSON.stringify({ error: 'WhatsApp operacional desconectado', provider: creds.provider, status: __st.raw }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const now = new Date();

    const nowUTC = now.toISOString();

    // Calculate 24h from now (with some tolerance)
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in24hMinus15min = new Date(now.getTime() + 24 * 60 * 60 * 1000 - 15 * 60 * 1000);

    const results = {
      notified_24h: [] as string[],
      notified_deadline: [] as string[],
      errors: [] as string[],
    };

    // 1. Find tasks due in approximately 24h (not yet notified)
    const { data: tasks24h, error: error24h } = await supabase
      .from("tasks")
      .select("id, titulo, responsavel, prazo, hora_prazo, notificado_24h, descricao, created_by, unidade_id")
      .eq("notificado_24h", false)
      .eq("arquivada", false)
      .neq("status", "concluida")
      .not("prazo", "is", null);

    if (error24h) {
      console.error("Error fetching 24h tasks:", error24h);
    }

    // Filter tasks that are approximately 24h away
    const tasksToNotify24h = (tasks24h || []).filter((task) => {
      const taskDateTime = getTaskDateTime(task.prazo, task.hora_prazo);
      return taskDateTime >= in24hMinus15min && taskDateTime <= in24h;
    });

    for (const task of tasksToNotify24h) {
      const phone = await getPhoneByName(supabase, task.responsavel);
      if (phone) {
        const horaStr = task.hora_prazo
          ? ` às ${task.hora_prazo.slice(0, 5)}`
          : "";
        const [py, pm, pd] = task.prazo.slice(0, 10).split('-');
        const prazoFormatado = `${pd}/${pm}/${py}`;

        // Buscar nome da unidade
        let unidadeNome = "";
        if (task.unidade_id) {
          const { data: unidade } = await supabase.from("unidades").select("nome").eq("id", task.unidade_id).single();
          unidadeNome = unidade?.nome || "";
        }

        // Buscar nome do criador
        let criadorNome = "";
        if (task.created_by) {
          const { data: { users } } = await supabase.auth.admin.listUsers();
          const creator = users?.find(u => u.id === task.created_by);
          criadorNome = creator?.user_metadata?.full_name || creator?.user_metadata?.name || "";
        }

        let message = `⚠️ *Lembrete de prazo — vence amanhã*\n\n`;
        message += `📋 *Tarefa:* ${task.titulo}\n`;
        if (unidadeNome) message += `📍 *Unidade:* ${unidadeNome}\n`;
        message += `🕒 *Prazo:* ${prazoFormatado}${horaStr}\n`;
        if (criadorNome) message += `👤 *Atribuída por:* ${criadorNome}\n`;
        if (task.descricao) message += `\n💬 *Descrição:*\n${task.descricao}\n`;
        message += `\nNão esqueça de concluí-la! ✅`;

        const sent = await sendWhatsApp(phone, message);
        if (sent) {
          await supabase
            .from("tasks")
            .update({ notificado_24h: true })
            .eq("id", task.id);
          results.notified_24h.push(task.titulo);
        } else {
          results.errors.push(`24h: ${task.titulo}`);
        }
      }
    }

    // 2. Find tasks that are due NOW (not yet notified for deadline)
    const { data: tasksPrazo, error: errorPrazo } = await supabase
      .from("tasks")
      .select("id, titulo, responsavel, prazo, hora_prazo, notificado_prazo, descricao, created_by, unidade_id")
      .eq("notificado_prazo", false)
      .eq("arquivada", false)
      .neq("status", "concluida")
      .not("prazo", "is", null);

    if (errorPrazo) {
      console.error("Error fetching deadline tasks:", errorPrazo);
    }

    // Filter tasks that are at or past their deadline (within the last 15 minutes)
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const tasksToNotifyDeadline = (tasksPrazo || []).filter((task) => {
      const taskDateTime = getTaskDateTime(task.prazo, task.hora_prazo);
      return taskDateTime >= fifteenMinutesAgo && taskDateTime <= now;
    });

    for (const task of tasksToNotifyDeadline) {
      const phone = await getPhoneByName(supabase, task.responsavel);
      if (phone) {
        // Buscar nome da unidade
        let unidadeNome = "";
        if (task.unidade_id) {
          const { data: unidade } = await supabase.from("unidades").select("nome").eq("id", task.unidade_id).single();
          unidadeNome = unidade?.nome || "";
        }

        // Buscar nome do criador
        let criadorNome = "";
        if (task.created_by) {
          const { data: { users } } = await supabase.auth.admin.listUsers();
          const creator = users?.find(u => u.id === task.created_by);
          criadorNome = creator?.user_metadata?.full_name || creator?.user_metadata?.name || "";
        }

        let message = `🚨 *Prazo final — vence agora!*\n\n`;
        message += `📋 *Tarefa:* ${task.titulo}\n`;
        if (unidadeNome) message += `📍 *Unidade:* ${unidadeNome}\n`;
        if (criadorNome) message += `👤 *Atribuída por:* ${criadorNome}\n`;
        if (task.descricao) message += `\n💬 *Descrição:*\n${task.descricao}\n`;
        message += `\nPor favor, conclua o quanto antes. ✅`;

        const sent = await sendWhatsApp(phone, message);
        if (sent) {
          await supabase
            .from("tasks")
            .update({ notificado_prazo: true })
            .eq("id", task.id);
          results.notified_deadline.push(task.titulo);
        } else {
          results.errors.push(`deadline: ${task.titulo}`);
        }
      }
    }

    console.log("Notification results:", results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-task-deadlines:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

function getTaskDateTime(prazo: string, hora_prazo: string | null): Date {
  // prazo: "YYYY-MM-DD", hora_prazo: "HH:MM[:SS]" — interpretar em BRT (-03:00)
  const dateOnly = prazo.slice(0, 10);
  const time = hora_prazo ? hora_prazo.slice(0, 5) : '23:59';
  return new Date(`${dateOnly}T${time}:00-03:00`);
}
