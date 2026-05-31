import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: require authenticated user (prevents AI credit abuse).
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { image_base64, unidade_id, unidade_nome } = await req.json();

    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: "image_base64 é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um extrator de dados de tabelas de escala de trabalho. 
Analise a imagem da tabela e extraia os dados em formato JSON.

A tabela contém escalas de final de semana com as colunas:
- final_de_semana: formato "DD E DD" (ex: "07 E 08", "14 E 15")
- treinador: nome do treinador escalado
- recepcao: nome da pessoa na recepção
- servicos_gerais: nome da pessoa de serviços gerais
- seguranca: nome do segurança

Retorne APENAS um JSON válido com a seguinte estrutura, sem texto adicional:
{
  "registros": [
    {
      "final_de_semana": "07 E 08",
      "treinador": "NOME",
      "recepcao": "NOME",
      "servicos_gerais": "NOME",
      "seguranca": "NOME"
    }
  ]
}

Regras:
- Todos os nomes devem estar em MAIÚSCULAS
- Se um campo estiver vazio ou ilegível, use string vazia ""
- O formato do final_de_semana deve ser "DD E DD"
- Extraia TODOS os registros visíveis na tabela
- Ignore cabeçalhos, títulos e informações não relacionadas às escalas`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Extraia os dados da escala desta imagem. Unidade: ${unidade_nome || "não especificada"}.`,
                },
                {
                  type: "image_url",
                  image_url: { url: image_base64 },
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_escala",
                description: "Extrai dados de escala de trabalho de uma imagem de tabela",
                parameters: {
                  type: "object",
                  properties: {
                    registros: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          final_de_semana: { type: "string", description: "Formato DD E DD" },
                          treinador: { type: "string" },
                          recepcao: { type: "string" },
                          servicos_gerais: { type: "string" },
                          seguranca: { type: "string" },
                        },
                        required: ["final_de_semana", "treinador", "recepcao", "servicos_gerais", "seguranca"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["registros"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "extract_escala" } },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar imagem com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    // Extract from tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let registros: any[] = [];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        registros = parsed.registros || [];
      } catch {
        console.error("Failed to parse tool call arguments");
      }
    }

    // Fallback: try to parse from content
    if (registros.length === 0) {
      const content = data.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*"registros"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          registros = parsed.registros || [];
        } catch {
          console.error("Failed to parse content JSON");
        }
      }
    }

    // Add unidade_id to each registro
    const result = registros.map((r: any, i: number) => ({
      ...r,
      unidade_id: unidade_id || null,
      final_de_semana: (r.final_de_semana || "").toUpperCase(),
      treinador: (r.treinador || "").toUpperCase(),
      recepcao: (r.recepcao || "").toUpperCase(),
      servicos_gerais: (r.servicos_gerais || "").toUpperCase(),
      seguranca: (r.seguranca || "").toUpperCase(),
    }));

    return new Response(
      JSON.stringify({ registros: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
