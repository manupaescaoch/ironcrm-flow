// Candidate only; not under supabase/functions, never auto deployed.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHandler } from './handler.ts';
export function runtime(family: 'internal' | 'commercial') {
  const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY'); const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) throw new Error('Configuração ausente');
  const verifier = createClient(url, anon); const admin = createClient(url, service);
  return createHandler(family, {
    actor: async jwt => { const { data, error } = await verifier.auth.getClaims(jwt); return !error && typeof data?.claims?.sub === 'string' ? data.claims.sub : null; },
    rpc: async (name, args) => { const { data, error } = await admin.rpc(name, args); return { data, error }; },
  });
}
