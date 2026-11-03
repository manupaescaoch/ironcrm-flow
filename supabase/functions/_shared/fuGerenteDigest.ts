import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

/** Legacy G+7/G+30 broadcasts retired by approval on 2026-11-03.
 * Keep the caller/response contract without reading or mutating historical FU,
 * reserving sends, observing candidates or contacting any transport.
 * Individual M+15/M+30 reminders remain in fuGerencialDigest.ts.
 */
export async function sendManagerFuDigest(_admin: SupabaseClient, _dryRun = false, _now = new Date()) {
  return { success: true, skipped: 'resumo_gerencial_legado_desativado', results: [] };
}