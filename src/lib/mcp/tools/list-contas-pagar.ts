import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_contas_pagar",
  title: "Listar contas a pagar",
  description:
    "Lista as contas a pagar de uma unidade, com filtro por status (pendente, pago, cancelado) e por intervalo de vencimento.",
  inputSchema: {
    unidade_id: z.string().uuid().optional().describe("Filtra por unidade. Use list_unidades."),
    status: z.string().optional().describe("Status da conta, ex.: pendente, pago, cancelado."),
    vencimento_de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Vencimento inicial (YYYY-MM-DD)."),
    vencimento_ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Vencimento final (YYYY-MM-DD)."),
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de registros (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ unidade_id, status, vencimento_de, vencimento_ate, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("contas_pagar")
      .select(
        "id, descricao, valor, data_vencimento, status, unidade_id, fornecedor, categoria, valor_pago, data_pagamento",
      )
      .is("deleted_at", null)
      .order("data_vencimento", { ascending: true })
      .limit(limit ?? 50);

    if (unidade_id) query = query.eq("unidade_id", unidade_id);
    if (status) query = query.eq("status", status);
    if (vencimento_de) query = query.gte("data_vencimento", vencimento_de);
    if (vencimento_ate) query = query.lte("data_vencimento", vencimento_ate);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const total = (data ?? []).reduce((acc, c) => acc + Number(c.valor ?? 0), 0);
    const payload = { quantidade: data?.length ?? 0, valor_total: total, contas: data ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
