import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { proximosDiasUteis, tecladoCobranca } from './contasPagarBotoes.ts';

Deno.test('reagendar oferece só dias úteis a partir de amanhã', () => {
  // sexta 23/10/2026 → seg 26, ter 27, qua 28
  assertEquals(proximosDiasUteis('2026-10-23', 3), ['2026-10-26', '2026-10-27', '2026-10-28']);
});

Deno.test('botões cabem no limite de 64 bytes do Telegram', () => {
  const id = '00000000-0000-0000-0000-000000000000';
  for (const b of tecladoCobranca(id).inline_keyboard[0]) {
    assertEquals(b.callback_data.length <= 64, true);
  }
  assertEquals(`cprc:${id}:20261026`.length <= 64, true);
});
