import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  dentroDaJanelaEnvio,
  inicioAulaUtc,
  mensagemInvalidada,
  mensagemPresenca,
  mensagemRespondida,
  tecladoPresenca,
  validarSituacao,
} from './experimentalPresenca.ts';

const slot = { data: '2026-11-02', hora: '08:00' };

Deno.test('inicio da aula usa o fuso de Recife (UTC-3)', () => {
  assertEquals(inicioAulaUtc(slot).toISOString(), '2026-11-02T11:00:00.000Z');
});

Deno.test('envio só acontece 30 min após o início', () => {
  const antes = new Date('2026-11-02T11:29:00Z'); // 08:29 local
  const exato = new Date('2026-11-02T11:30:00Z'); // 08:30 local
  const depois = new Date('2026-11-02T12:00:00Z'); // 09:00 local
  assertEquals(dentroDaJanelaEnvio(slot, antes), false);
  assertEquals(dentroDaJanelaEnvio(slot, exato), true);
  assertEquals(dentroDaJanelaEnvio(slot, depois), true);
});

Deno.test('aula muito antiga não gera envio', () => {
  const muitoDepois = new Date('2026-11-02T18:00:00Z'); // 15:00 local (7h depois)
  assertEquals(dentroDaJanelaEnvio(slot, muitoDepois), false);
});

Deno.test('mensagem traz unidade, lead, telefone, data e horário', () => {
  const msg = mensagemPresenca({
    unidade: 'EVO SETÚBAL',
    leadNome: 'MARIA SILVA',
    leadTelefone: '81999990000',
    slot,
  });
  assertStringIncludes(msg, '📍 Experimental | SETÚBAL');
  assertStringIncludes(msg, '👤 Lead: MARIA SILVA');
  assertStringIncludes(msg, '📱 Telefone: 81999990000');
  assertStringIncludes(msg, '📅 Data: 02/11/2026');
  assertStringIncludes(msg, '🕐 Horário: 08:00');
  assertStringIncludes(msg, 'O lead compareceu à aula experimental?');
});

Deno.test('botões usam apenas o identificador interno, sem dados pessoais', () => {
  const t = tecladoPresenca('abc-123');
  const dados = t.inline_keyboard[0].map((b) => b.callback_data);
  assertEquals(dados, ['expc:abc-123', 'expn:abc-123']);
});

Deno.test('mensagem respondida preserva os dados e informa responsável e horário', () => {
  const msg = mensagemRespondida(
    { unidade: 'EVO MADALENA', leadNome: 'JOÃO', leadTelefone: '81988887777', slot },
    true,
    'MANU PAES',
    new Date('2026-11-02T12:05:00Z'),
  );
  assertStringIncludes(msg, '✅ Comparecimento confirmado.');
  assertStringIncludes(msg, 'Respondido por: MANU PAES');
  assertStringIncludes(msg, '👤 Lead: JOÃO');
});

Deno.test('validação de estado: ok, já respondido, cancelado e remarcado', () => {
  const base = { compareceu: null, cancelado: false, data_experimental: '2026-11-02', hora_experimental: '08:00' };
  assertEquals(validarSituacao(base, slot), 'ok');
  assertEquals(validarSituacao({ ...base, compareceu: true }, slot), 'ja_respondido');
  assertEquals(validarSituacao({ ...base, compareceu: false }, slot), 'ja_respondido');
  assertEquals(validarSituacao({ ...base, cancelado: true }, slot), 'cancelado');
  assertEquals(validarSituacao({ ...base, data_experimental: '2026-11-03' }, slot), 'remarcado');
  assertEquals(validarSituacao({ ...base, hora_experimental: '09:00' }, slot), 'remarcado');
});

Deno.test('mensagem invalidada avisa cancelamento ou remarcação', () => {
  const d = { unidade: 'EVO SETÚBAL', leadNome: 'ANA', leadTelefone: '1', slot };
  assertStringIncludes(mensagemInvalidada(d, 'cancelado'), 'Agendamento cancelado');
  assertStringIncludes(mensagemInvalidada(d, 'remarcado'), 'Agendamento remarcado');
});
