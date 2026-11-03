import { notificacaoFuGerencial } from '../_shared/fuGerencialRules.ts';

const assert = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
const cases = [
  { name: 'M+15/M+30 individual only and other routines preserved', failure: '', missingGroup: false },
  { name: 'context failure isolated to one enrollment', failure: 'context', missingGroup: false },
  { name: 'ambiguous persistence failure keeps claim and continues', failure: 'save', missingGroup: false },
  { name: 'missing GERÊNCIA never falls back to another unit or sector', failure: '', missingGroup: true },
];

let handler: ((req: Request) => Promise<Response>) | undefined;
let loaded = false;
for (const scenario of cases) {
  Deno.test(scenario.name, async () => {
    const originalFetch = globalThis.fetch, originalServe = Deno.serve;
    const keys = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','CRON_JOB_SECRET','BACKUP_CRON_SECRET','TELEGRAM_BOT_TOKEN'];
    const saved = keys.map(key => Deno.env.get(key));
    Deno.env.set('SUPABASE_URL','http://mock.local');
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-only');
    Deno.env.set('CRON_JOB_SECRET','isolated-cron-secret-123');
    Deno.env.set('BACKUP_CRON_SECRET','isolated-cron-secret-123');
    Deno.env.set('TELEGRAM_BOT_TOKEN','test-only');
    const sent: any[] = [], claims = new Set<string>(), writes: any[] = [], queries: string[] = [];
    const tasks = [{id:'a',unidade_id:'A',fu_gerencial_etapa:'M+15',responsavel:'MANU'}, {id:'b',unidade_id:'B',fu_gerencial_etapa:'M+30',responsavel:'MANU'}];
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      assert(['mock.local','api.telegram.org'].includes(url.hostname), 'Unexpected transport: possible student contact');
      const method = init?.method ?? 'GET', body = init?.body ? JSON.parse(String(init.body)) : null;
      const table = url.pathname.split('/').pop() ?? '';
      queries.push(table);
      if (url.hostname === 'api.telegram.org') {
        assert(table === 'sendMessage', 'Unexpected Telegram operation');
        sent.push(body); return Response.json({ok:true,result:{message_id:sent.length}});
      }
      if (table === 'tasks' && method === 'GET') {
        return Response.json(url.searchParams.has('fu_gerencial_status') ? tasks : []);
      }
      if (table === 'tasks' && method === 'PATCH') {
        writes.push(body);
        if (scenario.failure === 'save' && url.searchParams.get('id') === 'eq.a') return Response.json({message:'isolated save failure'}, {status:500});
        return Response.json([]);
      }
      if (table === 'fu_gerencial_contexto') {
        if (scenario.failure === 'context' && body.p_task === 'a') return Response.json({message:'isolated context failure'}, {status:500});
        const unit = body.p_task === 'a' ? 'A' : 'B';
        return Response.json({elegivel:true,aluno:`ALUNO ${unit}`,unidade:`EVO ${unit}`,telefone:'81999990000',avisos:[]});
      }
      if (table === 'fu_gerencial_claim') {
        const claimed = !claims.has(body.p_task); claims.add(body.p_task); return Response.json(claimed);
      }
      if (table === 'telegram_groups') {
        const unit = url.searchParams.get('unidade_id')?.slice(3);
        return Response.json(scenario.missingGroup && unit === 'A' ? [] : [{id:`wrong-${unit}`,group_type:'coordenadores',telegram_chat_id:-99},{id:`g-${unit}`,group_type:'gerencia',telegram_chat_id:unit === 'A' ? -1 : unit === 'B' ? -2 : -3}]);
      }
      // Read-only observation and untouched technical/operational queries use empty fixtures.
      if (url.pathname.includes('/rpc/')) return Response.json({modo:'observacao',permitido:true});
      return Response.json([]);
    };
    try {
      if (!loaded) {
        // Capture the actual endpoint; no listener and no real network.
        (Deno as any).serve = (fn: typeof handler) => { handler = fn; };
        await import('./index.ts'); loaded = true;
      }
      const run = handler;
      if (!run) throw new Error('Endpoint was not registered');
      const invoke = (body: object) => run(new Request('http://mock.local/endpoint', {method:'POST',headers:{'x-cron-secret':'isolated-cron-secret-123','Content-Type':'application/json'},body:JSON.stringify(body)}));
      const first = await invoke({});
      assert(first.status === 200, 'One task failed and interrupted other endpoint routines');
      const response = await first.json();
      assert(response.managerFu.skipped === 'resumo_gerencial_legado_desativado', 'Missing retired digest evidence');
      assert(!queries.includes('unidades') && !queries.includes('formulario_envios_log'), 'Legacy roster or send claims accessed');
      assert(!sent.some(s => s.text.includes('FOLLOW-UPS DO GERENTE')), 'Legacy digest emitted');
      const individual = sent.filter(s => s.reply_markup);
      assert(individual.length === (scenario.failure === 'context' || scenario.missingGroup ? 1 : 2), 'Wrong number of individual reminders');
      assert(individual.some(s => s.chat_id === -2), 'Second enrollment was interrupted');
      for (const message of individual) {
        const task = message.chat_id === -1 ? tasks[0] : tasks[1];
        const unit = task.unidade_id;
        const expected = notificacaoFuGerencial(`ALUNO ${unit}`,`EVO ${unit}`,'81999990000','MANU',[],task.fu_gerencial_etapa);
        const buttons = message.reply_markup.inline_keyboard[0];
        assert(buttons[0].url === expected.link && buttons[1].callback_data === `fgc:${task.id}`, 'Stage text link or task identity changed');
        assert(!message.text.includes(`ALUNO ${unit === 'A' ? 'B' : 'A'}`), 'Cross-unit disclosure');
      }
      assert(sent.filter(s => s.text.includes('GESTÃO OPERACIONAL EVO CLUB')).length === 3, 'Operational summaries not preserved');
      assert(queries.filter(q => q === 'tasks').length >= 2, 'Technical routine not executed');
      assert(!writes.some(w => w.status || w.fu_gerencial_status || w.fu_gerencial_confirmado_em), 'Reminder completed a contact or accompaniment');
      await invoke({});
      assert(sent.filter(s => s.reply_markup).length === individual.length, 'Repeated execution duplicated individual reminder');
      const before = sent.length, writesBefore = writes.length;
      const dry = await invoke({mode:'fu_gerente_only',dry_run:true});
      assert(dry.status === 200 && (await dry.json()).skipped === 'resumo_gerencial_legado_desativado', 'Safe diagnostic response missing');
      assert(sent.length === before && writes.length === writesBefore, 'Diagnostic mode sent a message or wrote records');
    } finally {
      globalThis.fetch = originalFetch; (Deno as any).serve = originalServe;
      keys.forEach((key, i) => { const value = saved[i]; if (value === undefined) Deno.env.delete(key); else Deno.env.set(key,value); });
    }
  });
}