// Isolated candidate. No deployable directory is created by Phase 1F preparation.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createHandler, type Dependencies } from './handler.ts';
import { pilotAllows, type PilotConfig } from './pilotPolicy.ts';
export function createPilotHandler(family: 'internal' | 'commercial', deps: Dependencies, config: () => PilotConfig) {
  return async (req: Request): Promise<Response> => {
    const reject = (status: number) => new Response(JSON.stringify({ error: status === 401 ? 'Não autorizado' : 'Confirmação não liberada para esta conta' }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    // CORS/method checks do not invoke SQL and are retained from the approved handler.
    if (req.method !== 'POST') return createHandler(family, deps)(req);
    const authorization = req.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return reject(401);
    let actor: string | null;
    try { actor = await deps.actor(authorization.slice(7)); } catch { return reject(401); }
    if (!actor) return reject(401);
    let allowed = false;
    try { allowed = pilotAllows(config(), actor); } catch { /* Configuration errors fail closed. */ }
    if (!allowed) return reject(403);
    // JWT is verified once per request; identity remains request-local and unforgeable by body.
    return createHandler(family, { ...deps, actor: async () => actor })(req);
  };
}