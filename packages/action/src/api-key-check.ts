const REMEDIATION = 'Add it to your workflow: env: ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}';

export type ApiKeyCheckResult =
  | { action: 'ok' }
  | { action: 'fail'; message: string }
  | { action: 'warn'; message: string };

/**
 * Checks whether ANTHROPIC_API_KEY is present and returns what the caller
 * should do.
 *
 * @param shouldRun - whether the pipeline is about to run
 *   - true  → missing key is a hard failure (fail fast before expensive work)
 *   - false → missing key is a warning only (pipeline won't run this time)
 */
export function checkApiKey(
  apiKey: string | undefined,
  shouldRun: boolean
): ApiKeyCheckResult {
  if (apiKey) return { action: 'ok' };

  if (shouldRun) {
    return {
      action: 'fail',
      message: `ANTHROPIC_API_KEY is required but not set. ${REMEDIATION}`,
    };
  }

  return {
    action: 'warn',
    message: `ANTHROPIC_API_KEY is not set. The pipeline will fail if it runs. ${REMEDIATION}`,
  };
}
