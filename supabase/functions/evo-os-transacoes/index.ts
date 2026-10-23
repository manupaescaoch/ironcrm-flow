// Recebe do EVO OS as transações bancárias (fonte oficial) e dispara a conciliação.
// Autenticação: header "x-evo-os-key" igual ao secret EVO_OS_TRANSACOES_KEY. Nunca movimenta dinheiro.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { safeEqual } from '../_shared/telegram.ts';
import { reconciliarPendentes } from '../_shared/conciliacaoBancaria.ts';

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Transacao = z.object({
  id: z.string().min(1).max(200),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  valor: z.coerce.number(),
  tipo: z.enum(['debito', 'credito']).optional(),
  unidade_id: z.string().uuid().optional().nullable(),
  unidade: z.string().max(120).optional().nullable(),
  unidade_cnpj: z.string().max(30).optional().nullable(),
  conta_bancaria: z.string().max(120).optional().nullable(),
  descricao: z.string().max(500).optional().nullable(),
  beneficiario: z.string().max(300).optional().nullable(),
  documento: z.string().max(30).optional().nullable(),
  pix_id: z.string().max(200).optional().nullable(),
  autenticacao: z.string().max(300).optional().nullable(),
});
const Body = z.object({ transacoes: z.array(Transacao).min(1).max(1000) });

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/^EVO\s+/, '').trim();
const dig = (s?: string | null) => (s ?? '').replace(/\D/g, '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const chave = Deno.env.get('EVO_OS_TRANSACOES_KEY');
  if (!chave) return json({ error: 'Integração não configurada' }, 500);
  if (!safeEqual(req.headers.get('x-evo-os-key'), chave)) return json({ error: 'Unauthorized' }, 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Payload inválido', detalhes: parsed.error.flatten() }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: unidades } = await admin.from('unidades').select('id, nome, cnpj');
  const resolver = (t: z.infer<typeof Transacao>): string | null => {
    if (t.unidade_id && unidades?.some((u: any) => u.id === t.unidade_id)) return t.unidade_id;
    const cnpj = dig(t.unidade_cnpj);
    if (cnpj) { const u = unidades?.find((x: any) => dig(x.cnpj) === cnpj); if (u) return u.id; }
    if (t.unidade) { const a = norm(t.unidade); const u = unidades?.find((x: any) => norm(x.nome) === a || norm(x.nome).includes(a)); if (u) return u.id; }
    return null;
  };

  const linhas = parsed.data.transacoes.map((t) => {
    const valor = Number(t.valor);
    return {
      external_id: t.id,
      unidade_id: resolver(t),
      unidade_origem: t.unidade ?? t.unidade_cnpj ?? t.unidade_id ?? null,
      conta_bancaria: t.conta_bancaria ?? null,
      data: t.data.slice(0, 10),
      valor: Math.abs(valor),
      tipo: t.tipo ?? (valor < 0 ? 'debito' : 'credito'),
      descricao: t.descricao ?? null,
      beneficiario: t.beneficiario ?? null,
      documento: t.documento ?? null,
      pix_id: t.pix_id ?? null,
      autenticacao: t.autenticacao ?? null,
      raw: t,
      updated_at: new Date().toISOString(),
    };
  });

  // Idempotente pelo id do EVO OS: reenvios atualizam, nunca duplicam. Não mexe no vínculo de conciliação.
  const { error } = await admin.from('transacoes_bancarias_evo_os').upsert(linhas, { onConflict: 'external_id' });
  if (error) { console.error('[evo-os-transacoes]', error); return json({ error: 'Falha ao gravar transações' }, 500); }

  const semUnidade = linhas.filter((l) => !l.unidade_id).length;
  const ids = [...new Set(linhas.map((l) => l.unidade_id).filter(Boolean))] as string[];
  const desde = linhas.map((l) => l.data).sort()[0];
  const conc = await reconciliarPendentes(admin, ids, desde);

  return json({ ok: true, recebidas: linhas.length, sem_unidade: semUnidade, ...conc });
});
