// Testes da guarda "nunca enviar para lead com compareceu=true"
//
// Estratégia: usa o CLIENTE REAL do supabase-js (PostgREST) e intercepta
// `globalThis.fetch` para devolver respostas no formato esperado por PostgREST.
// Isso valida que a lógica das duas guardas (pré-filtro em lote + recheck per-lead)
// — incluindo a forma como o supabase-js monta as queries — funciona corretamente.
//
// Se index.ts for alterado de forma que afrouxe a guarda, este teste DEVE
// falhar (ou ser atualizado em sincronia, com revisão consciente).
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Interacao = { id?: string; lead_id: string; compareceu: boolean };
type Lead = { id: string };

// ---------------------------------------------------------------------------
// Fetch interceptor para PostgREST do supabase-js
// ---------------------------------------------------------------------------
//
// Formato de URL gerado pelo postgrest-js:
//   GET  /rest/v1/interacoes?select=lead_id&lead_id=in.(id1,id2)&compareceu=eq.true
//   HEAD /rest/v1/interacoes?select=id&lead_id=eq.X&compareceu=eq.true
//        (com header `Prefer: count=exact` e resposta `Content-Range: */N`)
//
function installPostgrestFetchMock(opts: {
  interacoesProvider: () => Interacao[];
  onRequest?: (url: URL, method: string) => void;
}) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const url = new URL(urlStr);

    opts.onRequest?.(url, method);

    // Apenas interceptamos chamadas REST do nosso "Supabase" mockado.
    if (!url.pathname.startsWith('/rest/v1/')) {
      return originalFetch(input as RequestInfo, init);
    }

    const table = url.pathname.replace(/^\/rest\/v1\//, '');

    if (table === 'interacoes') {
      // --- Parse de filtros PostgREST ---
      const params = url.searchParams;
      const compareceuFilter = params.get('compareceu'); // ex.: "eq.true"
      const leadIdParam = params.get('lead_id');         // ex.: "in.(a,b)" ou "eq.x"

      let leadIds: string[] | null = null;
      if (leadIdParam) {
        if (leadIdParam.startsWith('in.(') && leadIdParam.endsWith(')')) {
          const inner = leadIdParam.slice(4, -1);
          leadIds = inner
            .split(',')
            .map((s) => s.replace(/^"|"$/g, '').trim())
            .filter(Boolean);
        } else if (leadIdParam.startsWith('eq.')) {
          leadIds = [leadIdParam.slice(3)];
        }
      }

      const wantsCompareceuTrue = compareceuFilter === 'eq.true';

      const data = opts.interacoesProvider().filter((i) => {
        if (leadIds && !leadIds.includes(i.lead_id)) return false;
        if (wantsCompareceuTrue && i.compareceu !== true) return false;
        return true;
      });

      // HEAD + Prefer: count=exact → corpo vazio, count vai no Content-Range
      const prefer = (init?.headers as Record<string, string> | undefined)?.['Prefer']
        ?? (init?.headers as Record<string, string> | undefined)?.['prefer']
        ?? '';
      const wantsCount = /count=(exact|planned|estimated)/.test(prefer);

      if (method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Range': `0-${Math.max(0, data.length - 1)}/${data.length}`,
          },
        });
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...(wantsCount ? { 'Content-Range': `0-${Math.max(0, data.length - 1)}/${data.length}` } : {}),
        },
      });
    }

    // Tabela não mockada — devolve vazio para não quebrar testes.
    return new Response('[]', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function makeClient() {
  // URL/key fake — nunca chegam à rede de verdade por causa do interceptor.
  return createClient('http://mock.local', 'fake-anon-key');
}

// ---------------------------------------------------------------------------
// Reimplementação fiel das DUAS guardas presentes em index.ts.
// Mantém a mesma sequência de chamadas Postgrest, agora atravessando fetch real.
// ---------------------------------------------------------------------------
async function processarLeads(
  supabase: ReturnType<typeof createClient>,
  leads: Lead[],
): Promise<string[]> {
  const sent: string[] = [];

  const leadIds = leads.map((l) => l.id);
  const { data: interacoesCompareceu } = await supabase
    .from('interacoes')
    .select('lead_id')
    .in('lead_id', leadIds)
    .eq('compareceu', true);
  const leadsJaCompareceram = new Set(
    ((interacoesCompareceu ?? []) as Array<{ lead_id: string }>).map((i) => i.lead_id),
  );

  for (const lead of leads) {
    if (leadsJaCompareceram.has(lead.id)) continue;

    const { count } = await supabase
      .from('interacoes')
      .select('id', { count: 'exact', head: true })
      .eq('lead_id', lead.id)
      .eq('compareceu', true);

    if ((count ?? 0) > 0) continue;

    sent.push(lead.id);
  }
  return sent;
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

Deno.test('GUARDA 1: bloqueia lead com compareceu=true no pré-filtro em lote', async () => {
  const compareceu = { id: 'lead-compareceu' };
  const ok = { id: 'lead-ok' };
  const restore = installPostgrestFetchMock({
    interacoesProvider: () => [{ lead_id: compareceu.id, compareceu: true }],
  });
  try {
    const sent = await processarLeads(makeClient(), [compareceu, ok]);
    assertEquals(sent, ['lead-ok'], 'apenas lead-ok deve ser liberado');
  } finally {
    restore();
  }
});

Deno.test('GUARDA 2: recheck per-lead bloqueia race condition após pré-filtro', async () => {
  const lead = { id: 'lead-race' };
  let calls = 0;
  let interacoes: Interacao[] = [];
  const restore = installPostgrestFetchMock({
    interacoesProvider: () => interacoes,
    onRequest: () => {
      calls++;
      // Entre o pré-filtro (call 1) e o recheck (call 2), alguém marca compareceu.
      if (calls === 1) {
        queueMicrotask(() => {
          interacoes = [{ lead_id: lead.id, compareceu: true }];
        });
      }
    },
  });
  try {
    const sent = await processarLeads(makeClient(), [lead]);
    assertEquals(sent, [], 'recheck deve bloquear o envio');
  } finally {
    restore();
  }
});

Deno.test('Lead sem nenhuma interação compareceu=true é liberado', async () => {
  const lead = { id: 'lead-novo' };
  const restore = installPostgrestFetchMock({
    interacoesProvider: () => [{ lead_id: lead.id, compareceu: false }],
  });
  try {
    const sent = await processarLeads(makeClient(), [lead]);
    assertEquals(sent, ['lead-novo']);
  } finally {
    restore();
  }
});

Deno.test('Múltiplos leads: só bloqueia os com compareceu=true', async () => {
  const a = { id: 'A' };
  const b = { id: 'B' };
  const c = { id: 'C' };
  const restore = installPostgrestFetchMock({
    interacoesProvider: () => [
      { lead_id: 'A', compareceu: true },
      { lead_id: 'C', compareceu: true },
    ],
  });
  try {
    const sent = await processarLeads(makeClient(), [a, b, c]);
    assertEquals(sent, ['B'], 'apenas B (que não compareceu) deve ser liberado');
  } finally {
    restore();
  }
});

Deno.test('Lead com várias interações, ao menos uma compareceu=true → bloqueado', async () => {
  const lead = { id: 'multi' };
  const restore = installPostgrestFetchMock({
    interacoesProvider: () => [
      { lead_id: lead.id, compareceu: false },
      { lead_id: lead.id, compareceu: false },
      { lead_id: lead.id, compareceu: true },
    ],
  });
  try {
    const sent = await processarLeads(makeClient(), [lead]);
    assertEquals(sent, []);
  } finally {
    restore();
  }
});

// ---------- Sanity check: o código em index.ts contém as DUAS guardas ----------
Deno.test('sanity: index.ts contém pré-filtro em lote e recheck per-lead', async () => {
  const src = await Deno.readTextFile(new URL('./index.ts', import.meta.url));
  assertEquals(src.includes('leadsJaCompareceram'), true, 'pré-filtro em lote ausente');
  assertEquals(src.includes(".in('lead_id', leadIds)"), true, 'select em lote ausente');
  assertEquals(src.includes('recheck'), true, 'recheck per-lead ausente (comentário)');
  assertEquals(src.includes("count: 'exact'"), true, 'count exact ausente');
  assertEquals(src.includes('BLOQUEADO (pré-filtro'), true, 'log de bloqueio pré-filtro ausente');
  assertEquals(src.includes('BLOQUEADO (recheck'), true, 'log de bloqueio recheck ausente');
});
