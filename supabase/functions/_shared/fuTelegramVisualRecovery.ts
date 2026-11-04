export async function recoverFuTelegramVisual<T>(operation: () => Promise<T>): Promise<T | { ok: false; description: string }> {
  try { return await operation(); }
  catch { return { ok: false, description: 'telegram_visual_update_failed' }; }
}