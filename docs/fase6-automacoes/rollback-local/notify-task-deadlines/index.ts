import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

/**
 * Resolve o user_id pelo nome do responsável (metadata do auth).
 */
async function getUserIdByName(supabase: any, name: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Erro ao listar usuários:", error);
    return null;
  }
  const target = data.users?.find((u: any) => {
    const n = (u.user_metadata?.full_name || u.user_metadata?.name || "") as string;
    return n.toUpperCase().trim() === name.toUpperCase().trim();
  });
  return target?.id ?? null;
}

/**
 * Cria notificação no EVO OPS (dispara push pelo trigger em ops_notificacoes).
 */
async function notifyOps(
  supabase: any,
  usuarioId: string,
  tipo: string,
  titulo: string,
  mensagem: string,
): Promise<boolean> {
  const { error } = await supabase.from("ops_notificacoes").insert({
    usuario_id: usuarioId,
    tipo,
    titulo,
    mensagem,
  });
  if (error) {
    console.error("Erro ao criar notificação OPS:", error);
    return false;
  }
  return true;
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in24hMinus15min = new Date(now.getTime() + 24 * 60 * 60 * 1000 - 15 * 60 * 1000);

    const results = {
      notified_24h: [] as string[],
      notified_deadline: [] as string[],
      errors: [] as string[],
    };

    const selectCols = "id, titulo, responsavel, prazo, hora_prazo, descricao, created_by, unidade_id";

    async function buildContext(task: any) {
      let unidadeNome = "";
      if (task.unidade_id) {
        const { data: unidade } = await supabase
          .from("unidades")
          .select("nome")
          .eq("id", task.unidade_id)
          .single();
        unidadeNome = unidade?.nome || "";
      }
      let criadorNome = "";
      if (task.created_by) {
        const { data } = await supabase.auth.admin.listUsers();
        const creator = data.users?.find((u: any) => u.id === task.created_by);
        criadorNome = creator?.user_metadata?.full_name || creator?.user_metadata?.name || "";
      }
      return { unidadeNome, criadorNome };
    }

    // 1. Tarefas que vencem em ~24h
    const { data: tasks24h, error: error24h } = await supabase
      .from("tasks")
      .select(selectCols + ", notificado_24h")
      .eq("notificado_24h", false)
      .eq("arquivada", false)
      .neq("status", "concluida")
      .not("prazo", "is", null);

    if (error24h) console.error("Erro ao buscar tarefas 24h:", error24h);

    const tasksToNotify24h = (tasks24h || []).filter((task: any) => {
      const dt = getTaskDateTime(task.prazo, task.hora_prazo);
      return dt >= in24hMinus15min && dt <= in24h;
    });

    for (const task of tasksToNotify24h) {
      const usuarioId = await getUserIdByName(supabase, task.responsavel);
      if (!usuarioId) continue;

      const { unidadeNome, criadorNome } = await buildContext(task);
      const horaStr = task.hora_prazo ? ` às ${task.hora_prazo.slice(0, 5)}` : "";
      const [py, pm, pd] = task.prazo.slice(0, 10).split('-');
      const linhas = [`Tarefa: ${task.titulo}`];
      if (unidadeNome) linhas.push(`Unidade: ${unidadeNome}`);
      linhas.push(`Prazo: ${pd}/${pm}/${py}${horaStr}`);
      if (criadorNome) linhas.push(`Atribuída por: ${criadorNome}`);
      if (task.descricao) linhas.push(`Descrição: ${task.descricao}`);

      const ok = await notifyOps(
        supabase,
        usuarioId,
        "prazo_24h",
        "Tarefa vence amanhã",
        linhas.join("\n"),
      );
      if (ok) {
        await supabase.from("tasks").update({ notificado_24h: true }).eq("id", task.id);
        results.notified_24h.push(task.titulo);
      } else {
        results.errors.push(`24h: ${task.titulo}`);
      }
    }

    // 2. Tarefas no prazo final
    const { data: tasksPrazo, error: errorPrazo } = await supabase
      .from("tasks")
      .select(selectCols + ", notificado_prazo")
      .eq("notificado_prazo", false)
      .eq("arquivada", false)
      .neq("status", "concluida")
      .not("prazo", "is", null);

    if (errorPrazo) console.error("Erro ao buscar tarefas no prazo:", errorPrazo);

    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const tasksToNotifyDeadline = (tasksPrazo || []).filter((task: any) => {
      const dt = getTaskDateTime(task.prazo, task.hora_prazo);
      return dt >= fifteenMinutesAgo && dt <= now;
    });

    for (const task of tasksToNotifyDeadline) {
      const usuarioId = await getUserIdByName(supabase, task.responsavel);
      if (!usuarioId) continue;

      const { unidadeNome, criadorNome } = await buildContext(task);
      const linhas = [`Tarefa: ${task.titulo}`];
      if (unidadeNome) linhas.push(`Unidade: ${unidadeNome}`);
      if (criadorNome) linhas.push(`Atribuída por: ${criadorNome}`);
      if (task.descricao) linhas.push(`Descrição: ${task.descricao}`);
      linhas.push("Conclua o quanto antes.");

      const ok = await notifyOps(
        supabase,
        usuarioId,
        "prazo_final",
        "Prazo final da tarefa",
        linhas.join("\n"),
      );
      if (ok) {
        await supabase.from("tasks").update({ notificado_prazo: true }).eq("id", task.id);
        results.notified_deadline.push(task.titulo);
      } else {
        results.errors.push(`deadline: ${task.titulo}`);
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
