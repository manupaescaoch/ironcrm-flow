import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_leads",
  title: "Listar leads",
  description:
    "Lista leads do CRM da unidade informada (ou de todas as unidades permitidas), com filtros por status do funil, busca por nome/telefone e período de cadastro.",
  inputSchema: {
    unidade_id: z.string().uuid().optional().describe("Filtra por unidade. Use list_unidades para obter o id."),
    status_funil: z
      .string()
      .optional()
      .describe("Status do funil, ex.: novo, em_negociacao, aula_agendada, matriculado, perdido."),
    search: z.string().trim().min(2).optional().describe("Busca por nome, e-mail ou telefone."),
    dias: z.number().int().min(1).max(365).optional().describe("Somente leads cadastrados nos últimos N dias."),
    apenas_ativos: z.boolean().optional().describe("Se true (padrão), ignora leads inativos."),
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de registros (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ unidade_id, status_funil, search, dias, apenas_ativos, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("leads")
      .select(
        "id, nome, telefone, email, origem, status_funil, unidade_id, plano_escolhido, data_aula_experimental, hora_aula_experimental, is_matriculado, ativo, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);

    if (unidade_id) query = query.eq("unidade_id", unidade_id);
    if (status_funil) query = query.eq("status_funil", status_funil);
    if (apenas_ativos !== false) query = query.eq("ativo", true);
    if (dias) {
      const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", desde);
    }
    if (search) {
      const digits = search.replace(/\D/g, "");
      const termo = `%${search}%`;
      const filtros = [`nome.ilike.${termo}`, `email.ilike.${termo}`, `telefone.ilike.${termo}`];
      if (digits.length >= 4) filtros.push(`telefone_normalizado.ilike.%${digits}%`);
      query = query.or(filtros.join(","));
    }

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify({ total: data?.length ?? 0, leads: data ?? [] }) }],
      structuredContent: { total: data?.length ?? 0, leads: data ?? [] },
    };
  },
});
