// Narrow an unknown error to a flat, safe-to-log shape.
//
// Logging a raw error object can leak request headers (e.g. Authorization),
// fetch config, or other sensitive metadata that some libraries attach.
// We keep only the message, name, and stack — enough for debugging, nothing
// that contains secrets.

export interface SanitizedError {
  name: string;
  message: string;
  stack?: string;
}

export const sanitizeError = (error: unknown): SanitizedError => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  if (typeof error === 'string') {
    return { name: 'NonError', message: error };
  }
  // JSON.stringify(undefined) returns undefined (the value), which would violate
  // the SanitizedError contract — fall back to String() for unstringifiable inputs.
  return { name: 'NonError', message: JSON.stringify(error) ?? String(error) };
};
