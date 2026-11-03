import { sendManagerFuDigest } from './fuGerenteDigest.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

for (const dryRun of [false, true]) {
  Deno.test(`Legacy G+7/G+30 disabled without queries, historical writes or sends (dryRun=${dryRun})`, async () => {
    const admin = new Proxy({}, { get() { throw new Error('Retired digest must not access the database'); } }) as SupabaseClient;
    const result = await sendManagerFuDigest(admin, dryRun, new Date('2026-11-03T11:00:00Z'));
    if (result.success !== true || result.skipped !== 'resumo_gerencial_legado_desativado' || result.results.length !== 0) {
      throw new Error('Legacy emission is not disabled');
    }
  });
}