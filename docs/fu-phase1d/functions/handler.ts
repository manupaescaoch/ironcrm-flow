import { z } from 'npm:zod@3.25.76';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
const common = { lead_id: z.string().uuid(), unidade_id: z.string().uuid(), etapa: z.string().min(1).max(10) };
const internal = z.object({ ...common, task_id: z.string().uuid(), matricula_id: z.string().uuid() }).strict();
const commercial = z.object({ ...common, follow_up_id: z.string().uuid() }).strict();
export type Dependencies = { actor: (jwt: string) => Promise<string | null>; rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }> };
export function createHandler(family: 'internal' | 'commercial', deps: Dependencies) {
  return async (req: Request) => {
    const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return reply({ error: 'Método inválido' }, 405);
    try {
      const authorization = req.headers.get('authorization');
      if (!authorization?.startsWith('Bearer ')) return reply({ error: 'Não autorizado' }, 401);
      const actor = await deps.actor(authorization.slice(7));
      if (!actor) return reply({ error: 'Não autorizado' }, 401);
      const body: unknown = await req.json().catch(() => null);
      const parsed = (family === 'internal' ? internal : commercial).safeParse(body);
      if (!parsed.success) return reply({ error: 'Seleção inválida' }, 400);
      const b = parsed.data;
      const result = await deps.rpc(family === 'internal' ? 'fu_crm_confirmar_envio' : 'fu_comercial_confirmar_transacional', {
        p_actor: actor, p_lead: b.lead_id, p_unidade: b.unidade_id, p_etapa: b.etapa,
        ...('task_id' in b ? { p_task: b.task_id, p_matricula: b.matricula_id } : { p_fu: b.follow_up_id }),
      });
      if (result.error) return reply({ error: result.error.code === '42501' ? 'Perfil ou unidade não autorizado' : 'Confirmação não verificada' }, result.error.code === '42501' ? 403 : ['22023', 'P0002'].includes(result.error.code ?? '') ? 409 : 500);
      if (!result.data) return reply({ error: 'Confirmação não verificada' }, 500);
      return reply(result.data);
    } catch { return reply({ error: 'Confirmação não verificada. Consulte o estado antes de tentar novamente.' }, 500); }
  };
}
