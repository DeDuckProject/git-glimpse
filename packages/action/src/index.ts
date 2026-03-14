import * as core from '@actions/core';
import * as github from '@actions/github';
import { execFileSync, spawn } from 'node:child_process';
import {
  loadConfig,
  parseDiff,
  runPipeline,
  postPRComment,
  postSkipComment,
  uploadToGitHubAssets,
  evaluateTrigger,
  parseGlimpseCommand,
  DEFAULT_TRIGGER,
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

  const eventName = context.eventName;
  if (eventName !== 'pull_request' && eventName !== 'issue_comment') {
    core.info(`git-glimpse does not handle '${eventName}' events. Skipping.`);
    return;
  }

  const configPath = core.getInput('config-path') || undefined;
  const previewUrlInput = core.getInput('preview-url') || undefined;
  const startCommandInput = core.getInput('start-command') || undefined;
  const triggerModeInput = core.getInput('trigger-mode') || undefined;

  let config = await loadConfig(configPath);
  if (previewUrlInput) {
    config = { ...config, app: { ...config.app, previewUrl: previewUrlInput } };
  }
  if (startCommandInput) {
    config = { ...config, app: { ...config.app, startCommand: startCommandInput } };
  }
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

  // Resolve PR number, base/head SHAs, and event type
  let pullNumber: number;
  let baseSha: string;
  let headSha: string;
  let eventType: 'push' | 'comment';
  let command = null;
  let commentId: number | null = null;

  const addCommentReaction = async (content: 'eyes' | 'hooray' | 'confused') => {
    if (commentId === null) return;
    try {
      await octokit.rest.reactions.createForIssueComment({
        owner,
        repo,
        comment_id: commentId,
        content,
      });
    } catch {
      // Non-fatal
    }
  };

  if (eventName === 'issue_comment') {
    // Only handle comments on PRs, not plain issues
    if (!context.payload.issue?.pull_request) {
      core.info('Comment is on an issue, not a PR. Skipping.');
      return;
    }

    const commentBody: string = context.payload.comment?.body ?? '';
    command = parseGlimpseCommand(commentBody, triggerConfig.commentCommand);
    if (!command) {
      core.info(`No ${triggerConfig.commentCommand} command found in comment. Skipping.`);
      return;
    }

    pullNumber = context.payload.issue!.number;
    commentId = context.payload.comment!.id;
    eventType = 'comment';

    // Fetch PR details to get base/head SHAs
    const pr = await octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber });
    baseSha = pr.data.base.sha;
    headSha = pr.data.head.sha;
  } else {
    // pull_request event
    pullNumber = context.payload.pull_request?.number!;
    if (!pullNumber) {
      core.setFailed('Could not determine PR number');
      return;
    }

    baseSha = context.payload.pull_request?.base?.sha;
    headSha = context.payload.pull_request?.head?.sha;
    if (!baseSha || !headSha) {
      core.setFailed('Could not determine PR base/head SHA');
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

  if (!decision.shouldRun) {
    if (triggerConfig.skipComment) {
      await postSkipComment(token, { owner, repo, pullNumber, reason: decision.reason });
    }
    core.setOutput('success', 'false');
    return;
  }

  const baseUrlResult = resolveBaseUrl(config, previewUrlInput);
  if (!baseUrlResult.url) {
    core.setFailed(baseUrlResult.error!);
    return;
  }
  const baseUrl = baseUrlResult.url;

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
    const result = await runPipeline({ diff, baseUrl, outputDir: './recordings', config, generalDemo: decision.generalDemo });

    if (result.errors.length > 0) {
      core.warning(`Pipeline completed with errors:\n${result.errors.join('\n')}`);
    }

    const { owner, repo: repoName } = context.repo;

    let recordingUrl: string | undefined;
    if (result.recording) {
      core.info(
        `Recording created: ${result.recording.path} (${result.recording.sizeMB.toFixed(1)} MB)`
      );
      const upload = await uploadToGitHubAssets(token, owner, repoName, result.recording.path);
      recordingUrl = upload.url;
      core.setOutput('recording-url', recordingUrl);
    }

    let screenshotUrls: string[] | undefined;
    if (result.screenshots && result.screenshots.length > 0) {
      core.info(`Uploading ${result.screenshots.length} screenshot(s)...`);
      const uploadPromises = result.screenshots.map((screenshotPath) =>
        uploadToGitHubAssets(token, owner, repo, screenshotPath)
      );
      const uploads = await Promise.all(uploadPromises);
      screenshotUrls = uploads.map((u) => u.url);
    }

    const comment = await postPRComment(token, {
      owner,
      repo: repoName,
      pullNumber,
      analysis: result.analysis,
      recordingUrl,
      screenshots: screenshotUrls,
      script: result.script,
    });

    core.info(`Demo comment posted: ${comment.url}`);
    core.setOutput('comment-url', comment.url);
    core.setOutput('success', String(result.success));
    await addCommentReaction('hooray');
  } catch (err) {
    await addCommentReaction('confused');
    throw err;
  } finally {
    appProcess?.kill();
  }
}

export function resolveBaseUrl(
  config: GitGlimpseConfig,
  previewUrlOverride?: string
): { url: string; error?: never } | { url?: never; error: string } {
  const previewUrl = previewUrlOverride ?? config.app.previewUrl;
  if (previewUrl) {
    const resolved = process.env[previewUrl];
    if (resolved === undefined) {
      // previewUrl is a literal URL string, not an env var name
      if (previewUrl.startsWith('http')) return { url: previewUrl };
      return {
        error: `app.previewUrl is set to "${previewUrl}" but it doesn't look like a URL and no env var with that name was found. ` +
          `Set it to a full URL (e.g. "https://my-preview.vercel.app") or an env var name that is available in this workflow job.`,
      };
    }
    if (!resolved.startsWith('http')) {
      return {
        error: `Env var "${previewUrl}" was found but its value "${resolved}" is not a valid URL. Expected a value starting with "http".`,
      };
    }
    return { url: resolved };
  }
  if (config.app.readyWhen?.url) {
    const u = new URL(config.app.readyWhen.url);
    return { url: u.origin };
  }
  return { url: 'http://localhost:3000' };
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
