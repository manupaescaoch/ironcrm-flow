import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const CATEGORIAS = [
  "Aluguel", "Condomínio", "Água", "Energia", "Internet", "Telefone", "Impostos", "Encargos",
  "Folha de pagamento", "Manutenção", "Marketing", "Equipamentos", "Materiais",
  "Serviços terceirizados", "Financiamentos", "Outros",
];

const ns = { type: ["string", "null"] };
const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "tipo_documento", "fornecedor", "cpf_cnpj", "descricao", "valor", "data_emissao", "data_vencimento",
    "numero_documento", "linha_digitavel", "codigo_barras", "codigo_pix", "chave_pix", "categoria", "parcelas",
  ],
  properties: {
    tipo_documento: { type: ["string", "null"], enum: ["nota_fiscal", "cupom_fiscal", "boleto", "outro", null] },
    fornecedor: ns,
    cpf_cnpj: ns,
    descricao: ns,
    valor: { type: ["number", "null"] },
    data_emissao: ns,
    data_vencimento: ns,
    numero_documento: ns,
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

const PROMPT = `Você lê documentos fiscais brasileiros (nota fiscal, cupom fiscal, boleto) para cadastrar uma conta a pagar.
Extraia SOMENTE o que está escrito no documento. Se um dado não aparece, devolva null. Nunca invente nem estime.
- fornecedor: razão social/nome do emitente ou beneficiário (quem recebe o pagamento).
- cpf_cnpj: CPF ou CNPJ do fornecedor, como impresso.
- descricao: resumo curto do que foi comprado/cobrado (ex.: "ENERGIA OUTUBRO/2026"), baseado no documento.
- valor: valor total a pagar em reais (número com ponto decimal).
- datas no formato AAAA-MM-DD. data_vencimento só se estiver impressa.
- numero_documento: número da nota, cupom ou boleto (nosso número/nº documento).
- linha_digitavel: linha digitável do boleto exatamente como impressa. codigo_barras: 44 dígitos se legível.
- codigo_pix: payload "Pix copia e cola" completo (começa com 000201), sem alterar caracteres. chave_pix se impressa.
- categoria: escolha a mais adequada da lista; use "Outros" se nenhuma servir.
- parcelas: só se o documento listar parcelas/duplicatas com valores e vencimentos; caso contrário, lista vazia.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: claims, error: authErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (authErr || !claims?.claims?.sub) return json({ error: "Não autorizado" }, 401);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "Leitura de documentos não configurada." }, 500);

  let body: { file_base64?: string; mime_type?: string; file_name?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Requisição inválida." }, 400);
  }
  const { file_base64, mime_type, file_name } = body;
  if (!file_base64 || !mime_type) return json({ error: "Envie o documento." }, 400);
  if (!["application/pdf", "image/jpeg", "image/png"].includes(mime_type)) {
    return json({ error: "Formato não aceito. Use PDF, JPG ou PNG." }, 400);
  }

  const media =
    mime_type === "application/pdf"
      ? { type: "input_file", filename: file_name || "documento.pdf", file_data: `data:application/pdf;base64,${file_base64}` }
      : { type: "input_image", image_url: `data:${mime_type};base64,${file_base64}` };

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
    return json({ error: msg }, resp.status >= 500 ? 502 : resp.status);
  }

  // Consome o stream SSE e junta o texto final
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";
  let finalText = "";
  let refused = false;
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
        else if (ev.type === "error" || ev.type === "response.failed") {
          console.error("AI stream error", data.slice(0, 500));
        }
      } catch { /* ignora linha parcial */ }
    }
  }
  const text = finalText || out;
  if (refused || !text) return json({ error: "Não foi possível ler o documento. Preencha os dados manualmente." }, 422);
  try {
    return json({ dados: JSON.parse(text) });
  } catch {
    return json({ error: "Não foi possível ler o documento. Preencha os dados manualmente." }, 422);
  }
});
