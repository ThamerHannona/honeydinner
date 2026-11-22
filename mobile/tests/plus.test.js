import { describe, expect, test } from 'bun:test';
import { plusErrorFromResponse, PlusRequiredError, newAppUserId } from '../src/lib/plus';

describe('plus errors', () => {
  test('402 with plus_required becomes PlusRequiredError', () => {
    const err = plusErrorFromResponse(402, { code: 'plus_required', feature: 'scan', error: 'limit' }, 'import');
    expect(err).toBeInstanceOf(PlusRequiredError);
    expect(err.feature).toBe('scan');
    expect(err.message).toBe('limit');
  });

  test('other statuses are ignored', () => {
    expect(plusErrorFromResponse(422, { error: 'nope' }, 'import')).toBeNull();
    expect(plusErrorFromResponse(200, { recipe: {} }, 'import')).toBeNull();
  });

  test('app user ids are stable-looking and unique', () => {
    const a = newAppUserId();
    const b = newAppUserId();
    expect(a.startsWith('hd_')).toBe(true);
    expect(a).not.toBe(b);
  });
});
