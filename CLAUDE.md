# git-glimpse — Developer Guide

## What is this?

git-glimpse is a GitHub Action + CLI that automatically generates visual demo clips (GIF/video) of UI changes in pull requests. When a PR is opened or updated, it analyzes the diff, generates a Playwright interaction script via LLM, records a demo, and posts it as a PR comment.

## Repo Structure

```
packages/
  core/         — Core library: diff analysis, trigger logic, script generation, recording, publishing
  action/       — GitHub Action wrapper (main action + check-trigger companion)
  cli/          — CLI for local use (`npx git-glimpse`)
check-trigger/  — Lightweight companion action for early trigger evaluation
examples/       — Example project configurations
tests/          — Integration and unit tests
```

## Development Setup

```bash
pnpm install
pnpm build
pnpm test
```

## Config File

Users place a `git-glimpse.config.ts` at their repo root. See `packages/core/src/config/schema.ts` for the full type definition.

## Pipeline Stages

1. **Diff Analyzer** — parse changed files, detect affected routes
2. **Preview Env** — start the app or use a deploy preview URL
3. **Script Generator** — LLM reads diff → Playwright interaction script
4. **Recorder** — run script with Playwright video capture
5. **Publisher** — convert to GIF, post as PR comment

## LLM Integration

Uses Anthropic Claude by default. API key read from `ANTHROPIC_API_KEY` env var. See `packages/core/src/generator/script-generator.ts` for prompt design.

## Testing

```bash
pnpm test           # all packages
pnpm test --watch   # watch mode
```

Integration tests require a running app. See `tests/integration/`.

## Branching Convention

- Features: `feat/<name>`
- Bug fixes: `fix/<name>`
- Releases: `release/v<version>`
