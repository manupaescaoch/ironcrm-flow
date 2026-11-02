import { assertEquals, assertRejects, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { authorizeFollowUp, permittedScope, FollowUpError } from './followUpAuthorization.ts';
import { validateExperimental, runReagendamento } from './reagendamentoFlow.ts';
import { handleFollowUps } from '../send-follow-ups-automaticos/index.ts';
import { handleGenerateFollowUps } from '../generate-follow-ups/index.ts';
import { handleReagendamento } from '../send-reagendamento-experimental/index.ts';

const bv = '00000000-0000-4000-8000-000000000001';
const setubal = '00000000-0000-4000-8000-000000000002';
const madalena = '00000000-0000-4000-8000-000000000003';
const scope = { automatic: false, caller: 'COMERCIAL', units: [bv] };
const lead = { id: 'lead', unidade_id: bv, ativo: true, is_matriculado: false, data_aula_experimental: '2026-10-30', hora_aula_experimental: '10:00' };
const interaction = { id: 'experimental', lead_id: 'lead', unidade_id: bv, compareceu: false, agendou_experimental: true, data_experimental: '2026-10-30', hora_experimental: '10:00' };

for (const [name, units, requested] of [['Boa Viagem → Setúbal', [bv], setubal], ['Madalena → Boa Viagem', [madalena], bv]] as const) {
  Deno.test(`Segurança: ${name} bloqueado em todas as operações`, () => {
    for (const operation of ['send','generate','reagendar'] as const) assertThrows(() => permittedScope(operation, ['user'], [...units], requested), FollowUpError);
  });
}
Deno.test('Usuário comum nunca obtém escopo global', () => {
  for (const op of ['send','generate','reagendar'] as const) assertEquals(permittedScope(op, ['user'], [bv]), [bv]);
});
Deno.test('Admin possui permissão global explícita', () => assertEquals(permittedScope('send', ['admin'], []), null));
Deno.test('Recepção e gestão não executam envio comercial em lote', () => {
  for (const role of ['moderator','coordenador','gerente']) assertThrows(() => permittedScope('send', [role], [bv]), FollowUpError);
});
Deno.test('Perfis operacionais geram e reagendam somente na unidade', () => {
  for (const role of ['moderator','coordenador','gerente','user']) {
    assertEquals(permittedScope('generate', [role], [bv], bv), [bv]);
    assertEquals(permittedScope('reagendar', [role], [bv], bv), [bv]);
  }
});
Deno.test('Sem perfil ou unidade não há autorização', () => {
  assertThrows(() => permittedScope('send', [], [bv]), FollowUpError);
  assertThrows(() => permittedScope('send', ['user'], []), FollowUpError);
});
function client(roles = ['user'], units = [bv], valid = true) {
  return { auth: { getClaims: () => Promise.resolve({ data: valid ? { claims: { sub: 'user', role: 'authenticated' } } : null, error: valid ? null : 'invalid' }) },
    from: (table: string) => ({ select: () => ({ eq: () => Promise.resolve({ data: table === 'user_roles' ? roles.map(role => ({role})) : units.map(unidade_id => ({unidade_id})), error: null }) }) }) };
}
Deno.test('manual=true/false não muda identidade nem escopo', async () => {
  for (const manual of [true,false]) {
    const req = new Request('http://localhost', { method: 'POST', headers: { Authorization: 'Bearer mock-user' }, body: JSON.stringify({manual}) });
    assertEquals((await authorizeFollowUp(req,'send',undefined,client())).automatic, false);
    await assertRejects(() => authorizeFollowUp(req,'send',undefined,client(['moderator'])), FollowUpError);
  }
});
Deno.test('JWT inválido rejeitado antes da leitura dos recursos', async () => {
  await assertRejects(() => authorizeFollowUp(new Request('http://localhost', { headers: { Authorization: 'Bearer invalid' } }), 'send', undefined, client([],[],false)), FollowUpError);
});
Deno.test('Agendador legítimo e health-check possuem caminho separado', async () => {
  const oldCron = Deno.env.get('CRON_JOB_SECRET'), oldService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  Deno.env.set('CRON_JOB_SECRET','isolated-cron-secret-12345'); Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','isolated-service-credential');
  try {
    assertEquals((await authorizeFollowUp(new Request('http://localhost', {headers:{'x-cron-secret':'isolated-cron-secret-12345'}}),'send')).automatic,true);
    assertEquals((await authorizeFollowUp(new Request('http://localhost', {headers:{Authorization:'Bearer isolated-service-credential'}}),'send')).automatic,true);
    await assertRejects(() => authorizeFollowUp(new Request('http://localhost', {headers:{'x-cron-secret':'wrong'}}),'send'),FollowUpError);
  } finally { oldCron ? Deno.env.set('CRON_JOB_SECRET',oldCron) : Deno.env.delete('CRON_JOB_SECRET'); oldService ? Deno.env.set('SUPABASE_SERVICE_ROLE_KEY',oldService) : Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY'); }
});
Deno.test('Três endpoints retornam 401 sem autenticação, sem rede externa', async () => {
  for (const handler of [handleFollowUps, handleGenerateFollowUps, handleReagendamento]) {
    assertEquals((await handler(new Request('http://localhost',{method:'POST',body:'{}'}))).status,401);
  }
});
Deno.test('Lead e interação de unidades diferentes são rejeitados', () => {
  assertThrows(() => validateExperimental(lead,{...interaction,unidade_id:setubal},scope),FollowUpError);
});
Deno.test('Interação de outro lead é rejeitada', () => assertThrows(() => validateExperimental(lead,{...interaction,lead_id:'other'},scope),FollowUpError));
Deno.test('Recurso fora da unidade retorna indisponível', () => assertThrows(() => validateExperimental({...lead,unidade_id:setubal},interaction,scope),FollowUpError));
for (const [name, change] of [['compareceu',{compareceu:true}],['cancelada',{cancelado:true}],['futura',{data_experimental:'2099-01-01'}],['não experimental',{agendou_experimental:false}]] as const) {
  Deno.test(`Reagendamento rejeita experimental ${name}`, () => assertThrows(() => validateExperimental(lead,{...interaction,...change},scope),FollowUpError));
}
Deno.test('Nova experimental tem identidade distinta mesmo no mesmo dia', () => {
  const first = validateExperimental(lead,interaction,scope);
  const second = validateExperimental({...lead,hora_aula_experimental:'11:00'},{...interaction,id:'new',hora_experimental:'11:00'},scope);
  assertEquals(first === second,false);
});
Deno.test('Reserva sempre ocorre antes do envio e resultado', async () => {
  const order: string[] = [];
  await runReagendamento({ reserve:async()=>{order.push('reserve');return{id:'fu',claimed:true};},send:async()=>{order.push('send');return{ok:true,skipped:false,status:200};},finish:async()=>{order.push('finish');} });
  assertEquals(order,['reserve','send','finish']);
});
Deno.test('Falha na gravação impede envio', async () => {
  let sent=0;
  await assertRejects(()=>runReagendamento({reserve:async()=>{throw new Error('db unavailable');},send:async()=>{sent++;return{ok:true,skipped:false,status:200};},finish:async()=>{}}));
  assertEquals(sent,0);
});
Deno.test('Repetição não duplica envio ou resultado', async () => {
  let sent=0,finished=0,claimed=false;
  const deps={reserve:async()=>{const fresh=!claimed;claimed=true;return{id:'fu',claimed:fresh};},send:async()=>{sent++;return{ok:true,skipped:false,status:200};},finish:async()=>{finished++;}};
  await Promise.all([runReagendamento(deps),runReagendamento(deps),runReagendamento(deps)]);
  assertEquals(sent,1);assertEquals(finished,1);
});
Deno.test('Timeout conserva estado ambíguo e bloqueia repetição', async () => {
  let claimed=false,sent=0,state='';
  const deps={reserve:async()=>{const fresh=!claimed;claimed=true;return{id:'fu',claimed:fresh};},send:async()=>{sent++;throw new Error('timeout');},finish:async(_:any,s:string)=>{state=s;}};
  await assertRejects(()=>runReagendamento(deps),FollowUpError);
  await runReagendamento(deps);assertEquals(state,'ambiguo');assertEquals(sent,1);
});