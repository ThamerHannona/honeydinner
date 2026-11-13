#!/usr/bin/env node
'use strict';

/**
 * React Native New Architecture generates RCTThirdPartyComponentsProvider.mm
 * with an NSDictionary literal of NSClassFromString(...) entries. That file is
 * shared by the app and the share extension. Classes not linked into the
 * extension resolve to nil, and @{ ... nil ... } throws:
 *   NSInvalidArgumentException: attempt to insert nil object
 * which kills the extension on launch (share sheet looks stuck).
 *
 * This rewrites the generated assignment to skip nil classes.
 * Idempotent. Safe to run from a CocoaPods post_install hook.
 *
 * Marker: HD_SHARE_EXT_NIL_SAFE
 */

const fs = require('fs');
const path = require('path');

const MARKER = 'HD_SHARE_EXT_NIL_SAFE';

function findProviderFiles(iosRoot) {
  const hits = [];
  const roots = [
    path.join(iosRoot, 'build', 'generated', 'ios'),
    iosRoot,
  ];
  const walk = (dir, depth) => {
    if (depth > 8 || !fs.existsSync(dir)) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === 'Pods' || e.name === '.git') continue;
      const full = path.join(dir, e.name);
      if (e.isFile() && e.name === 'RCTThirdPartyComponentsProvider.mm') hits.push(full);
      else if (e.isDirectory()) walk(full, depth + 1);
    }
  };
  for (const r of roots) walk(r, 0);
  return [...new Set(hits)];
}

function patchContent(content) {
  if (content.includes(MARKER)) return { content, changed: false, reason: 'already patched' };

  const dictRe = /thirdPartyComponents\s*=\s*@\{([\s\S]*?)\n\s*\};/;
  const match = content.match(dictRe);
  if (!match) return { content, changed: false, reason: 'dictionary assignment not found' };

  const entryRe = /@"([^"]+)"\s*:\s*NSClassFromString\(@"([^"]+)"\)\s*,?\s*(?:\/\/\s*(.*))?/g;
  const entries = [];
  let m;
  while ((m = entryRe.exec(match[1])) !== null) {
    entries.push({ name: m[1], className: m[2], comment: (m[3] || '').trim() });
  }

  const lines = entries.map((e) => {
    const c = e.comment ? ` // ${e.comment}` : '';
    return `      { Class cls = NSClassFromString(@"${e.className}"); if (cls) { components[@"${e.name}"] = cls; } }${c}`;
  });

  const replacement =
    `// ${MARKER}: skip nil NSClassFromString entries so the share extension does not crash\n` +
    `    NSMutableDictionary *components = [NSMutableDictionary dictionary];\n` +
    lines.join('\n') + '\n' +
    `    thirdPartyComponents = [components copy];`;

  const next = content.replace(dictRe, replacement);
  if (next === content) return { content, changed: false, reason: 'replace failed' };
  return { content: next, changed: true, reason: `patched ${entries.length} entries`, count: entries.length };
}

function main() {
  const iosRoot = path.resolve(process.argv[2] || path.join(__dirname, '..', 'ios'));
  const files = findProviderFiles(iosRoot);
  if (!files.length) {
    console.log(`[${MARKER}] no RCTThirdPartyComponentsProvider.mm under ${iosRoot}`);
    process.exit(0);
  }
  let any = false;
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const result = patchContent(src);
    console.log(`[${MARKER}] ${file}: ${result.reason}`);
    if (result.changed) {
      fs.writeFileSync(file, result.content);
      any = true;
    }
  }
  process.exit(0);
}

if (require.main === module) main();

module.exports = { patchContent, findProviderFiles, MARKER };
