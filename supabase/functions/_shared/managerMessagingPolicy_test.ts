import { isManagerRecipient, legacyManagerWhatsAppResult } from './managerMessagingPolicy.ts';

Deno.test('Manager roles must use Telegram, never WhatsApp fallback', () => {
  for (const cargo of ['coordenador_unidade', 'gerente', 'gerente_unidade', 'gerencia', 'admin']) {
    if (!isManagerRecipient(cargo)) throw new Error(`Manager WhatsApp was not blocked: ${cargo}`);
  }
  if (isManagerRecipient('recepcao')) throw new Error('Unrelated staff channel changed');
});

Deno.test('Legacy manager WhatsApp summaries send zero messages', () => {
  const result = legacyManagerWhatsAppResult();
  if (result.sent !== 0 || result.skipped !== 'gerentes_somente_telegram') throw new Error('Legacy send not disabled');
});