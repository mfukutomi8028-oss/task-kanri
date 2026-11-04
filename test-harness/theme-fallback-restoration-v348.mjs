/* Test-only compatibility for immutable Classic CSS history (Ver.348).
 * Current CSS uses var(--wb-ui-*, original-literal). This parser recreates
 * exactly the old source bytes without shipping a second implementation.
 */
import { createHash } from 'node:crypto';

export function restoreLegacyThemeCss(source) {
  const input = String(source);
  const marker = 'var(--wb-ui-';
  let pos = 0;
  let output = '';
  for (;;) {
    const at = input.indexOf(marker, pos);
    if (at < 0) return output + input.slice(pos);
    output += input.slice(pos, at);
    let depth = 0;
    let comma = -1;
    let end = -1;
    for (let i = at; i < input.length; i += 1) {
      if (input[i] === '(') depth++;
      else if (input[i] === ')') {
        depth--;
        if (depth === 0) { end = i; break; }
      } else if (input[i] === ',' && depth === 1 && comma < 0) comma = i;
    }
    if (comma < 0 || end < 0) throw new Error('Malformed Ver.348 CSS fallback');
    output += input.slice(comma + 1, end);
    pos = end + 1;
  }
}

export function historicalThemeCssBlobSha(source) {
  const bytes = Buffer.from(restoreLegacyThemeCss(source), 'utf8');
  return createHash('sha1')
    .update('blob ' + bytes.length + '\0')
    .update(bytes)
    .digest('hex');
}
