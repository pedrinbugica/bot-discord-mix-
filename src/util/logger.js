/**
 * @param {string} scope
 * @param {unknown} err
 * @param {Record<string, unknown>} [extra]
 */
export function logError(scope, err, extra = {}) {
  const ts = new Date().toISOString();
  const msg = err && typeof err === 'object' && 'message' in err ? err.message : String(err);
  console.error(`[${ts}] [${scope}]`, msg, Object.keys(extra).length ? extra : '');
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
}
