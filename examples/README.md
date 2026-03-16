# Examples

## Waiting for a deploy preview (action dependencies)

A common setup is to run git-glimpse **after** another action deploys a preview
(Cloudflare Pages, Vercel, Netlify, etc.). You don't need any special
git-glimpse config for this — GitHub Actions already has the primitives.

### How it works

Use two jobs connected by `needs:`:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    outputs:
      preview-url: ${{ steps.deploy.outputs.url }}
    steps:
      - uses: cloudflare/pages-action@v1   # or vercel, netlify, etc.
        id: deploy
        with: ...

  glimpse:
    needs: deploy                           # ← waits for deploy to finish
    runs-on: ubuntu-latest
    steps:
      - uses: DeDuckProject/git-glimpse@v1
        with:
          preview-url: ${{ needs.deploy.outputs.preview-url }}
```

`needs: deploy` tells GitHub to run the `glimpse` job only after `deploy`
succeeds. The preview URL flows between jobs via `outputs`.

### Handling propagation delay

Even after the deploy action reports success, the preview URL may not be
immediately reachable (DNS propagation, CDN warming, etc.). git-glimpse
automatically polls the preview URL before recording, controlled by the
`ready-timeout` input (default: 30 seconds):

```yaml
- uses: DeDuckProject/git-glimpse@v1
  with:
    preview-url: ${{ needs.deploy.outputs.preview-url }}
    ready-timeout: '60'    # wait up to 60s for the URL to respond
```

### Supporting `/glimpse` comment triggers

When a user comments `/glimpse` on a PR, the deploy job typically shouldn't
re-run (the preview already exists from the original push). The example
workflow handles this with conditional logic:

- The deploy job only runs on `pull_request` events
- The glimpse job uses `always()` so it still runs when deploy is skipped
- On comment events, the preview URL falls back to a known value (e.g. a
  repository variable or the URL from the original deployment)

### Full example

See [`cloudflare-deploy/workflow.yml`](cloudflare-deploy/workflow.yml) for a
complete, annotated workflow covering both PR pushes and `/glimpse` comment
triggers with Cloudflare Pages. The same pattern applies to any deploy-preview
service — just swap the deploy action and the output that carries the URL.

## Simple local app

See [`simple-app/`](simple-app/) for a minimal example that starts a local
server and records against `localhost`.
