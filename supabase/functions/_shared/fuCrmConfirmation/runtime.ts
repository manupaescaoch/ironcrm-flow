// Candidate only; no secrets are set and no endpoint is deployed.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createPilotHandler } from './pilotHandler.ts';
export function runtime(family: 'internal' | 'commercial') {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) throw new Error('Configuração ausente');
  const verifier = createClient(url, anon);
  const admin = createClient(url, service);
  return createPilotHandler(family, {
    actor: async jwt => {
      const { data, error } = await verifier.auth.getClaims(jwt);
      return !error && typeof data?.claims?.sub === 'string' ? data.claims.sub : null;
    },
    rpc: async (name, args) => {
      const { data, error } = await admin.rpc(name, args);
      return { data, error };
    },
  }, () => ({ enabled: Deno.env.get('FU_CRM_CONFIRMATION_ENABLED'), testUsers: Deno.env.get('FU_CRM_CONFIRMATION_TEST_USERS') }));
}