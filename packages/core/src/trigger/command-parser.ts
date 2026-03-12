export interface GlimpseCommand {
  force: boolean;
  route?: string;
}

/**
 * Parses a /glimpse command from a PR comment body.
 * Returns null if no command is found.
 *
 * Supported syntax:
 *   /glimpse
 *   /glimpse --force
 *   /glimpse --route /products
 *   /glimpse --force --route /products
 */
export function parseGlimpseCommand(
  commentBody: string,
  commandPrefix = '/glimpse'
): GlimpseCommand | null {
  const lines = commentBody.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.toLowerCase().startsWith(commandPrefix.toLowerCase())) continue;

    // Ensure the command prefix is followed by whitespace or end-of-line
    const rest = trimmed.slice(commandPrefix.length);
    if (rest.length > 0 && !/^\s/.test(rest)) continue;

    const args = rest.trim().split(/\s+/).filter(Boolean);
    const force = args.includes('--force');

    let route: string | undefined;
    const routeIndex = args.indexOf('--route');
    if (routeIndex !== -1 && args[routeIndex + 1]) {
      route = args[routeIndex + 1];
    }

    return { force, route };
  }

  return null;
}
