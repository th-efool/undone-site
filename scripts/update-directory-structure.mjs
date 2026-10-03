import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outputFile = path.join(rootDir, 'plans', 'directory-structure.md');

const IGNORE_PATTERNS = [
  /^\.git$/,
  /^node_modules$/,
  /^\.next$/,
  /^dist$/,
  /^dist-worker$/,
  /^coverage$/,
  /^\.idea$/,
  /^\.DS_Store$/
];

function isIgnored(name) {
  return IGNORE_PATTERNS.some((pattern) => pattern.test(name));
}

let totalDirectories = 0;
let totalFiles = 0;

function buildTree(currentDir, prefix = '') {
  let entries;
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch (err) {
    console.error(`Failed to read directory: ${currentDir}`, err);
    return [];
  }

  const validEntries = entries.filter((entry) => !isIgnored(entry.name));

  const dirs = validEntries
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const files = validEntries
    .filter((entry) => !entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const sorted = [...dirs, ...files];
  const lines = [];

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const isLast = i === sorted.length - 1;
    const pointer = isLast ? '└── ' : '├── ';
    const isDirectory = entry.isDirectory();

    const displayName = isDirectory ? `${entry.name}/` : entry.name;
    lines.push(`${prefix}${pointer}${displayName}`);

    if (isDirectory) {
      totalDirectories++;
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');
      const subLines = buildTree(path.join(currentDir, entry.name), nextPrefix);
      lines.push(...subLines);
    } else {
      totalFiles++;
    }
  }

  return lines;
}

function run() {
  console.log('[update-directory-structure] Generating project directory structure...');
  totalDirectories = 0;
  totalFiles = 0;

  const treeLines = buildTree(rootDir);

  const content = [
    '# Directory Structure',
    '',
    './',
    ...treeLines,
    '',
    `${totalDirectories} directories, ${totalFiles} files`,
    ''
  ].join('\n');

  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, content, 'utf8');
  console.log(`[update-directory-structure] Successfully updated ${outputFile} (${totalDirectories} directories, ${totalFiles} files).`);
}

run();
