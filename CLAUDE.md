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

Features and bug fixes should include a unit test. Keep tests focused and avoid over-mocking —
test the behaviour that matters, not implementation details.

Integration tests require a running app. See `tests/integration/`.

## External-First Design Principle

git-glimpse is used as a GitHub Action (and in future possibly a GitHub App) by *other* repos —
not just this one. Every change we make must account for the experience of those consumers.

**Rules of thumb:**
- **Seamless by default**: aim for zero-config or minimal-config integration that just works.
- **Control when needed**: if seamless isn't achievable (e.g. workflow-level changes), provide
  clear documentation, sample workflow snippets, and ideally a wrapper action.
- **No silent breakage**: changes to action inputs/outputs, config schema, or workflow events must
  be backwards-compatible or clearly versioned.
- **Test from the outside**: validate features as if you were a consumer repo, not just via this
  repo's internal `demo.yml`.
- **Discuss trade-offs**: if a feature requires consumers to make non-trivial changes (new secrets,
  new workflow jobs, new permissions), flag it in the PR for a deliberate decision.

## Versioning & Releases

We use semver tags (`v1.0.0`) alongside a floating major tag (`v1`) — consumers pin to `@v1`.
Only bump the major version for breaking changes (e.g. removed/renamed inputs, new required secrets).

To release:

```bash
./scripts/release.sh 1.0.0
```

Always use the script — it handles both tags atomically. Never tag manually.

## Branching Convention

- Features: `feat/<name>`
- Bug fixes: `fix/<name>`
- Releases: `release/v<version>`
