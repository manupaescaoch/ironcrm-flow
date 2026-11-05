/** Manager notifications never fall back to WhatsApp. */
export function isManagerRecipient(cargo?: string | null): boolean {
  return ['coordenador_unidade', 'gerente', 'gerente_unidade', 'gerencia', 'admin'].includes((cargo ?? '').toLowerCase());
}

export function legacyManagerWhatsAppResult() {
  return { success: true, sent: 0, skipped: 'gerentes_somente_telegram' };
}