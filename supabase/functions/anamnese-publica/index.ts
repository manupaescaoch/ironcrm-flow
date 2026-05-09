// Public edge function to read lead info and save anamnese without auth.
// Used by the public form opened on a phone not logged into the CRM.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body?.action as "get" | "save";
    const leadId = body?.lead_id as string;

    if (!leadId) {
      return json({ error: "lead_id obrigatório" }, 400);
    }

    if (action === "get") {
      const { data: lead, error } = await supabase
        .from("leads")
        .select("id, nome, unidade_id")
        .eq("id", leadId)
        .maybeSingle();
      if (error || !lead) return json({ error: "Lead não encontrado" }, 404);

      const { data: u } = await supabase
        .from("unidades")
        .select("nome")
        .eq("id", lead.unidade_id)
        .maybeSingle();

      const { data: existing } = await supabase
        .from("anamneses_experimental")
        .select("*")
        .eq("lead_id", leadId)
        .maybeSingle();

      return json({
        lead: { ...lead, unidade_nome: u?.nome ?? "—" },
        existing,
      });
    }

    if (action === "save") {
      const respostas = body?.respostas ?? {};
      const { data: lead, error: leadErr } = await supabase
        .from("leads")
        .select("id, unidade_id")
        .eq("id", leadId)
        .maybeSingle();
      if (leadErr || !lead) return json({ error: "Lead não encontrado" }, 404);

      const payload = {
        lead_id: lead.id,
        unidade_id: lead.unidade_id,
        nome: respostas.nome?.trim() || null,
        objetivo: respostas.objetivo || null,
        historico: respostas.historico || null,
        frequencia_atual: respostas.frequencia_atual || null,
        obstaculo: respostas.obstaculo || null,
        dias_semana: respostas.dias_semana || null,
        preferencia_horario: respostas.preferencia_horario ?? [],
        tem_condicao_saude: respostas.tem_condicao_saude ?? null,
        condicao_saude_descricao:
          respostas.condicao_saude_descricao?.trim() || null,
        tem_lesao: respostas.tem_lesao ?? null,
        lesao_descricao: respostas.lesao_descricao?.trim() || null,
        observacoes: respostas.observacoes?.trim() || null,
        preenchido_por: "FORMULARIO_PUBLICO",
      };

      const { data: saved, error } = await supabase
        .from("anamneses_experimental")
        .upsert(payload, { onConflict: "lead_id" })
        .select("id")
        .single();
      if (error) return json({ error: error.message }, 500);

      // Dispara notificação WhatsApp (não bloqueia)
      supabase.functions
        .invoke("notify-anamnese-experimental", {
          body: { anamnese_id: saved.id },
        })
        .catch((e) => console.warn("[anamnese-publica] notify falhou", e));

      return json({ ok: true, id: saved.id });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("[anamnese-publica] erro", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
