/**
 * Lightweight pre-check entrypoint.
 *
 * Runs early in the workflow — before heavy installs (ffmpeg, Playwright) — to
 * decide whether the git-glimpse pipeline should execute at all.  Writes a
 * `should-run` step output so the workflow can gate subsequent steps with:
 *
 *   if: steps.check.outputs.should-run == 'true'
 */
import * as core from '@actions/core';
import * as github from '@actions/github';
import { spawn } from 'node:child_process';
import {
  loadConfig,
  parseDiff,
  evaluateTrigger,
  parseGlimpseCommand,
  DEFAULT_TRIGGER,
} from '@git-glimpse/core';

function streamCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const proc = spawn(cmd, args, { shell: false });
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`${cmd} exited with code ${code}`));
      else resolve(Buffer.concat(chunks).toString('utf-8'));
    });
  });
}

async function check(): Promise<void> {
  const context = github.context;
  const token = process.env['GITHUB_TOKEN'];

  if (!token) {
    core.warning('GITHUB_TOKEN not set — defaulting to should-run=true');
    core.setOutput('should-run', 'true');
    return;
  }

  const eventName = context.eventName;
  if (eventName !== 'pull_request' && eventName !== 'issue_comment') {
    core.info(`git-glimpse does not handle '${eventName}' events. Skipping.`);
    core.setOutput('should-run', 'false');
    return;
  }

  const configPath = core.getInput('config-path') || undefined;
  const triggerModeInput = core.getInput('trigger-mode') || undefined;

  let config = await loadConfig(configPath);
  if (triggerModeInput && ['auto', 'on-demand', 'smart'].includes(triggerModeInput)) {
    config = {
      ...config,
      trigger: {
        ...DEFAULT_TRIGGER,
        ...config.trigger,
        mode: triggerModeInput as 'auto' | 'on-demand' | 'smart',
      },
    };
  }

  const triggerConfig = config.trigger ?? DEFAULT_TRIGGER;
  const { owner, repo } = context.repo;
  const octokit = github.getOctokit(token);

  let pullNumber: number;
  let baseSha: string;
  let headSha: string;
  let eventType: 'push' | 'comment';
  let command = null;

  if (eventName === 'issue_comment') {
    if (!context.payload.issue?.pull_request) {
      core.info('Comment is on an issue, not a PR. Skipping.');
      core.setOutput('should-run', 'false');
      return;
    }

    const commentBody: string = context.payload.comment?.body ?? '';
    command = parseGlimpseCommand(commentBody, triggerConfig.commentCommand);
    if (!command) {
      core.info(`No ${triggerConfig.commentCommand} command found in comment. Skipping.`);
      core.setOutput('should-run', 'false');
      return;
    }

    pullNumber = context.payload.issue!.number;
    eventType = 'comment';

    const pr = await octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber });
    baseSha = pr.data.base.sha;
    headSha = pr.data.head.sha;
  } else {
    pullNumber = context.payload.pull_request?.number!;
    if (!pullNumber) {
      core.warning('Could not determine PR number — defaulting to should-run=true');
      core.setOutput('should-run', 'true');
      return;
    }

    baseSha = context.payload.pull_request?.base?.sha;
    headSha = context.payload.pull_request?.head?.sha;
    if (!baseSha || !headSha) {
      core.warning('Could not determine PR base/head SHA — defaulting to should-run=true');
      core.setOutput('should-run', 'true');
      return;
    }

    eventType = 'push';
  }

  core.info(`Computing diff: ${baseSha}..${headSha}`);
  const diff = await streamCommand('git', ['diff', `${baseSha}..${headSha}`]);
  const parsedDiff = parseDiff(diff);

  const decision = evaluateTrigger({
    files: parsedDiff.files,
    triggerConfig,
    eventType,
    command,
  });

  core.info(`Trigger decision: ${decision.shouldRun ? 'RUN' : 'SKIP'} — ${decision.reason}`);
  core.setOutput('should-run', String(decision.shouldRun));
}

check().catch((err) => {
  // On unexpected errors, default to running so we don't silently skip
  core.warning(`Trigger check failed: ${err instanceof Error ? err.message : String(err)} — defaulting to should-run=true`);
  core.setOutput('should-run', 'true');
});
