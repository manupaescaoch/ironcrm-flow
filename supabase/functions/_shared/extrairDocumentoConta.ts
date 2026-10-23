// Leitura de documentos fiscais (nota, cupom, boleto) por IA. Usado pela importação
// manual (extrair-documento-conta) e pelo recebimento no grupo do Telegram.

export const CATEGORIAS = [
  "Aluguel", "Condomínio", "Água", "Energia", "Internet", "Telefone", "Impostos", "Encargos",
  "Folha de pagamento", "Manutenção", "Marketing", "Equipamentos", "Materiais",
  "Serviços terceirizados", "Financiamentos", "Outros",
];

const ns = { type: ["string", "null"] };
const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "tipo_documento", "fornecedor", "cpf_cnpj", "pagador_nome", "pagador_cnpj", "descricao", "valor",
    "data_emissao", "data_vencimento", "competencia", "numero_documento", "chave_nfe", "linha_digitavel",
    "codigo_barras", "codigo_pix", "chave_pix", "categoria", "parcelas",
  ],
  properties: {
    tipo_documento: { type: ["string", "null"], enum: ["nota_fiscal", "cupom_fiscal", "boleto", "outro", null] },
    fornecedor: ns,
    cpf_cnpj: ns,
    pagador_nome: ns,
    pagador_cnpj: ns,
    descricao: ns,
    valor: { type: ["number", "null"] },
    data_emissao: ns,
    data_vencimento: ns,
    competencia: ns,
    numero_documento: ns,
    chave_nfe: ns,
    linha_digitavel: ns,
    codigo_barras: ns,
    codigo_pix: ns,
    chave_pix: ns,
    categoria: { type: ["string", "null"], enum: [...CATEGORIAS, null] },
    parcelas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["numero", "valor", "vencimento"],
        properties: { numero: { type: ["integer", "null"] }, valor: { type: ["number", "null"] }, vencimento: ns },
      },
    },
  },
};

const PROMPT = `Você lê documentos fiscais brasileiros (nota fiscal, NF-e em XML, cupom fiscal, boleto) para cadastrar uma conta a pagar.
Extraia SOMENTE o que está escrito no documento. Se um dado não aparece, devolva null. Nunca invente nem estime.
- fornecedor: razão social/nome do emitente ou beneficiário (quem RECEBE o pagamento). cpf_cnpj: CPF/CNPJ desse fornecedor.
- pagador_nome / pagador_cnpj: quem PAGA (pagador, sacado, tomador, destinatário). Nunca confunda com o fornecedor.
- descricao: resumo curto do que foi comprado/cobrado (ex.: "ENERGIA OUTUBRO/2026").
- valor: valor total a pagar em reais (número com ponto decimal).
- datas no formato AAAA-MM-DD. data_vencimento só se estiver impressa; nota fiscal sem vencimento = null.
- competencia: mês de referência no formato AAAA-MM, só se aparecer.
- numero_documento: número da nota, cupom ou boleto. chave_nfe: chave de acesso de 44 dígitos (só dígitos).
- linha_digitavel exatamente como impressa. codigo_barras: 44 dígitos se legível.
- codigo_pix: payload "Pix copia e cola" completo (começa com 000201). chave_pix se impressa.
- categoria: a mais adequada da lista; "Outros" se nenhuma servir.
- parcelas: só se o documento listar parcelas/duplicatas com valores e vencimentos; caso contrário, lista vazia.`;

export type ResultadoExtracao =
  | { ok: true; dados: Record<string, any> }
  | { ok: false; status: number; error: string };

export async function extrairDocumentoConta(opts: {
  base64?: string;
  mimeType: string;
  fileName?: string;
  xmlText?: string;
}): Promise<ResultadoExtracao> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return { ok: false, status: 500, error: "Leitura de documentos não configurada." };

  let media: Record<string, unknown>;
  if (opts.xmlText) {
    media = { type: "input_text", text: `Conteúdo do XML da nota:\n${opts.xmlText.slice(0, 60000)}` };
  } else if (opts.mimeType === "application/pdf") {
    media = { type: "input_file", filename: opts.fileName || "documento.pdf", file_data: `data:application/pdf;base64,${opts.base64}` };
  } else {
    media = { type: "input_image", image_url: `data:${opts.mimeType};base64,${opts.base64}` };
  }

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name: "documento_conta", strict: true, schema } },
      input: [{ role: "user", content: [{ type: "input_text", text: PROMPT }, media] }],
    }),
  });

  if (!resp.ok || !resp.body) {
    const txt = await resp.text().catch(() => "");
    console.error("AI gateway error", resp.status, txt.slice(0, 500));
    let msg = "Não foi possível ler o documento. Preencha os dados manualmente.";
    if (resp.status === 429) msg = "Muitas leituras ao mesmo tempo. Aguarde um minuto e tente de novo.";
    if (resp.status === 402) msg = "Os créditos de IA acabaram. Preencha os dados manualmente.";
    return { ok: false, status: resp.status >= 500 ? 502 : resp.status, error: msg };
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", out = "", finalText = "", refused = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
        else if (ev.type === "response.output_text.done") finalText = ev.text ?? "";
        else if (ev.type === "response.refusal.delta" || ev.type === "response.refusal.done") refused = true;
        else if (ev.type === "error" || ev.type === "response.failed") console.error("AI stream error", data.slice(0, 500));
      } catch { /* linha parcial */ }
    }
  }
  const text = finalText || out;
  const falha = { ok: false as const, status: 422, error: "Não foi possível ler o documento. Preencha os dados manualmente." };
  if (refused || !text) return falha;
  try {
    return { ok: true, dados: JSON.parse(text) };
  } catch {
    return falha;
  }
}
