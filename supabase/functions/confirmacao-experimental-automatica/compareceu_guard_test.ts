// Testes da guarda "nunca enviar para lead com compareceu=true"
// Valida o fluxo crítico via mock de fetch para Z-API + mock do PostgREST do Supabase.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const FN_URL = 'http://local-test/confirmacao-experimental-automatica';

// ---------- helpers ----------
function nowPlusHoursIso(h: number): { date: string; time: string } {
  const d = new Date(Date.now() + h * 60 * 60 * 1000);
  // BRT offset (-03:00) — para os testes basta um ISO local sem timezone que a função sabe lidar
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}:00` };
}

type Lead = {
  id: string;
  nome: string;
  telefone: string;
  data_aula_experimental: string;
  hora_aula_experimental: string;
  confirmacao_24h_enviada_em: string | null;
  confirmacao_2h_enviada_em: string | null;
  status_funil: string;
  ativo: boolean;
  is_matriculado: boolean;
};

interface MockState {
  leads: Lead[];
  // lead_ids com pelo menos 1 interação compareceu=true
  compareceram: Set<string>;
  zapiCalls: Array<{ phone: string; message: string }>;
  leadUpdates: Array<{ id: string; patch: Record<string, unknown> }>;
}

function installMocks(state: MockState) {
  Deno.env.set('SUPABASE_URL', 'http://supabase-mock');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'mock-key');
  Deno.env.set('ZAPI_INSTANCE_ID', 'inst');
  Deno.env.set('ZAPI_TOKEN', 'tok');
  Deno.env.set('ZAPI_CLIENT_TOKEN', 'cli');

  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input: Request | URL | string, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();

    // Z-API
    if (url.includes('api.z-api.io')) {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      state.zapiCalls.push({ phone: body.phone, message: body.message });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Supabase REST
    if (url.includes('supabase-mock')) {
      const u = new URL(url);
      // leads SELECT
      if (u.pathname.endsWith('/rest/v1/leads') && method === 'GET') {
        return new Response(JSON.stringify(state.leads), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // leads UPDATE/PATCH
      if (u.pathname.endsWith('/rest/v1/leads') && method === 'PATCH') {
        const patch = init?.body ? JSON.parse(String(init.body)) : {};
        const idFilter = u.searchParams.get('id'); // ex: eq.uuid
        const id = (idFilter || '').replace(/^eq\./, '');
        state.leadUpdates.push({ id, patch });
        return new Response(JSON.stringify([]), { status: 200 });
      }
      // interacoes SELECT (lote OR recheck per-lead)
      if (u.pathname.endsWith('/rest/v1/interacoes') && method === 'GET') {
        const compareceuFilter = u.searchParams.get('compareceu'); // eq.true
        const leadIdParam = u.searchParams.get('lead_id'); // eq.uuid OR in.(a,b,c)
        const prefer = (init?.headers as Record<string, string> | undefined)?.['Prefer'] ?? '';

        const onlyCompareceu = compareceuFilter === 'eq.true';
        let ids: string[] = [];
        if (leadIdParam?.startsWith('in.')) {
          ids = leadIdParam.slice(3).replace(/^\(|\)$/g, '').split(',');
        } else if (leadIdParam?.startsWith('eq.')) {
          ids = [leadIdParam.slice(3)];
        }
        const matching = ids.filter((id) => state.compareceram.has(id));

        // head=true + count=exact → retorna 0 rows mas header content-range
        if (prefer.includes('count=exact') && prefer.includes('head=true')) {
          return new Response(null, {
            status: 200,
            headers: { 'Content-Range': `0-0/${matching.length}` },
          });
        }
        const rows = onlyCompareceu ? matching.map((id) => ({ lead_id: id })) : [];
        return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }

    return realFetch(input as RequestInfo, init);
  };
}

type Handler = (req: Request) => Promise<Response>;
async function importHandler(): Promise<Handler> {
  // Patch Deno.serve para capturar o handler sem realmente abrir socket
  let captured: Handler | null = null;
  const orig = Deno.serve;
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (handler: Handler) => {
    captured = handler;
    return { finished: Promise.resolve(), shutdown: () => Promise.resolve() } as never;
  };
  await import(`./index.ts?ts=${Date.now()}`);
  (Deno as any).serve = orig;
  if (!captured) throw new Error('handler não capturado');
  return captured;
}

function buildLead(overrides: Partial<Lead> = {}): Lead {
  const aula = nowPlusHoursIso(20); // dentro da janela 24h
  return {
    id: crypto.randomUUID(),
    nome: 'Maria Teste',
    telefone: '11999990000',
    data_aula_experimental: `${aula.date}T00:00:00-03:00`,
    hora_aula_experimental: aula.time,
    confirmacao_24h_enviada_em: null,
    confirmacao_2h_enviada_em: null,
    status_funil: 'aula_agendada',
    ativo: true,
    is_matriculado: false,
    ...overrides,
  };
}

// ---------- testes ----------
Deno.test('NÃO envia para lead com compareceu=true (pré-filtro em lote)', async () => {
  const leadCompareceu = buildLead();
  const leadOk = buildLead();
  const state: MockState = {
    leads: [leadCompareceu, leadOk],
    compareceram: new Set([leadCompareceu.id]),
    zapiCalls: [],
    leadUpdates: [],
  };
  installMocks(state);
  const handler = await importHandler();

  const res = await handler(new Request(FN_URL, { method: 'POST', body: JSON.stringify({}) }));
  await res.text();

  const phonesEnviados = state.zapiCalls.map((c) => c.phone);
  assertEquals(state.zapiCalls.length, 1, 'deve enviar somente para o lead que não compareceu');
  assertEquals(phonesEnviados.includes('5511999990000'), true);
  // Garante que o lead que compareceu NÃO recebeu update de envio
  assertEquals(
    state.leadUpdates.some((u) => u.id === leadCompareceu.id),
    false,
    'lead com compareceu não pode ser marcado como enviado',
  );
});

Deno.test('NÃO envia em race condition (recheck per-lead intercepta)', async () => {
  const lead = buildLead();
  const state: MockState = {
    leads: [lead],
    // Simula race: pré-filtro estava vazio, mas no recheck per-lead já tem compareceu
    compareceram: new Set(),
    zapiCalls: [],
    leadUpdates: [],
  };
  installMocks(state);

  // Intercepta o recheck: para esse lead específico, "apareceu" um compareceu
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const prefer = (init?.headers as Record<string, string> | undefined)?.['Prefer'] ?? '';
    if (url.includes('/rest/v1/interacoes') && prefer.includes('head=true')) {
      return new Response(null, { status: 200, headers: { 'Content-Range': '0-0/3' } });
    }
    return realFetch(input as RequestInfo, init);
  };

  const handler = await importHandler();
  const res = await handler(new Request(FN_URL, { method: 'POST', body: JSON.stringify({}) }));
  await res.text();

  assertEquals(state.zapiCalls.length, 0, 'recheck deve bloquear envio');
  assertEquals(state.leadUpdates.length, 0, 'sem update quando bloqueado pelo recheck');
});

Deno.test('Envia normalmente quando lead nunca compareceu', async () => {
  const lead = buildLead();
  const state: MockState = {
    leads: [lead],
    compareceram: new Set(),
    zapiCalls: [],
    leadUpdates: [],
  };
  installMocks(state);
  const handler = await importHandler();

  const res = await handler(new Request(FN_URL, { method: 'POST', body: JSON.stringify({}) }));
  await res.text();

  assertEquals(state.zapiCalls.length >= 1, true, 'deve enviar pelo menos 1 mensagem');
  assertEquals(state.zapiCalls[0].phone, '5511999990000');
});

Deno.test('dryRun não envia mensagem mesmo sem compareceu', async () => {
  const lead = buildLead();
  const state: MockState = {
    leads: [lead],
    compareceram: new Set(),
    zapiCalls: [],
    leadUpdates: [],
  };
  installMocks(state);
  const handler = await importHandler();

  const res = await handler(new Request(FN_URL, { method: 'POST', body: JSON.stringify({ dryRun: true }) }));
  await res.text();

  assertEquals(state.zapiCalls.length, 0, 'dryRun não pode chamar Z-API');
  assertEquals(state.leadUpdates.length, 0, 'dryRun não pode marcar enviado');
});
