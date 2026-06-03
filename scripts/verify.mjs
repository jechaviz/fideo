import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const maxLines = 600;
const sourceExtensions = new Set(['.js', '.mjs', '.vue', '.css', '.html', '.md']);
const requiredFiles = [
  'vendor/vue.runtime.global.prod.js',
  'vendor/unocss-runtime.global.js',
  'vendor/fonts/manrope/manrope-latin-400-normal.woff2',
  'vendor/fonts/manrope/manrope-latin-500-normal.woff2',
  'vendor/fonts/manrope/manrope-latin-600-normal.woff2',
  'vendor/fonts/manrope/manrope-latin-700-normal.woff2',
  'vendor/fonts/manrope/manrope-latin-800-normal.woff2',
  'vendor/fonts/ibm-plex-mono/ibm-plex-mono-latin-400-normal.woff2',
  'vendor/fonts/ibm-plex-mono/ibm-plex-mono-latin-500-normal.woff2',
  'vendor/fonts/ibm-plex-mono/ibm-plex-mono-latin-600-normal.woff2',
  'styles/fonts.css',
  'src/platform/unocssConfig.js',
  'src/platform/sfcLoader.js',
  'src/infrastructure/veeperGateway.js',
  'src/infrastructure/aiGateway.js',
  'src/infrastructure/aiProviderCatalog.js',
  'scripts/kilo-bridge.mjs',
];

const extensionOf = (file) => {
  const index = file.lastIndexOf('.');
  return index >= 0 ? file.slice(index) : '';
};

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === '.tmp' || entry.name === '.audit' || entry.name === 'vendor') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

for (const file of requiredFiles) {
  await stat(join(root, file));
}

const files = (await walk(root)).filter((file) => sourceExtensions.has(extensionOf(file)));
for (const file of files) {
  const text = await readFile(file, 'utf8');
  const lines = text.split(/\r?\n/).length;
  assert(lines <= maxLines, `${relative(root, file)} has ${lines} lines`);

  if (file.endsWith('.vue')) {
    assert(/<template>[\s\S]*<\/template>/i.test(text), `${relative(root, file)} missing template`);
    assert(/<script[\s\S]*>[\s\S]*<\/script>/i.test(text), `${relative(root, file)} missing script`);
  }
}

const index = await readFile(join(root, 'index.html'), 'utf8');
assert(!/https?:\/\/.*<script/i.test(index), 'remote script detected in index.html');
assert(index.includes('Content-Security-Policy'), 'CSP missing');

console.log(`FideoVue verification passed for ${files.length} source files.`);
