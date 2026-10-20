// Ver.506: read-only fingerprint of the exact staged Pages file names and bytes.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function fingerprintPagesDirectory(directory) {
  const root = path.resolve(directory);
  if (!fs.lstatSync(root).isDirectory()) throw new Error('Pages stage is not a directory: ' + root);
  const records = [];
  function walk(current, prefix = '') {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const name = prefix ? prefix + '/' + entry.name : entry.name;
      const source = path.join(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Pages stage contains a symlink: ' + name);
      if (entry.isDirectory()) walk(source, name);
      else if (entry.isFile()) {
        const content = fs.readFileSync(source);
        records.push({
          name,
          bytes: content.length,
          sha256: createHash('sha256').update(content).digest('hex')
        });
      } else throw new Error('Pages stage contains an unsupported entry: ' + name);
    }
  }
  walk(root);
  if (records.length === 0) throw new Error('Pages stage has no files');
  records.sort((a, b) => Buffer.compare(Buffer.from(a.name, 'utf8'), Buffer.from(b.name, 'utf8')));
  const digest = createHash('sha256');
  digest.update('work-board-pages-payload-v506\n');
  for (const file of records) {
    digest.update(JSON.stringify([file.name, file.bytes, file.sha256]) + '\n');
  }
  return {
    files: records.length,
    bytes: records.reduce((sum, file) => sum + file.bytes, 0),
    sha256: digest.digest('hex')
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const directory = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, '.pages-runtime');
  console.log('PAGES_PAYLOAD_FINGERPRINT ' + JSON.stringify(fingerprintPagesDirectory(directory)));
}
