import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const maxLines = 600;
const sourceExtensions = new Set(['.js', '.vue', '.css', '.html', '.md']);
const requiredFiles = [
  'vendor/vue.global.prod.js',
  'vendor/unocss-runtime.global.js',
  'src/platform/sfcLoader.js',
  'src/infrastructure/veeperGateway.js',
  'src/infrastructure/aiGateway.js',
];

const extensionOf = (file) => {
  const index = file.lastIndexOf('.');
  return index >= 0 ? file.slice(index) : '';
};

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === '.tmp' || entry.name === 'vendor') continue;
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

