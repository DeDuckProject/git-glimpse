export interface ValidationResult {
  valid: boolean;
  errors: string[];
  script: string;
}

export function validateScript(script: string): ValidationResult {
  const errors: string[] = [];

  // Must export a demo function
  if (!script.includes('export async function demo') && !script.includes('export function demo')) {
    errors.push('Script must export an async function named "demo"');
  }

  // Must accept a Page parameter
  if (!script.includes('page:') && !script.includes('page :')) {
    errors.push('The demo function must accept a "page" parameter of type Page');
  }

  // Warn about potentially fragile selectors (not an error, just cleanup)
  const cleanedScript = stripMarkdownFences(script);

  return {
    valid: errors.length === 0,
    errors,
    script: cleanedScript,
  };
}

function stripMarkdownFences(script: string): string {
  return script
    .replace(/^```(?:typescript|ts|javascript|js)?\n/m, '')
    .replace(/\n```$/m, '')
    .trim();
}
