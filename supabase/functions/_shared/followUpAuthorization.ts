import { createClient } from 'npm:@supabase/supabase-js@2';
import { authorizeCronOnly } from './cronAuth.ts';

export class FollowUpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type FollowUpOperation = 'send' | 'generate' | 'reagendar';
export interface FollowUpScope {
  automatic: boolean;
  userId?: string;
  caller: string;
  units: string[] | null;
}
export function permittedScope(operation: FollowUpOperation, roles: string[], units: string[], requested?: string | null): string[] | null {
  const allowed = operation === 'send' ? ['admin', 'user'] : ['admin', 'user', 'moderator', 'coordenador', 'gerente'];
  if (!roles.some(role => allowed.includes(role))) throw new FollowUpError(403, 'Perfil sem permissão para esta operação');
  // Global execution is explicitly allowed only for admins and trusted automation.
  if (roles.includes('admin')) return requested ? [requested] : null;
  if (requested && !units.includes(requested)) throw new FollowUpError(403, 'Unidade não autorizada');
  if (!units.length) throw new FollowUpError(403, 'Nenhuma unidade autorizada');
  return requested ? [requested] : units;
}

export async function authorizeFollowUp(req: Request, operation: FollowUpOperation, requested?: string | null, injectedClient?: any): Promise<FollowUpScope> {
  if (authorizeCronOnly(req).ok) return { automatic: true, caller: 'SISTEMA', units: requested ? [requested] : null };
  const header = req.headers.get('Authorization');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  // Existing health-check uses the actual server service credential, never a decoded role claim.
  if (serviceKey && header === `Bearer ${serviceKey}`) return { automatic: true, caller: 'SISTEMA', units: requested ? [requested] : null };
  if (!header?.startsWith('Bearer ')) throw new FollowUpError(401, 'Autenticação obrigatória');
  const token = header.slice(7);
  const client = injectedClient ?? createClient(
    Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: header } } },
  );
  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims?.sub || data.claims.role !== 'authenticated') throw new FollowUpError(401, 'Autenticação inválida');
  const userId = data.claims.sub;
  const [rolesResult, unitsResult] = await Promise.all([
    client.from('user_roles').select('role').eq('user_id', userId),
    client.from('user_unidades').select('unidade_id').eq('user_id', userId),
  ]);
  if (rolesResult.error || unitsResult.error) throw new FollowUpError(403, 'Não foi possível validar permissões');
  return {
    automatic: false, userId, caller: String(data.claims.email ?? userId).split('@')[0].toUpperCase(),
    units: permittedScope(operation, (rolesResult.data ?? []).map((r: any) => r.role), (unitsResult.data ?? []).map((r: any) => r.unidade_id), requested),
  };
}

export function assertUnit(scope: FollowUpScope, unit: string) {
  if (scope.units && !scope.units.includes(unit)) throw new FollowUpError(404, 'Recurso indisponível');
}