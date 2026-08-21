import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const ORIGENS = [
  "WHATSAPP",
  "INSTAGRAM",
  "TRÁFEGO PAGO",
  "INDICAÇÃO",
  "VISITA PRESENCIAL",
  "TERCEIROS",
  "NÃO INFORMADO",
] as const;

export default defineTool({
  name: "create_lead",
  title: "Cadastrar lead",
  description:
    "Cadastra um novo lead no CRM em uma unidade. Bloqueia telefone duplicado dentro da mesma unidade (o mesmo telefone pode existir em unidades diferentes).",
  inputSchema: {
    nome: z.string().trim().min(3).describe("Nome completo do lead."),
    telefone: z.string().trim().min(8).describe("Telefone com DDD."),
    unidade_id: z.string().uuid().describe("Unidade do cadastro. Use list_unidades."),
    origem: z.enum(ORIGENS).optional().describe("Origem do lead (padrão NÃO INFORMADO)."),
    email: z.string().email().optional(),
    observacoes: z.string().trim().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ nome, telefone, unidade_id, origem, email, observacoes }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const digits = telefone.replace(/\D/g, "");

    const { data: existentes, error: dupError } = await supabase
      .from("leads")
      .select("id, nome, ativo")
      .eq("unidade_id", unidade_id)
      .ilike("telefone_normalizado", `%${digits}%`)
      .limit(1);
    if (dupError) return { content: [{ type: "text", text: dupError.message }], isError: true };
    if (existentes?.length) {
      return {
        content: [
          {
            type: "text",
            text: `Telefone já cadastrado nesta unidade para "${existentes[0].nome}" (id ${existentes[0].id}).`,
          },
        ],
        isError: true,
      };
    }

    const nomeUpper = nome.toUpperCase();
    const { data, error } = await supabase
      .from("leads")
      .insert({
        nome: nomeUpper,
        telefone,
        email: email ?? null,
        unidade_id,
        origem: origem ?? "NÃO INFORMADO",
        observacoes: observacoes ? observacoes.toUpperCase() : null,
        status_funil: "novo",
        ativo: true,
        created_by: ctx.getUserId(),
        cadastrado_por: ctx.getUserEmail() ?? null,
      })
      .select("id, nome, telefone, unidade_id, status_funil, created_at");

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data?.[0] ?? null) }],
      structuredContent: { lead: data?.[0] ?? null },
    };
  },
});
