# `check-trigger` action

A lightweight companion to the main `git-glimpse` action. It evaluates the
trigger configuration (`auto` / `on-demand` / `smart`) **before** you install
heavy dependencies like ffmpeg and Playwright, so those installs are skipped
entirely on runs that would be a no-op.

## Why use it?

Installing ffmpeg and Playwright Chromium typically takes 2–4 minutes. When
your trigger mode is `on-demand` or `smart`, many PR pushes would result in the
pipeline being skipped anyway. This action lets you find that out first, for
the cost of a few seconds.

## Usage

```yaml
jobs:
  glimpse:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4        # or whatever package manager you use

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: pnpm install                  # or npm ci / yarn install

      # Run the lightweight trigger check first
      - uses: DeDuckProject/git-glimpse/check-trigger@v1
        id: check
        with:
          config-path: git-glimpse.config.ts   # default, can omit
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # Gate all heavy steps on the check result
      - name: Install FFmpeg
        if: steps.check.outputs.should-run == 'true'
        run: sudo apt-get install -y ffmpeg

      - name: Install Playwright Chromium
        if: steps.check.outputs.should-run == 'true'
        run: npx playwright install chromium --with-deps

      # Run the main action
      - uses: DeDuckProject/git-glimpse@v1
        if: steps.check.outputs.should-run == 'true'
        with:
          config-path: git-glimpse.config.ts
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `config-path` | No | `git-glimpse.config.ts` | Path to your config file |
| `trigger-mode` | No | _(from config)_ | Override trigger mode: `auto`, `on-demand`, or `smart` |

## Outputs

| Output | Description |
|--------|-------------|
| `should-run` | `"true"` if the pipeline should run, `"false"` if it should be skipped |

## Tip: Playwright browser caching

If you want to further speed up runs that _do_ execute, cache the Playwright
browser binary between runs:

```yaml
      - uses: DeDuckProject/git-glimpse/check-trigger@v1
        id: check

      - uses: actions/cache@v4
        if: steps.check.outputs.should-run == 'true'
        with:
          path: ~/.cache/ms-playwright
          key: playwright-chromium-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: playwright-chromium-

      - name: Install Playwright Chromium
        if: steps.check.outputs.should-run == 'true'
        run: npx playwright install chromium --with-deps
```
