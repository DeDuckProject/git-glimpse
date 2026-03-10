export interface ParsedDiff {
  files: DiffFile[];
  rawDiff: string;
}

export interface DiffFile {
  path: string;
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

export interface DiffHunk {
  header: string;
  lines: string[];
}

export function parseDiff(rawDiff: string): ParsedDiff {
  const files: DiffFile[] = [];
  const fileBlocks = splitIntoFileBlocks(rawDiff);

  for (const block of fileBlocks) {
    const file = parseFileBlock(block);
    if (file) files.push(file);
  }

  return { files, rawDiff };
}

function splitIntoFileBlocks(diff: string): string[] {
  const blocks: string[] = [];
  const lines = diff.split('\n');
  let current: string[] = [];

  for (const line of lines) {
    if (line.startsWith('diff --git') && current.length > 0) {
      blocks.push(current.join('\n'));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) blocks.push(current.join('\n'));

  return blocks;
}

function parseFileBlock(block: string): DiffFile | null {
  const lines = block.split('\n');
  const diffHeader = lines.find((l) => l.startsWith('diff --git'));
  if (!diffHeader) return null;

  let changeType: DiffFile['changeType'] = 'modified';
  let path = '';
  let oldPath: string | undefined;

  const newFileLine = lines.find((l) => l.startsWith('new file mode'));
  const deletedFileLine = lines.find((l) => l.startsWith('deleted file mode'));
  const renameLine = lines.find((l) => l.startsWith('rename from'));

  if (newFileLine) changeType = 'added';
  else if (deletedFileLine) changeType = 'deleted';
  else if (renameLine) {
    changeType = 'renamed';
    oldPath = renameLine.replace('rename from ', '');
  }

  // Extract path from +++ line (most reliable)
  const plusLine = lines.find((l) => l.startsWith('+++ b/'));
  if (plusLine) {
    path = plusLine.slice(6);
  } else {
    // Fallback: parse from diff --git a/... b/...
    const match = diffHeader.match(/diff --git a\/.+ b\/(.+)/);
    if (match) path = match[1];
  }

  if (!path) return null;

  const hunks = parseHunks(lines);
  const additions = lines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).length;
  const deletions = lines.filter((l) => l.startsWith('-') && !l.startsWith('---')).length;

  return { path, changeType, oldPath, hunks, additions, deletions };
}

function parseHunks(lines: string[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      if (current) hunks.push(current);
      current = { header: line, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) hunks.push(current);

  return hunks;
}

export function isUIFile(filePath: string): boolean {
  const uiExtensions = ['.tsx', '.jsx', '.ts', '.js', '.vue', '.svelte', '.css', '.scss', '.html'];
  const uiDirs = ['app/', 'src/', 'components/', 'pages/', 'routes/', 'extensions/', 'blocks/'];
  const nonUIPatterns = [
    '.test.',
    '.spec.',
    '__tests__',
    '.md',
    '.json',
    'package.json',
    'tsconfig',
    '.yml',
    '.yaml',
  ];

  if (nonUIPatterns.some((p) => filePath.includes(p))) return false;
  if (!uiExtensions.some((ext) => filePath.endsWith(ext))) return false;
  return uiDirs.some((dir) => filePath.startsWith(dir)) || filePath.includes('/');
}
