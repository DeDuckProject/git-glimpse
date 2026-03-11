import * as core from '@actions/core';
import * as github from '@actions/github';
import { execFileSync, spawn } from 'node:child_process';
import {
  loadConfig,
  runPipeline,
  postPRComment,
  uploadArtifact,
  type GitGlimpseConfig,
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

async function run(): Promise<void> {
  const context = github.context;
  const token = process.env['GITHUB_TOKEN'];

  if (!token) {
    core.setFailed('GITHUB_TOKEN is required');
    return;
  }

  if (context.eventName !== 'pull_request') {
    core.info('git-glimpse only runs on pull_request events. Skipping.');
    return;
  }

  const pullNumber = context.payload.pull_request?.number;
  if (!pullNumber) {
    core.setFailed('Could not determine PR number');
    return;
  }

  const configPath = core.getInput('config-path') || undefined;
  const previewUrlInput = core.getInput('preview-url') || undefined;
  const startCommandInput = core.getInput('start-command') || undefined;

  let config = await loadConfig(configPath);
  if (previewUrlInput) {
    config = { ...config, app: { ...config.app, previewUrl: previewUrlInput } };
  }
  if (startCommandInput) {
    config = { ...config, app: { ...config.app, startCommand: startCommandInput } };
  }

  const baseSha = context.payload.pull_request?.base?.sha;
  const headSha = context.payload.pull_request?.head?.sha;
  if (!baseSha || !headSha) {
    core.setFailed('Could not determine PR base/head SHA');
    return;
  }

  core.info(`Computing diff: ${baseSha}..${headSha}`);
  // Stream git diff to avoid maxBuffer limits on large diffs (e.g. bundled dist files)
  const diff = await streamCommand('git', ['diff', `${baseSha}..${headSha}`]);

  const baseUrl = resolveBaseUrl(config, previewUrlInput);
  if (!baseUrl) {
    core.setFailed(
      'No base URL available. Set app.previewUrl or app.startCommand + app.readyWhen in config.'
    );
    return;
  }

  if (config.setup) {
    core.info(`Running setup: ${config.setup}`);
    const parts = config.setup.split(' ');
    execFileSync(parts[0]!, parts.slice(1), { stdio: 'inherit' });
  }

  let appProcess: ReturnType<typeof spawn> | null = null;
  if (config.app.startCommand && !config.app.previewUrl) {
    appProcess = await startApp(config.app.startCommand, config.app.readyWhen?.url ?? baseUrl);
  }

  try {
    core.info('Running git-glimpse pipeline...');
    const result = await runPipeline({ diff, baseUrl, outputDir: './recordings', config });

    if (result.errors.length > 0) {
      core.warning(`Pipeline completed with errors:\n${result.errors.join('\n')}`);
    }

    let recordingUrl: string | undefined;
    if (result.recording) {
      core.info(
        `Recording created: ${result.recording.path} (${result.recording.sizeMB.toFixed(1)} MB)`
      );
      const upload = await uploadArtifact(result.recording.path);
      recordingUrl = upload.url;
      core.setOutput('recording-url', recordingUrl);
    }

    const { owner, repo } = context.repo;
    const comment = await postPRComment(token, {
      owner,
      repo,
      pullNumber,
      analysis: result.analysis,
      recordingUrl,
      screenshots: result.screenshots,
      script: result.script,
    });

    core.info(`Demo comment posted: ${comment.url}`);
    core.setOutput('comment-url', comment.url);
    core.setOutput('success', String(result.success));
  } finally {
    appProcess?.kill();
  }
}

function resolveBaseUrl(config: GitGlimpseConfig, previewUrlOverride?: string): string | null {
  const previewUrl = previewUrlOverride ?? config.app.previewUrl;
  if (previewUrl) {
    const resolved = process.env[previewUrl] ?? previewUrl;
    return resolved.startsWith('http') ? resolved : null;
  }
  if (config.app.readyWhen?.url) {
    const u = new URL(config.app.readyWhen.url);
    return u.origin;
  }
  return 'http://localhost:3000';
}

async function startApp(
  startCommand: string,
  readyUrl: string
): Promise<ReturnType<typeof spawn>> {
  const parts = startCommand.split(' ');
  core.info(`Starting app: ${startCommand}`);
  const proc = spawn(parts[0]!, parts.slice(1), { stdio: 'inherit', shell: false });

  await waitForUrl(readyUrl, 30000);
  core.info('App is ready');
  return proc;
}

async function waitForUrl(url: string, timeout: number): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`App did not become ready at ${url} within ${timeout / 1000}s`);
}

run().catch((err) => core.setFailed(err instanceof Error ? err.message : String(err)));
