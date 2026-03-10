# GitGlimpse

Automatically generate visual demo clips of UI changes in pull requests.

When a PR is opened, GitGlimpse reads the diff, uses an LLM to understand what changed, generates a Playwright interaction script, records a demo, and posts it as a PR comment — all without leaving CI.

![Example PR comment showing a GIF demo](docs/example-comment.png)

## How it works

```
PR opened/updated
       │
       ▼
  Diff Analyzer ── identifies changed files and affected routes
       │
       ▼
  Script Generator ── LLM reads diff → generates Playwright script
       │
       ▼
  Recorder ── Playwright executes script + captures video
       │
       ▼
  Publisher ── FFmpeg converts to GIF, posts as PR comment
```

## Quick start

### GitHub Action

Add a workflow file to your repo:

```yaml
# .github/workflows/git-glimpse.yml
name: GitGlimpse

on:
  pull_request:
    types: [opened, synchronize]
    paths:
      - 'app/**'
      - 'src/**'

jobs:
  demo:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - uses: git-glimpse/action@v1
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Add a `git-glimpse.config.ts` at your repo root:

```typescript
import type { GitGlimpseConfig } from '@git-glimpse/core';

export default {
  app: {
    startCommand: 'npm run dev',
    readyWhen: { url: 'http://localhost:3000' },
  },
  recording: {
    format: 'gif',
    maxDuration: 30,
  },
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
  },
} satisfies GitGlimpseConfig;
```

Add your Anthropic API key as a GitHub secret: **Settings → Secrets → `ANTHROPIC_API_KEY`**.

### With Vercel / Netlify deploy previews

If your app already has deploy previews, skip the `startCommand` — point GitGlimpse at the preview URL instead:

```yaml
- uses: git-glimpse/action@v1
  with:
    preview-url: ${{ steps.vercel.outputs.preview-url }}
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

```typescript
export default {
  app: {
    previewUrl: 'VERCEL_URL', // env var name or literal URL
  },
} satisfies GitGlimpseConfig;
```

### CLI (local use)

```bash
npx git-glimpse run --diff HEAD~1 --url http://localhost:3000 --open
```

Initialize a config file:

```bash
npx git-glimpse init
```

## Configuration

All options in `git-glimpse.config.ts`:

```typescript
import type { GitGlimpseConfig } from '@git-glimpse/core';

export default {
  // ── App startup ───────────────────────────────────────
  app: {
    // Option A: GitGlimpse starts the app
    startCommand: 'npm run dev',
    readyWhen: { url: 'http://localhost:3000', status: 200, timeout: 30000 },
    env: { DATABASE_URL: 'sqlite::memory:' },

    // Option B: use an existing deploy preview
    // previewUrl: 'VERCEL_URL',  // env var name or literal URL
  },

  // ── Route map (optional, improves LLM accuracy) ───────
  // Maps source file globs → URLs where changes are visible
  routeMap: {
    'app/routes/products.$id.tsx': '/products/sample-product',
    'src/components/Header.tsx': '/',
    'extensions/my-block/**': '/products/sample-product',
  },

  // ── Setup (optional) ──────────────────────────────────
  setup: 'node scripts/seed.js',

  // ── Recording ─────────────────────────────────────────
  recording: {
    format: 'gif',        // 'gif' | 'mp4' | 'webm'
    maxDuration: 30,      // seconds
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  },

  // ── LLM ───────────────────────────────────────────────
  llm: {
    provider: 'anthropic',       // 'anthropic' | 'openai'
    model: 'claude-sonnet-4-6',  // or 'gpt-4o', etc.
  },
} satisfies GitGlimpseConfig;
```

### Action inputs

| Input | Default | Description |
|---|---|---|
| `config-path` | `git-glimpse.config.ts` | Path to config file |
| `preview-url` | — | External preview URL (overrides config) |
| `start-command` | — | App start command (overrides config) |
| `format` | `gif` | Output format: `gif`, `mp4`, `webm` |
| `max-duration` | `30` | Max recording duration in seconds |

### Action outputs

| Output | Description |
|---|---|
| `recording-url` | URL of the uploaded recording artifact |
| `comment-url` | URL of the posted PR comment |
| `success` | Whether recording succeeded (`true`/`false`) |

## Requirements

- **Node.js** ≥ 20
- **Anthropic API key** — set as `ANTHROPIC_API_KEY` environment variable
- **FFmpeg** — required for GIF/MP4 conversion
  - Ubuntu/Debian: `apt-get install ffmpeg`
  - macOS: `brew install ffmpeg`
  - GitHub Actions: pre-installed on `ubuntu-latest`
- **Playwright Chromium** — installed automatically by the action; for local use run `npx playwright install chromium`

## How app startup works

GitGlimpse supports two modes:

**Preview URL mode** (recommended when available): Point it at a Vercel, Netlify, or Cloudflare Pages deploy preview. No app startup needed — more reliable and faster.

**Start command mode**: GitGlimpse runs `startCommand`, waits for `readyWhen.url` to return HTTP 200, then begins recording. Works well for Next.js, Remix, SvelteKit and other apps that start cleanly with `npm run dev`. Apps requiring tunnels, OAuth flows, or external services must use preview URL mode.

## Route detection

GitGlimpse automatically maps changed files to URLs using framework conventions:

| Framework | Convention | Example |
|---|---|---|
| Remix | `app/routes/products.$id.tsx` | `/products/:id` |
| Next.js App Router | `app/products/[id]/page.tsx` | `/products/:id` |
| Next.js Pages Router | `pages/products/[id].tsx` | `/products/:id` |
| SvelteKit | `src/routes/products/[id]/+page.svelte` | `/products/:id` |

For files that don't follow a convention (shared components, Liquid templates, etc.), use the `routeMap` config option to tell GitGlimpse which URL to visit.

## Retry and fallback behavior

If the generated Playwright script fails (element not found, timeout), GitGlimpse:

1. Captures the error and retries with the error context fed back to the LLM (up to 2 retries)
2. Falls back to static screenshots if all attempts fail

The PR comment is always posted — either with the GIF or with screenshots as a fallback.

## Development

```bash
pnpm install
pnpm test                  # unit tests
pnpm run test:integration  # Playwright + FFmpeg tests (no API key needed)
pnpm run test:llm          # full pipeline with real LLM (requires ANTHROPIC_API_KEY)
```

## License

MIT
