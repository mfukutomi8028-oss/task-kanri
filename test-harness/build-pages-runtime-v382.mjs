// Ver.382: publish only web runtime files; retain all legacy JS/CSS and images for cached browsers.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_EXT = new Set(['.html', '.css', '.js']);
const copy = (source, destination) => {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
};

export function buildPages(sourceRoot = ROOT, target = path.join(sourceRoot, '.pages-runtime')) {
  const root = path.resolve(sourceRoot), output = path.resolve(target);
  if (output === root || !output.startsWith(root + path.sep)) {
    throw new Error('Output must be an isolated subdirectory of source root');
  }
  if (path.relative(root, output).split(path.sep)[0] !== '.pages-runtime') {
    throw new Error('Only .pages-runtime output is allowed');
  }
  if (!fs.existsSync(path.join(root, 'index.html'))
      || !fs.existsSync(path.join(root, 'release-manifest.js'))
      || !fs.existsSync(path.join(root, 'assets'))) {
    throw new Error('Required web runtime files missing');
  }
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  const written = [];
  for (const item of fs.readdirSync(root, { withFileTypes: true })) {
    if (!item.isFile()) continue;
    if (!STATIC_EXT.has(path.extname(item.name)) && item.name !== '.nojekyll') continue;
    copy(path.join(root, item.name), path.join(output, item.name));
    written.push(item.name);
  }
  function assets(directory, relative = '') {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      if (item.isSymbolicLink()) throw new Error('Symlink not allowed in published assets: ' + item.name);
      const rel = path.posix.join('assets', relative, item.name);
      const source = path.join(directory, item.name);
      if (item.isDirectory()) assets(source, path.posix.join(relative, item.name));
      else if (item.isFile()) {
        copy(source, path.join(output, rel));
        written.push(rel);
      }
    }
  }
  assets(path.join(root, 'assets'));
  const manifest = fs.readFileSync(path.join(output, 'release-manifest.js'), 'utf8');
  const index = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  for (const key of ['requiredAssets', 'optionalAssets', 'dynamicScripts', 'dynamicStyles', 'mobileScripts']) {
    const a = manifest.match(new RegExp(key + ':\\s*\\[([\\s\\S]*?)\\]'));
    if (!a) throw new Error('Missing runtime inventory: ' + key);
    for (const [, asset] of a[1].matchAll(/"([^"]+)"/g)) {
      if (!fs.existsSync(path.join(output, asset))) throw new Error('Runtime asset missing: ' + asset);
    }
  }
  const direct = [...index.matchAll(/(?:src|href)="([^"#]+)"/g)]
    .map(x => x[1].split('?')[0])
    .filter(x => !/^(?:https?:|data:|mailto:|tel:|\/)/i.test(x) && !x.startsWith('#'));
  for (const ref of direct) {
    if (!fs.existsSync(path.join(output, ref))) throw new Error('Bootstrap resource missing: ' + ref);
  }
  const bytes = written.reduce((a, rel) => a + fs.statSync(path.join(output, rel)).size, 0);
  return { count: written.length, bytes, files: written.sort() };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildPages();
  process.stdout.write(JSON.stringify({ files: result.count, bytes: result.bytes }) + '\n');
}
