// Shared authorization helper for automation/cron edge functions.
// Accepts EITHER a valid cron secret header OR a valid Supabase JWT (any authenticated user).
// Fails closed when BACKUP_CRON_SECRET is missing on the server.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface AuthResult {
  ok: boolean;
  method?: 'cron' | 'jwt';
  userId?: string;
  status?: number;
  error?: string;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Allow either a valid cron secret header (X-Cron-Secret) or a valid Supabase JWT.
 * Used for automation functions that may be called by pg_cron OR by authenticated staff.
 */
export async function authorizeCronOrJwt(req: Request): Promise<AuthResult> {
  const cronSecret = Deno.env.get('CRON_JOB_SECRET') || Deno.env.get('BACKUP_CRON_SECRET');
  // Fail closed if server is misconfigured.
  if (!cronSecret || cronSecret.length < 16) {
    return { ok: false, status: 500, error: 'Server misconfigured: cron secret unset' };
  }


  const requestSecret = req.headers.get('x-cron-secret');
  if (requestSecret && constantTimeEqual(requestSecret, cronSecret)) {
    return { ok: true, method: 'cron' };
  }

  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { data, error } = await supabase.auth.getClaims(token);
      if (!error && data?.claims?.sub) {
        return { ok: true, method: 'jwt', userId: data.claims.sub as string };
      }
    } catch {
      // fall through to 401
    }
  }

  return { ok: false, status: 401, error: 'Unauthorized' };
}

/**
 * Strict cron-only: requires the header secret. Use for pure cron-triggered functions
 * with no legitimate frontend caller.
 */
export function authorizeCronOnly(req: Request): AuthResult {
  const cronSecret = Deno.env.get('BACKUP_CRON_SECRET');
  if (!cronSecret || cronSecret.length < 16) {
    return { ok: false, status: 500, error: 'Server misconfigured: cron secret unset' };
  }
  const requestSecret = req.headers.get('x-cron-secret');
  if (!requestSecret || !constantTimeEqual(requestSecret, cronSecret)) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  return { ok: true, method: 'cron' };
}

export const CRON_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
};
