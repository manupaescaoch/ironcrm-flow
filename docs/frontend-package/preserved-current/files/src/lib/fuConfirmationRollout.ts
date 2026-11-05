// Presentation rollout only. SQL authorization remains mandatory for every request.
export type ConfirmationRollout = { enabled?: string; testUsers?: string };
export function confirmationRolloutEnabled(config: ConfirmationRollout, userId: string | undefined): boolean {
  if (config.enabled !== 'true' || !userId) return false;
  return (config.testUsers ?? '').split(',').map(value => value.trim()).filter(Boolean).includes(userId);
}