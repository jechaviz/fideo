import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const sourceRoot = process.argv[2] || 'C:/git/customers/fideo/frontend';
const skippedDirs = new Set(['node_modules', 'dist', 'migrated_prompt_history']);
const skippedFiles = new Set(['lint.json', 'package-lock.json']);
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.html', '.md', '.json', '.cjs']);

const extensionOf = (file) => {
  const index = file.lastIndexOf('.');
  return index >= 0 ? file.slice(index) : '';
};

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!skippedDirs.has(entry.name)) files.push(...await walk(join(dir, entry.name)));
      continue;
    }
    if (skippedFiles.has(entry.name)) continue;
    const file = join(dir, entry.name);
    if (extensions.has(extensionOf(file))) files.push(file);
  }
  return files;
};

const classify = (rel) => {
  const key = rel.replaceAll('\\', '/');
  if (key.startsWith('components/ActionCenter') || key.startsWith('hooks/useBusinessData')) return 'operations';
  if (key.startsWith('services/pocketbase') || key.startsWith('hooks/usePocketBaseSession')) return 'pocketbase';
  if (key.startsWith('services/onesignal') || key.startsWith('hooks/useOneSignalPush')) return 'push';
  if (key.startsWith('services/gemini') || key.includes('AI')) return 'ai';
  if (key.startsWith('components/inventory') || key.includes('Inventory')) return 'inventory';
  if (rel.includes('Customer')) return 'customers';
  if (rel.includes('Supplier')) return 'suppliers';
  if (rel.includes('Deliver')) return 'deliveries';
  if (rel.includes('Finance')) return 'finances';
  if (key.startsWith('views')) return 'portals';
  if (key.startsWith('utils')) return 'shared-utils';
  if (key.startsWith('docs')) return 'docs';
  if (key.includes('config') || key.endsWith('.json')) return 'config';
  return 'shell';
};

const files = await walk(sourceRoot);
const rows = await Promise.all(files.map(async (file) => {
  const rel = relative(sourceRoot, file);
  const info = await stat(file);
  return { rel, bytes: info.size, domain: classify(rel) };
}));

const byDomain = rows.reduce((acc, row) => {
  acc[row.domain] ||= { files: 0, bytes: 0 };
  acc[row.domain].files += 1;
  acc[row.domain].bytes += row.bytes;
  return acc;
}, {});

console.log(JSON.stringify({
  sourceRoot,
  totalFiles: rows.length,
  byDomain,
  largest: rows.toSorted((left, right) => right.bytes - left.bytes).slice(0, 12),
  rows: rows.sort((left, right) => left.rel.localeCompare(right.rel)),
}, null, 2));
