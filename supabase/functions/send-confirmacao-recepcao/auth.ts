import { createClient } from 'npm:@supabase/supabase-js@2';
import { authorizeCronOnly, type AuthResult } from '../_shared/cronAuth.ts';
/** Explicit privileged entrypoint: common JWTs can never substitute automation. */
export async function authorizeCronOrRole(req: Request, roles: string[] = ['admin']): Promise<AuthResult> {
  const cron = authorizeCronOnly(req);
  if (cron.ok) return cron;
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return cron;
  try {
    const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data, error } = await client.auth.getClaims(authHeader.slice(7));
    if (error || !data?.claims?.sub || data.claims.role !== 'authenticated') return { ok:false,status:401,error:'Unauthorized' };
    const userId = data.claims.sub;
    for (const role of roles) {
      const result = await client.rpc('has_role', { _user_id:userId, _role:role });
      if (!result.error && result.data === true) return { ok:true,method:'jwt',userId };
    }
    return { ok:false,status:403,error:'Forbidden' };
  } catch { return { ok:false,status:401,error:'Unauthorized' }; }
}
