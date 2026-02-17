import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ZAPI credentials
const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");

interface Task {
  id: string;
  titulo: string;
  responsavel: string;
  prazo: string;
  hora_prazo: string | null;
  notificado_24h: boolean;
  notificado_prazo: boolean;
}

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
    console.log("ZAPI credentials not configured");
    return false;
  }

  const formattedPhone = phone.replace(/\D/g, "");
  const phoneToSend = formattedPhone.startsWith("55")
    ? formattedPhone
    : `55${formattedPhone}`;

  try {
    const response = await fetch(
      `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": ZAPI_CLIENT_TOKEN,
        },
        body: JSON.stringify({
          phone: phoneToSend,
          message,
        }),
      }
    );

    if (!response.ok) {
      console.error("ZAPI error:", await response.text());
      return false;
    }

    console.log(`WhatsApp sent to ${phoneToSend}`);
    return true;
  } catch (error) {
    console.error("Failed to send WhatsApp:", error);
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
        const prazoDate = new Date(task.prazo);
        const prazoFormatado = prazoDate.toLocaleDateString("pt-BR");

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

        let message = `⏰ *Lembrete de Prazo*\n`;
        if (unidadeNome) message += `📍 Unidade: *${unidadeNome}*\n`;
        message += `\nA tarefa *"${task.titulo}"* vence amanhã (${prazoFormatado}${horaStr}).\n`;
        if (task.descricao) message += `\n📝 *Descrição:*\n${task.descricao}\n`;
        if (criadorNome) message += `\nAtribuída por: ${criadorNome}`;
        message += `\n\nNão esqueça de concluí-la!`;

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

        let message = `🚨 *Prazo Final!*\n`;
        if (unidadeNome) message += `📍 Unidade: *${unidadeNome}*\n`;
        message += `\nA tarefa *"${task.titulo}"* vence *AGORA*!\n`;
        if (task.descricao) message += `\n📝 *Descrição:*\n${task.descricao}\n`;
        if (criadorNome) message += `\nAtribuída por: ${criadorNome}`;
        message += `\n\nPor favor, conclua-a o mais rápido possível.`;

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
  const date = new Date(prazo);
  if (hora_prazo) {
    const [hours, minutes] = hora_prazo.split(":");
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  } else {
    // If no time specified, default to end of day (23:59)
    date.setHours(23, 59, 0, 0);
  }
  return date;
}
