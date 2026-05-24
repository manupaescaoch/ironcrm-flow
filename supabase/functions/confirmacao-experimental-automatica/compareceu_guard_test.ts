// Testes da guarda "nunca enviar para lead com compareceu=true"
//
// Estratégia: cria um mock minimalista do cliente Supabase em memória e
// reimplanta a MESMA lógica de duas guardas (pré-filtro em lote + recheck per-lead)
// que existe em index.ts. Garante que a lógica de bloqueio se comporta como esperado
// e serve como spec executável que protege contra regressões futuras.
//
// Se index.ts for alterado de forma que afrouxe a guarda, este teste DEVE ser
// atualizado em sincronia (e o revisor precisa estar consciente disso).
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

type Interacao = { lead_id: string; compareceu: boolean };
type Lead = { id: string };

function makeMockSupabase(opts: { leads: Lead[]; interacoes: Interacao[] }) {
  const sent: string[] = []; // lead_ids para os quais o envio foi liberado
  const interacoesRef = { current: opts.interacoes };

  // Mock chainable para a query: from('interacoes').select(...).in('lead_id', ids).eq('compareceu', true)
  // e from('interacoes').select(...,{head:true,count:'exact'}).eq('lead_id', x).eq('compareceu', true)
  function fromInteracoes() {
    let leadFilter: { type: 'in' | 'eq'; value: string | string[] } | null = null;
    let head = false;

    const builder = {
      select(_cols: string, options?: { head?: boolean; count?: string }) {
        head = options?.head ?? false;
        return builder;
      },
      in(_col: string, value: string[]) {
        leadFilter = { type: 'in', value };
        return builder;
      },
      eq(col: string, value: string | boolean) {
        if (col === 'lead_id') leadFilter = { type: 'eq', value: value as string };
        return builder;
      },
      then(resolve: (r: { data: Interacao[] | null; count: number | null; error: null }) => void) {
        const ids = leadFilter?.type === 'in' ? (leadFilter.value as string[]) : leadFilter?.type === 'eq' ? [leadFilter.value as string] : [];
        const matching = interacoesRef.current.filter((i) => ids.includes(i.lead_id) && i.compareceu === true);
        if (head) resolve({ data: null, count: matching.length, error: null });
        else resolve({ data: matching, count: null, error: null });
      },
    };
    return builder;
  }

  return {
    from(table: string) {
      if (table === 'interacoes') return fromInteracoes();
      throw new Error(`mock não suporta tabela ${table}`);
    },
    sent,
    setInteracoes(novas: Interacao[]) {
      interacoesRef.current = novas;
    },
  };
}

// Reimplementação fiel das DUAS guardas presentes em index.ts.
// Toda alteração no index.ts deve refletir aqui.
async function processarLeads(supabase: ReturnType<typeof makeMockSupabase>, leads: Lead[]) {
  // GUARDA 1: pré-filtro em lote
  const leadIds = leads.map((l) => l.id);
  const { data: interacoesCompareceu } = await supabase
    .from('interacoes')
    .select('lead_id')
    .in('lead_id', leadIds)
    .eq('compareceu', true);
  const leadsJaCompareceram = new Set((interacoesCompareceu || []).map((i) => i.lead_id));

  for (const lead of leads) {
    if (leadsJaCompareceram.has(lead.id)) continue;

    // GUARDA 2: recheck per-lead
    const { count } = await supabase
      .from('interacoes')
      .select('id', { count: 'exact', head: true })
      .eq('lead_id', lead.id)
      .eq('compareceu', true);

    if ((count ?? 0) > 0) continue;

    // Se chegou aqui, o envio seria liberado
    supabase.sent.push(lead.id);
  }
}

Deno.test('GUARDA 1: bloqueia lead com compareceu=true no pré-filtro em lote', async () => {
  const compareceu = { id: 'lead-compareceu' };
  const ok = { id: 'lead-ok' };
  const supabase = makeMockSupabase({
    leads: [compareceu, ok],
    interacoes: [{ lead_id: compareceu.id, compareceu: true }],
  });

  await processarLeads(supabase, [compareceu, ok]);

  assertEquals(supabase.sent, ['lead-ok'], 'apenas lead-ok deve ser liberado');
});

Deno.test('GUARDA 2: recheck per-lead bloqueia race condition após pré-filtro', async () => {
  const lead = { id: 'lead-race' };
  // Pré-filtro vê SEM compareceu
  const supabase = makeMockSupabase({
    leads: [lead],
    interacoes: [],
  });

  // Mas, logo após o pré-filtro, alguém marca compareceu=true
  // Simulamos sobrescrevendo as interações antes do recheck:
  const origFrom = supabase.from.bind(supabase);
  let calls = 0;
  supabase.from = (table: string) => {
    calls++;
    if (calls === 2) {
      // segunda chamada = recheck per-lead
      supabase.setInteracoes([{ lead_id: lead.id, compareceu: true }]);
    }
    return origFrom(table);
  };

  await processarLeads(supabase, [lead]);

  assertEquals(supabase.sent, [], 'recheck deve bloquear o envio');
});

Deno.test('Lead sem nenhuma interação compareceu=true é liberado', async () => {
  const lead = { id: 'lead-novo' };
  const supabase = makeMockSupabase({
    leads: [lead],
    interacoes: [{ lead_id: lead.id, compareceu: false }], // existe interação, mas sem compareceu
  });

  await processarLeads(supabase, [lead]);

  assertEquals(supabase.sent, ['lead-novo']);
});

Deno.test('Múltiplos leads: só bloqueia os com compareceu=true', async () => {
  const a = { id: 'A' };
  const b = { id: 'B' };
  const c = { id: 'C' };
  const supabase = makeMockSupabase({
    leads: [a, b, c],
    interacoes: [
      { lead_id: 'A', compareceu: true },
      { lead_id: 'C', compareceu: true },
    ],
  });

  await processarLeads(supabase, [a, b, c]);

  assertEquals(supabase.sent, ['B'], 'apenas B (que não compareceu) deve ser liberado');
});

Deno.test('Lead com várias interações, ao menos uma compareceu=true → bloqueado', async () => {
  const lead = { id: 'multi' };
  const supabase = makeMockSupabase({
    leads: [lead],
    interacoes: [
      { lead_id: lead.id, compareceu: false },
      { lead_id: lead.id, compareceu: false },
      { lead_id: lead.id, compareceu: true }, // basta uma
    ],
  });

  await processarLeads(supabase, [lead]);

  assertEquals(supabase.sent, []);
});

// ---------- Sanity check: o código em index.ts contém as DUAS guardas ----------
Deno.test('sanity: index.ts contém pré-filtro em lote e recheck per-lead', async () => {
  const src = await Deno.readTextFile(new URL('./index.ts', import.meta.url));
  // Pré-filtro
  assertEquals(src.includes("leadsJaCompareceram"), true, 'pré-filtro em lote ausente');
  assertEquals(src.includes(".in('lead_id', leadIds)"), true, 'select em lote ausente');
  // Recheck
  assertEquals(src.includes('recheck'), true, 'recheck per-lead ausente (comentário)');
  assertEquals(src.includes("count: 'exact'"), true, 'count exact ausente');
  // Bloqueios explícitos
  assertEquals(src.includes('BLOQUEADO (pré-filtro'), true, 'log de bloqueio pré-filtro ausente');
  assertEquals(src.includes('BLOQUEADO (recheck'), true, 'log de bloqueio recheck ausente');
});
