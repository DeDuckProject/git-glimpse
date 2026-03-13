# Contributing to GitGlimpse

## Setup

```bash
pnpm install
pnpm build
pnpm test
```

Node.js ≥ 20 and pnpm are required. For integration tests you also need FFmpeg and Playwright Chromium:

```bash
sudo apt-get install -y ffmpeg                      # Linux
brew install ffmpeg                                # macOS
pnpm --filter @git-glimpse/core exec playwright install chromium --with-deps
```

## Repo structure

```
packages/
  core/         — Core library: diff analysis, trigger logic, script generation, recording, publishing
  action/       — GitHub Action wrapper (main action + check-trigger companion)
  cli/          — CLI for local use (`npx git-glimpse`)
check-trigger/  — Lightweight companion action for early trigger evaluation
examples/       — Example project configurations
tests/          — Integration and unit tests
```

## Running tests

```bash
pnpm test                   # unit tests (fast, no external deps)
pnpm run test:integration   # Playwright + FFmpeg (no API key needed)
pnpm run test:llm           # full pipeline with real LLM (requires ANTHROPIC_API_KEY)
```

## Making changes

- **Core logic** lives in `packages/core/src/`
- **Action entrypoint** is `packages/action/src/index.ts`
- **Check-trigger entrypoint** is `packages/action/src/check.ts`
- After changing action source, rebuild the dist: `pnpm build` in `packages/action`

## Branching

- Features: `feat/<name>`
- Bug fixes: `fix/<name>`
- Releases: `release/v<version>`

## Submitting a PR

1. Fork the repo and create a branch from `main`
2. Make your changes with tests where applicable
3. Run `pnpm test` and confirm everything passes
4. Open a PR with a clear description of what changed and why

## Reporting issues

Please include:
- What you expected to happen
- What actually happened
- Your `git-glimpse.config.ts` (redact any secrets)
- The GitHub Actions log output if relevant
