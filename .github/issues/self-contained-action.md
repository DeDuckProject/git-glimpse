# Make action self-contained: install ffmpeg and Playwright internally after trigger check

## Background

Currently, users who adopt git-glimpse must pre-install ffmpeg and Playwright
Chromium in their workflow **before** the action runs:

```yaml
- name: Install FFmpeg
  run: sudo apt-get install -y ffmpeg

- name: Install Playwright Chromium
  run: npx playwright install chromium --with-deps

- uses: DeDuckProject/git-glimpse@v1
  ...
```

As a workaround, we now ship a separate
[`check-trigger`](../../check-trigger/README.md) action that users can run
before their installs to skip them when the pipeline won't execute. But this
still requires users to structure their workflow correctly and understand the
pattern.

## Proposed improvement

Move the ffmpeg and Playwright installs **into** `packages/action/src/index.ts`,
running them only *after* `evaluateTrigger()` returns `shouldRun = true`. The
action becomes fully self-contained — users need no pre-install steps at all:

```yaml
# User workflow becomes just:
- uses: actions/checkout@v4
  with:
    fetch-depth: 0

- uses: DeDuckProject/git-glimpse@v1
  with:
    config-path: git-glimpse.config.ts
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The action would handle:
1. Evaluate trigger → if SKIP, exit immediately (fast, no heavy installs)
2. If RUN → install ffmpeg via `apt-get` (or detect if already present)
3. Install Playwright Chromium if not already installed
4. Run the pipeline

## Trade-offs to consider

- Requires `sudo` access inside the action for `apt-get` and
  `playwright install --with-deps`. Works on GitHub-hosted runners; may not
  work on all self-hosted runners.
- We should detect whether ffmpeg/Playwright are already installed and skip
  re-installing, so users who pre-install (for caching reasons) aren't penalised.
- Browser caching is currently the user's responsibility (via `actions/cache`).
  We could either document the cache pattern or manage it inside the action
  using `@actions/tool-cache` / `@actions/cache`.
- We may want to keep both options: a `self-contained: true` input (default)
  that installs deps internally, and `self-contained: false` for users who
  manage their own installs.

## Acceptance criteria

- [ ] A minimal workflow with only `uses: DeDuckProject/git-glimpse@v1` produces
      a recording on a PR with UI changes
- [ ] When the trigger check skips, the job completes in < 30 seconds (no heavy
      installs)
- [ ] Works on `ubuntu-latest` GitHub-hosted runners
- [ ] Documented behaviour for self-hosted runners (graceful error or skip if
      `sudo` unavailable)

## Related

Deferred from the CI performance optimisation work (PR #TODO) that added
`check-trigger` as the interim user-facing solution.
