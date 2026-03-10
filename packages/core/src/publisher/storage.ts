import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

export interface UploadResult {
  url: string;
  size: number;
}

/**
 * Upload a recording file as a GitHub Actions artifact and return a usable URL.
 *
 * In a GitHub Actions context, we use @actions/artifact to upload and then
 * construct the artifact download URL from the run context.
 */
export async function uploadArtifact(filePath: string, artifactName?: string): Promise<UploadResult> {
  const name = artifactName ?? `git-glimpse-demo-${Date.now()}`;
  const size = statSync(filePath).size;

  // Dynamic import so this works in non-Actions environments too
  const { DefaultArtifactClient } = await import('@actions/artifact').catch(() => {
    throw new Error(
      'Artifact upload requires @actions/artifact. Are you running inside GitHub Actions?'
    );
  });

  const client = new DefaultArtifactClient();
  await client.uploadArtifact(name, [filePath], '.', { retentionDays: 30 });

  // Construct a shareable URL using GitHub Actions context
  const serverUrl = process.env['GITHUB_SERVER_URL'] ?? 'https://github.com';
  const repo = process.env['GITHUB_REPOSITORY'] ?? '';
  const runId = process.env['GITHUB_RUN_ID'] ?? '';

  const url = `${serverUrl}/${repo}/actions/runs/${runId}/artifacts`;
  return { url, size };
}

/**
 * Upload a file as an image attachment to a GitHub issue/PR comment.
 * Uses the undocumented but widely-used GitHub asset upload endpoint.
 */
export async function uploadToGitHubAssets(
  token: string,
  owner: string,
  repo: string,
  filePath: string
): Promise<UploadResult> {
  const { Octokit } = await import('@octokit/rest');
  const octokit = new Octokit({ auth: token });

  const fileBuffer = readFileSync(filePath);
  const fileName = basename(filePath);
  const size = statSync(filePath).size;

  // Upload via GitHub's release asset API as a workaround
  // Create a draft release, upload asset, get URL
  const release = await octokit.rest.repos.createRelease({
    owner,
    repo,
    tag_name: `git-glimpse-tmp-${Date.now()}`,
    draft: true,
    prerelease: true,
    name: 'git-glimpse temporary asset',
  });

  const asset = await octokit.rest.repos.uploadReleaseAsset({
    owner,
    repo,
    release_id: release.data.id,
    name: fileName,
    data: fileBuffer as unknown as string,
    headers: {
      'content-type': filePath.endsWith('.gif') ? 'image/gif' : 'video/mp4',
      'content-length': size,
    },
  });

  return { url: asset.data.browser_download_url, size };
}
