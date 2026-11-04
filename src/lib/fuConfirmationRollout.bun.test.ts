import { describe, expect, test } from 'bun:test';
import { confirmationRolloutEnabled } from './fuConfirmationRollout';
describe('controlled confirmation rollout', () => {
  test('disabled by default even for a listed test user', () => {
    expect(confirmationRolloutEnabled({ testUsers: 'test-user' }, 'test-user')).toBe(false);
  });
  test('enabled production configuration only includes authorized test identities', () => {
    const config = { enabled: 'true', testUsers: 'test-user, second-user' };
    expect(confirmationRolloutEnabled(config, 'test-user')).toBe(true);
    expect(confirmationRolloutEnabled(config, 'second-user')).toBe(true);
    expect(confirmationRolloutEnabled(config, 'other-user')).toBe(false);
    expect(confirmationRolloutEnabled(config, undefined)).toBe(false);
  });
  test('an empty allowlist never releases all users', () => {
    expect(confirmationRolloutEnabled({ enabled: 'true' }, 'test-user')).toBe(false);
  });
});