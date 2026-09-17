import { Event } from '@sentry/node';
import { commonPatterns, satanizer } from '@lidofinance/satanizer';
import { buildBeforeSend, MASKED_EVENT_FIELDS } from './sentry.before-send';

/**
 * Distinctive value planted in every event field; the masker must remove it.
 * Named so the CI generic-secrets linter does not read the fixture as a real
 * credential (it matches a quoted literal after an API_KEY- or SECRET-shaped name).
 */
const NEEDLE = 'planted-fixture-value-must-be-masked';

describe('buildBeforeSend', () => {
  const beforeSend = buildBeforeSend(satanizer([...commonPatterns, NEEDLE]));

  // One event carrying the secret in every field the app can populate.
  const eventWithSecretEverywhere = (): Event => ({
    message: `boom ${NEEDLE}`,
    exception: { values: [{ type: 'Error', value: `failed with ${NEEDLE}` }] },
    breadcrumbs: [{ message: `called with ${NEEDLE}` }],
    tags: { key: NEEDLE },
    request: {
      headers: { 'x-access-key': NEEDLE },
      url: `https://x/?k=${NEEDLE}`,
    },
    contexts: { runtime: { detail: NEEDLE } },
    extra: { payload: { nested: [NEEDLE] } },
    user: { id: NEEDLE },
    spans: [{ description: NEEDLE } as never],
  });

  it.each(MASKED_EVENT_FIELDS)('redacts the secret in event.%s', (field) => {
    const masked = beforeSend(eventWithSecretEverywhere());

    expect(JSON.stringify(masked[field])).not.toContain(NEEDLE);
  });

  it('leaves no trace of the secret anywhere in the event', () => {
    const masked = beforeSend(eventWithSecretEverywhere());

    expect(JSON.stringify(masked)).not.toContain(NEEDLE);
  });

  it('masks every field the app populates, so a new field cannot be forgotten silently', () => {
    // Guards against wiring a field to the wrong source (e.g. `request:
    // mask(event.exception)`), which would compile and mask nothing.
    const event = eventWithSecretEverywhere();
    const masked = beforeSend(event);

    MASKED_EVENT_FIELDS.forEach((field) => {
      expect(masked[field]).toBeDefined();
      expect(masked[field]).not.toEqual(event[field]);
    });
  });

  it('preserves fields it does not mask', () => {
    const masked = beforeSend({
      ...eventWithSecretEverywhere(),
      release: 'withdrawals-api@1.2.3',
      environment: 'production',
    });

    expect(masked.release).toBe('withdrawals-api@1.2.3');
    expect(masked.environment).toBe('production');
  });

  it('handles an event with none of the masked fields set', () => {
    expect(() => beforeSend({ event_id: 'abc' })).not.toThrow();
    expect(beforeSend({ event_id: 'abc' }).event_id).toBe('abc');
  });
});
