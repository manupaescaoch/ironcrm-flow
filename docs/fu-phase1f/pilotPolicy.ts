// Candidate only: server configuration, never browser/body configuration.
export type PilotConfig = { enabled?: string; testUsers?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function pilotAllows(config: PilotConfig, actor: string): boolean {
  if (config.enabled !== 'true' || !uuid.test(actor)) return false;
  const users = (config.testUsers ?? '').split(',').map(v => v.trim());
  if (!users.length || users.some(v => !uuid.test(v))) return false;
  return users.some(v => v.toLowerCase() === actor.toLowerCase());
}