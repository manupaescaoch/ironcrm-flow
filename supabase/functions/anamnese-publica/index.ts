// Public edge function used by the anamnese form opened on a phone not logged into the CRM.
// Public actions: open form by lead_id (returns minimal data only) + submit by phone.
// Authenticated action: get_full (CRM-only, requires JWT + admin/user role + unit scope).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitize(value: unknown, max = 2000): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function extractDateOnly(value: unknown): string | null {
  const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Payload inválido" }, 400);
    }
    const action = (body as Record<string, unknown>).action as string | undefined;

    // ===================================================================
    // PUBLIC: open form by lead_id — returns ONLY minimum data, no PII.
    // ===================================================================
    if (action === "get") {
      const leadId = (body as Record<string, unknown>).lead_id;
      if (typeof leadId !== "string" || !UUID_RE.test(leadId)) {
        return json({ error: "Parâmetro inválido" }, 400);
      }

      const { data: lead, error } = await supabase
        .from("leads")
        .select("id, nome, unidade_id")
        .eq("id", leadId)
        .maybeSingle();
      if (error || !lead) return json({ error: "Formulário não encontrado" }, 404);

      const { data: u } = await supabase
        .from("unidades")
        .select("nome")
        .eq("id", lead.unidade_id)
        .maybeSingle();

      // Only check existence — never expose stored answers publicly.
      const { data: existing } = await supabase
        .from("anamneses_experimental")
        .select("id")
        .eq("lead_id", leadId)
        .maybeSingle();

      return json({
        lead: {
          id: lead.id,
          nome: lead.nome,
          unidade_nome: u?.nome ?? "—",
        },
        already_filled: !!existing,
      });
    }

    // ===================================================================
    // PUBLIC: save form by lead_id — refuses overwrite if already filled.
    // ===================================================================
    if (action === "save") {
      const leadId = (body as Record<string, unknown>).lead_id;
      if (typeof leadId !== "string" || !UUID_RE.test(leadId)) {
        return json({ error: "Parâmetro inválido" }, 400);
      }
      const respostas = (body as Record<string, unknown>).respostas as
        | Record<string, unknown>
        | undefined ?? {};

      const { data: lead, error: leadErr } = await supabase
        .from("leads")
        .select("id, unidade_id")
        .eq("id", leadId)
        .maybeSingle();
      if (leadErr || !lead) return json({ error: "Formulário não encontrado" }, 404);

      const { data: existing } = await supabase
        .from("anamneses_experimental")
        .select("id")
        .eq("lead_id", lead.id)
        .maybeSingle();
      if (existing) {
        return json({ error: "Anamnese já preenchida." }, 409);
      }

      const payload = {
        lead_id: lead.id,
        unidade_id: lead.unidade_id,
        nome: sanitize(respostas.nome, 255),
        data_nascimento: extractDateOnly(respostas.data_nascimento),
        objetivo: sanitize(respostas.objetivo),
        historico: sanitize(respostas.historico),
        frequencia_atual: sanitize(respostas.frequencia_atual),
        obstaculo: sanitize(respostas.obstaculo),
        dias_semana: sanitize(respostas.dias_semana),
        preferencia_horario: Array.isArray(respostas.preferencia_horario)
          ? (respostas.preferencia_horario as unknown[])
              .filter((v) => typeof v === "string")
              .slice(0, 20)
          : [],
        tem_condicao_saude:
          typeof respostas.tem_condicao_saude === "boolean"
            ? respostas.tem_condicao_saude
            : null,
        condicao_saude_descricao: sanitize(respostas.condicao_saude_descricao),
        tem_lesao:
          typeof respostas.tem_lesao === "boolean" ? respostas.tem_lesao : null,
        lesao_descricao: sanitize(respostas.lesao_descricao),
        observacoes: sanitize(respostas.observacoes),
        preenchido_por: null,
      };

      const { data: saved, error } = await supabase
        .from("anamneses_experimental")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        console.error("[anamnese-publica] save error", error);
        return json({ error: "Falha ao salvar" }, 500);
      }

      supabase.functions
        .invoke("notify-anamnese-experimental", { body: { anamnese_id: saved.id }, headers: { "x-cron-secret": Deno.env.get("BACKUP_CRON_SECRET") ?? "" } })
        .catch((e) => console.warn("[anamnese-publica] notify falhou", e));

      return json({ ok: true });
    }

    // ===================================================================
    // PUBLIC: list active unidades (id + nome only) for the public form.
    // ===================================================================
    if (action === "unidades") {
      const { data: unidades, error } = await supabase
        .from("unidades")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) {
        console.error("[anamnese-publica] unidades", error);
        return json({ error: "Falha ao carregar unidades" }, 500);
      }
      return json({ unidades: unidades ?? [] });
    }

    // ===================================================================
    // PUBLIC: submit by phone (form universal). Phone-filtered DB query.
    // ===================================================================
    if (action === "submit") {
      const nome = sanitize((body as Record<string, unknown>).nome, 255)?.toUpperCase();
      const telefoneRaw = sanitize((body as Record<string, unknown>).telefone, 30) ?? "";
      const telefoneNorm = telefoneRaw.replace(/\D/g, "");
      const respostas = ((body as Record<string, unknown>).respostas ?? {}) as Record<string, unknown>;
      const unidadeSel = (body as Record<string, unknown>).unidade_id;

      if (!nome || nome.length < 2) return json({ error: "Nome obrigatório" }, 400);
      if (!telefoneNorm || telefoneNorm.length < 10) {
        return json({ error: "Telefone inválido" }, 400);
      }

      let unidadeEscolhida: string | null = null;
      if (typeof unidadeSel === "string" && UUID_RE.test(unidadeSel)) {
        const { data: uni } = await supabase
          .from("unidades")
          .select("id")
          .eq("id", unidadeSel)
          .eq("ativo", true)
          .maybeSingle();
        unidadeEscolhida = uni?.id ?? null;
      }


      // Search by normalized phone (still need filtered query, not full table scan).
      // Compare by normalized form server-side after a narrowed lookup.
      const { data: candidates } = await supabase
        .from("leads")
        .select("id, telefone, unidade_id, ativo, created_at")
        .ilike("telefone", `%${telefoneNorm.slice(-9)}%`)
        .order("ativo", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);

      const mesmoTelefone = (candidates ?? []).filter(
        (l) => (l.telefone ?? "").replace(/\D/g, "") === telefoneNorm,
      );
      // Duplicidade é checada por unidade: prioriza o lead da unidade escolhida.
      const lead = unidadeEscolhida
        ? mesmoTelefone.find((l) => l.unidade_id === unidadeEscolhida)
        : mesmoTelefone[0];


      let foundLeadId: string;
      let foundUnidadeId: string;

      if (lead) {
        foundLeadId = lead.id;
        foundUnidadeId = lead.unidade_id;
        if (!lead.ativo) {
          await supabase.from("leads").update({ ativo: true }).eq("id", foundLeadId);
        }
      } else {
        const { data: novo, error: cErr } = await supabase
          .from("leads")
          .insert({
            nome,
            telefone: telefoneRaw,
            origem: "WHATSAPP",
            status_funil: "novo",
            cadastrado_por: "FORMULARIO_PUBLICO",
            ...(unidadeEscolhida ? { unidade_id: unidadeEscolhida } : {}),
          })
          .select("id, unidade_id")
          .single();
        if (cErr || !novo) {
          console.error("[anamnese-publica] criar lead", cErr);
          return json({ error: "Falha ao criar lead" }, 500);
        }
        foundLeadId = novo.id;
        foundUnidadeId = novo.unidade_id;
      }

      const payload = {
        lead_id: foundLeadId,
        unidade_id: foundUnidadeId,
        nome,
        data_nascimento: extractDateOnly(respostas.data_nascimento),
        objetivo: sanitize(respostas.objetivo),
        historico: sanitize(respostas.historico),
        frequencia_atual: sanitize(respostas.frequencia_atual),
        obstaculo: sanitize(respostas.obstaculo),
        dias_semana: sanitize(respostas.dias_semana),
        preferencia_horario: Array.isArray(respostas.preferencia_horario)
          ? (respostas.preferencia_horario as unknown[])
              .filter((v) => typeof v === "string")
              .slice(0, 20)
          : [],
        tem_condicao_saude:
          typeof respostas.tem_condicao_saude === "boolean"
            ? respostas.tem_condicao_saude
            : null,
        condicao_saude_descricao: sanitize(respostas.condicao_saude_descricao),
        tem_lesao:
          typeof respostas.tem_lesao === "boolean" ? respostas.tem_lesao : null,
        lesao_descricao: sanitize(respostas.lesao_descricao),
        observacoes: sanitize(respostas.observacoes),
        preenchido_por: null,
      };

      const { data: saved, error: sErr } = await supabase
        .from("anamneses_experimental")
        .upsert(payload, { onConflict: "lead_id" })
        .select("id")
        .single();
      if (sErr) {
        console.error("[anamnese-publica] submit error", sErr);
        return json({ error: "Falha ao salvar" }, 500);
      }

      supabase.functions
        .invoke("notify-anamnese-experimental", { body: { anamnese_id: saved.id }, headers: { "x-cron-secret": Deno.env.get("BACKUP_CRON_SECRET") ?? "" } })
        .catch((e) => console.warn("[anamnese-publica] notify falhou", e));

      return json({ ok: true, lead_id: foundLeadId, created: !lead });
    }

    // ===================================================================
    // AUTHENTICATED (CRM only): full anamnese record by lead_id.
    // Requires JWT + admin/user role + access to the lead's unidade.
    // ===================================================================
    if (action === "get_full") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return json({ error: "Não autenticado" }, 401);
      }
      const token = authHeader.replace("Bearer ", "");
      const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await authClient.auth.getUser(token);
      if (userErr || !userData?.user) {
        return json({ error: "Não autenticado" }, 401);
      }
      const userId = userData.user.id;

      const { data: isAdminData } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      const isAdmin = !!isAdminData;
      let isAuthorized = isAdmin;
      if (!isAdmin) {
        const { data: isUserRole } = await supabase.rpc("has_role", {
          _user_id: userId,
          _role: "user",
        });
        if (!isUserRole) {
          const { data: isCoord } = await supabase.rpc("has_role", {
            _user_id: userId,
            _role: "coordenador",
          });
          isAuthorized = !!isCoord;
        } else {
          isAuthorized = true;
        }
      }
      if (!isAuthorized) return json({ error: "Sem permissão" }, 403);

      const leadId = (body as Record<string, unknown>).lead_id;
      if (typeof leadId !== "string" || !UUID_RE.test(leadId)) {
        return json({ error: "Parâmetro inválido" }, 400);
      }

      const { data: lead } = await supabase
        .from("leads")
        .select("id, nome, unidade_id")
        .eq("id", leadId)
        .maybeSingle();
      if (!lead) return json({ error: "Não encontrado" }, 404);

      if (!isAdmin) {
        const { data: unidades } = await supabase.rpc("get_user_unidades", {
          _user_id: userId,
        });
        const allowed = (unidades as string[] | null)?.includes(lead.unidade_id);
        if (!allowed) return json({ error: "Sem acesso à unidade" }, 403);
      }

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

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("[anamnese-publica] erro", e);
    return json({ error: "Erro interno" }, 500);
  }
});
