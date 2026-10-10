// Ver.382: publish only web runtime files; retain all legacy JS/CSS and images for cached browsers.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_EXT = new Set(['.html', '.css', '.js']);
// Keep historical CSS request URLs available in Pages without duplicate Git files.
export const LEGACY_CSS_ALIASES = Object.freeze({
  'activity-dialog-v130.css': 'ui-activity-dialog-v193.css',
  'list-sort-v131.css': 'ui-task-list-sort-v193.css',
  'ui-v148.css': 'ui-workflow-insights-v192.css',
  'ui-v149.css': 'ui-task-prerequisites-comments-v192.css',
  'ui-v150.css': 'ui-task-relations-reminders-v192.css',
  'ui-v151.css': 'ui-task-detail-responsive-v192.css',
  'ui-v154.css': 'ui-task-detail-tools-v192.css',
});

// Keep old JavaScript, stylesheet, and image URLs while deduplicating Git storage.
export const LEGACY_RUNTIME_ALIASES = Object.freeze({
  ...LEGACY_CSS_ALIASES,
  'user-add-fix-v155.js': 'user-registration-v191.js',
  'ui-v156.css': 'ui-comment-mentions-v191.css',
  'assets/summary-today.png': 'assets/nav-today-v87.png',
  'assets/brand-v184.png': 'assets/brand.png',
});

export const FROZEN_MOBILE_SCRIPT_BLOBS = Object.freeze({
  'mobile-board-scroll-fix.js': '984cab660098f133e5490a3d6fb21ccb7f806308',
  'mobile-interaction-filter-v104.js': 'f1ab7249e7ea777fd2d31d9bc099dd86029f2c8d',
  'mobile-native-scroll-version-v106.js': '831e40713d0e52796864c6cda2d29e6ecb54bb8e',
  'mobile-native-tabs-today-filter-v105.js': 'd6eb3592c0ed1e06c98a842dcc001a502b473201',
  'mobile-safe-final-v107.js': 'd36dfc519bd34d48ccd3a8c28109949b3d5f064b',
  'mobile-scroll-unlock-v103.js': '85e49c71e33df57d4bc73b0f1579150a25267853',
});

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
  const declaredAssets = new Set();
  for (const key of ['requiredAssets', 'optionalAssets', 'dynamicScripts', 'dynamicStyles', 'mobileScripts']) {
    const a = manifest.match(new RegExp(key + ':\\s*\\[([\\s\\S]*?)\\]'));
    if (!a) throw new Error('Missing runtime inventory: ' + key);
    for (const [, asset] of a[1].matchAll(/"([^"]+)"/g)) {
      declaredAssets.add(asset);
    }
  }
  // Current release retains historical JS/CSS/image URLs without duplicate tracked files.
  // Synthetic minimal fixtures without the semantic CSS inventory remain unaffected.
  if (declaredAssets.has('ui-activity-dialog-v193.css')) {
    for (const [legacy, current] of Object.entries(LEGACY_RUNTIME_ALIASES)) {
      if (/\.(?:js|css)$/i.test(current) && !declaredAssets.has(current)) throw new Error('Legacy asset target not declared: ' + current);
      if (declaredAssets.has(legacy) && !declaredAssets.has(current)) throw new Error('Required asset alias target not declared: ' + current);
      if (fs.existsSync(path.join(root, legacy))) throw new Error('Legacy asset still tracked: ' + legacy);
      const source = path.join(output, current);
      if (!fs.existsSync(source)) throw new Error('Legacy asset alias target missing: ' + current);
      copy(source, path.join(output, legacy));
      written.push(legacy);
    }
  }
  // Preserve immutable mobile-era JavaScript URLs without keeping six live root files.
  if (declaredAssets.has('ui-activity-dialog-v193.css')) {
    const archiveFile = path.join(root, 'compat/frozen-mobile-scripts-v395.json');
    if (!fs.existsSync(archiveFile)) throw new Error('Frozen legacy mobile archive is missing');
    const archive = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
    const expected = Object.keys(FROZEN_MOBILE_SCRIPT_BLOBS).sort();
    if (JSON.stringify(Object.keys(archive).sort()) !== JSON.stringify(expected)) {
      throw new Error('Frozen legacy mobile archive keys do not match the immutable inventory');
    }
    for (const [legacy, expectedSha] of Object.entries(FROZEN_MOBILE_SCRIPT_BLOBS)) {
      if (fs.existsSync(path.join(root, legacy))) throw new Error('Frozen legacy asset still tracked: ' + legacy);
      if (typeof archive[legacy] !== 'string') throw new Error('Frozen legacy asset is not text: ' + legacy);
      const bytes = Buffer.from(archive[legacy], 'utf8');
      const sha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
      if (sha !== expectedSha) throw new Error('Frozen legacy asset SHA mismatch: ' + legacy);
      fs.writeFileSync(path.join(output, legacy), bytes);
      written.push(legacy);
    }
  }
  // Resolve manifest requirements against the staged Pages package, including its byte-identical aliases.
  for (const asset of declaredAssets) {
    if (!fs.existsSync(path.join(output, asset))) throw new Error('Runtime asset missing: ' + asset);
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
