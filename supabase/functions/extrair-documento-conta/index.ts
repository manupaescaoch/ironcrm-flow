import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extrairDocumentoConta } from "../_shared/extrairDocumentoConta.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: claims, error: authErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (authErr || !claims?.claims?.sub) return json({ error: "Não autorizado" }, 401);

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

  const r = await extrairDocumentoConta({ base64: file_base64, mimeType: mime_type, fileName: file_name });
  if (!r.ok) return json({ error: r.error }, r.status);
  return json({ dados: r.dados });
});
