import { Event } from '@sentry/node';

/** Masking function produced by `satanizer`. */
type Mask = <T>(input: T) => T;

/**
 * Builds the `beforeSend` hook that redacts secrets from an outgoing Sentry
 * event.
 *
 * Masks named fields one by one instead of walking the whole event: the event
 * graph contains circular references, which satanizer replaces with `[Cycle]`,
 * so masking the root would corrupt fields Sentry needs. The listed fields are
 * every field the configured integrations actually populate with request or
 * error data — `spans` is included so enabling tracing later cannot silently
 * start shipping unmasked HTTP span data.
 */
export const buildBeforeSend =
  (mask: Mask) =>
  (event: Event): Event => ({
    ...event,
    message: mask(event.message),
    exception: mask(event.exception),
    breadcrumbs: mask(event.breadcrumbs),
    tags: mask(event.tags),
    request: mask(event.request),
    contexts: mask(event.contexts),
    extra: mask(event.extra),
    user: mask(event.user),
    spans: mask(event.spans),
  });

/** Event fields `buildBeforeSend` redacts. Exported for the test that pins them. */
export const MASKED_EVENT_FIELDS = [
  'message',
  'exception',
  'breadcrumbs',
  'tags',
  'request',
  'contexts',
  'extra',
  'user',
  'spans',
] as const;
