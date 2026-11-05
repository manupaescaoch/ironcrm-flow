// CANDIDATO — não implantado. Substituiria supabase/functions/_shared/cronAuth.ts.
// Mantém authorizeCronOnly/authorizeCronOrJwt (compatibilidade) e adiciona
// authorizeCronOrRole: JWT comum só passa se o usuário tiver um dos papéis exigidos
// em public.user_roles (validado no servidor via has_role).

export interface AuthResult {
  ok: boolean;
  method?: 'cron' | 'jwt';
  userId?: string;
  status?: number;
  error?: string;
}

type Env = (k: string) => string | undefined;
type RoleCheck = (userId: string, role: string) => Promise<boolean>;
type ClaimsCheck = (token: string) => Promise<string | null>;

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function cronSecrets(env: Env): string[] {
  return [env('CRON_JOB_SECRET'), env('BACKUP_CRON_SECRET')]
    .filter((s): s is string => !!s && s.length >= 16);
}

export function authorizeCronOnlyWith(req: Request, env: Env): AuthResult {
  const secrets = cronSecrets(env);
  if (secrets.length === 0) return { ok: false, status: 500, error: 'Server misconfigured: cron secret unset' };
  const h = req.headers.get('x-cron-secret');
  if (h && secrets.some((s) => constantTimeEqual(h, s))) return { ok: true, method: 'cron' };
  return { ok: false, status: 401, error: 'Unauthorized' };
}

export async function authorizeCronOrRoleWith(
  req: Request,
  roles: string[],
  deps: { env: Env; claims: ClaimsCheck; hasRole: RoleCheck },
): Promise<AuthResult> {
  const cron = authorizeCronOnlyWith(req, deps.env);
  if (cron.ok || cron.status === 500) return cron;
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return { ok: false, status: 401, error: 'Unauthorized' };
  const userId = await deps.claims(auth.slice(7)).catch(() => null);
  if (!userId) return { ok: false, status: 401, error: 'Unauthorized' };
  for (const r of roles) {
    if (await deps.hasRole(userId, r).catch(() => false)) return { ok: true, method: 'jwt', userId };
  }
  return { ok: false, status: 403, error: 'Forbidden' };
}
