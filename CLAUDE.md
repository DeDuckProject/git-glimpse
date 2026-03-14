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

We follow the standard GitHub Actions versioning convention using semantic versioning tags
alongside floating major tags.

- **Semantic tags** (`v1.0.0`, `v1.2.3`) are immutable and mark exact releases.
- **Floating major tags** (`v1`, `v2`) always point to the latest non-breaking release
  in that major line. Consumers use `uses: DeDuckProject/git-glimpse@v1` to stay on the
  latest compatible version.
- Only cut `v2` (bump the major version) for **breaking changes**.

### What counts as a breaking change

- Removing or renaming an existing action input or output
- Changing the default behavior of an existing input in a way that alters results
- Requiring a new permission, secret, or workflow event that consumers must add
- Dropping support for a previously supported runner OS or Node version

### How to release

```bash
./scripts/release.sh <version>   # e.g. ./scripts/release.sh 1.0.0
```

The script will:
1. Create the immutable tag `v<version>`
2. Force-move the floating major tag (`v1`, `v2`, etc.) to the same commit
3. Push both tags to origin

A GitHub Actions workflow (`.github/workflows/release.yml`) automatically creates a
GitHub Release with auto-generated release notes when a `v*.*.*` tag is pushed.

**Important:** Never push a release without updating both the semantic and floating tags.
The release script handles this automatically — always use it instead of manual tagging.

## Branching Convention

- Features: `feat/<name>`
- Bug fixes: `fix/<name>`
- Releases: `release/v<version>`
