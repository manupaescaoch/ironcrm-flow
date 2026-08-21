import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_lead",
  title: "Detalhes do lead",
  description:
    "Retorna os dados completos de um lead (por id ou telefone) junto com o histórico de interações e agendamentos.",
  inputSchema: {
    lead_id: z.string().uuid().optional().describe("Id do lead."),
    telefone: z.string().trim().min(8).optional().describe("Telefone do lead, com ou sem máscara."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, telefone }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    if (!lead_id && !telefone) {
      return { content: [{ type: "text", text: "Informe lead_id ou telefone." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    let leadQuery = supabase.from("leads").select("*").limit(1);
    if (lead_id) {
      leadQuery = leadQuery.eq("id", lead_id);
    } else {
      const digits = (telefone ?? "").replace(/\D/g, "");
      leadQuery = leadQuery.ilike("telefone_normalizado", `%${digits}%`);
    }

    const { data: leads, error } = await leadQuery;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const lead = leads?.[0];
    if (!lead) return { content: [{ type: "text", text: "Lead não encontrado." }], isError: true };

    const { data: interacoes, error: interError } = await supabase
      .from("interacoes")
      .select("*")
      .eq("lead_id", lead.id)
      .order("data_interacao", { ascending: false })
      .limit(50);
    if (interError) return { content: [{ type: "text", text: interError.message }], isError: true };

    const payload = { lead, interacoes: interacoes ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
