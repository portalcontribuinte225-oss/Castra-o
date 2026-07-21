/**
 * Removes CSS rules whose leading class is in the unused list.
 * Algorithm: for each rule, check the FIRST class in EACH selector.
 * Only removes if ALL selectors have their first class in the unused set.
 * Keeps rules that touch any used class (conservative).
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const CSS_PATH = 'src/styles.css';
const SRC_FILES = [
  'src/App.tsx',
  'src/components/ui.tsx',
  'src/domain.ts',
  'src/features/accessRequests.tsx',
  'src/features/agenda.tsx',
  'src/features/dashboard.tsx',
  'src/features/reports.tsx',
];

// ── 1. Collect all CSS class names defined in styles.css ─────────────
const css = readFileSync(CSS_PATH, 'utf8');

const defined = new Set();
for (const m of css.matchAll(/^\s*\.([a-zA-Z][a-zA-Z0-9_-]+)/gm)) {
  defined.add(m[1]);
}

// ── 2. Collect all class names referenced in source files ────────────
const sourceText = SRC_FILES.map(f => { try { return readFileSync(f, 'utf8'); } catch { return ''; } }).join('\n');

const used = new Set();
for (const cls of defined) {
  // Match the class name as a word (possibly surrounded by quotes, spaces, template expressions)
  const re = new RegExp(`(?<![a-zA-Z0-9_-])${cls.replace(/[-]/g, '\\-')}(?![a-zA-Z0-9_-])`);
  if (re.test(sourceText)) used.add(cls);
}

const unused = new Set([...defined].filter(c => !used.has(c)));

console.log(`Defined: ${defined.size}  Used: ${used.size}  Unused: ${unused.size}`);

// ── 3. Parse CSS and filter out dead rules ────────────────────────────

/**
 * Given a selector string, returns the first CSS class name in it.
 * ".adoption-card .title" → "adoption-card"
 * ".modal .adoption-card" → "modal"
 */
function leadingClass(selector) {
  const m = selector.trimStart().match(/^\.([a-zA-Z][a-zA-Z0-9_-]*)/);
  return m ? m[1] : null;
}

/**
 * Returns true if EVERY comma-separated sub-selector has its leading
 * class in the unused set. If a sub-selector has no leading class (e.g.
 * element selectors, :root, @rules), we keep the rule.
 */
function allSelectorsUnused(selectorBlock) {
  const parts = selectorBlock.split(',');
  for (const part of parts) {
    const cls = leadingClass(part);
    if (cls === null) return false;     // non-class selector → keep
    if (!unused.has(cls)) return false; // at least one used class → keep
  }
  return true;
}

/**
 * Strips CSS rules whose leading class is fully unused.
 * Handles nested @-rules (media queries etc.) recursively.
 * Returns [cleaned_css, removed_count].
 */
function purge(input) {
  let out = '';
  let i = 0;
  let removed = 0;
  const len = input.length;

  while (i < len) {
    // Skip whitespace / newlines
    const wsStart = i;
    while (i < len && /\s/.test(input[i])) i++;

    if (i >= len) {
      out += input.slice(wsStart, i);
      break;
    }

    // Comments
    if (input[i] === '/' && input[i + 1] === '*') {
      const end = input.indexOf('*/', i + 2);
      if (end === -1) { out += input.slice(i); break; }
      out += input.slice(wsStart, end + 2);
      i = end + 2;
      continue;
    }

    // Find the next '{' to get the selector/at-rule head
    const headStart = i;
    let depth = 0;
    while (i < len && input[i] !== '{') i++;
    if (i >= len) { out += input.slice(wsStart); break; }

    const head = input.slice(headStart, i).trim();
    i++; // consume '{'

    // Find the matching closing '}'
    const bodyStart = i;
    depth = 1;
    while (i < len && depth > 0) {
      if (input[i] === '{') depth++;
      else if (input[i] === '}') depth--;
      i++;
    }
    const body = input.slice(bodyStart, i - 1); // content between { }

    const isAtRule = head.startsWith('@');

    if (isAtRule) {
      // Recurse into @media, @keyframes etc.
      const [innerCleaned, innerRemoved] = purge(body);
      removed += innerRemoved;
      const cleanedBody = innerCleaned.trim();
      if (cleanedBody.length > 0) {
        out += input.slice(wsStart, wsStart + (headStart - wsStart)); // leading ws
        out += `${head} {\n${innerCleaned}}\n`;
      }
      // if empty after purge, drop the whole @block silently
    } else {
      // Regular rule — decide keep/remove
      if (allSelectorsUnused(head)) {
        removed++;
        // drop the block (don't write to out)
      } else {
        out += input.slice(wsStart, wsStart + (headStart - wsStart)); // leading ws
        out += `${head} {${body}}\n`;
      }
    }
  }

  return [out, removed];
}

const [cleaned, removed] = purge(css);

console.log(`Removed ${removed} rule blocks.`);
console.log(`Original size: ${(css.length / 1024).toFixed(1)} KB`);
console.log(`Cleaned size:  ${(cleaned.length / 1024).toFixed(1)} KB`);

writeFileSync(CSS_PATH, cleaned, 'utf8');
console.log('Done — styles.css updated.');
