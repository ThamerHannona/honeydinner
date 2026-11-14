// Patches expo-share-extension's native view controller (copied into the iOS
// target at prebuild). Runs on every install via "postinstall".
//
// Why: TikTok/Instagram share the post link AND the video file. The library
// waits for every attachment to load before drawing anything, and its video
// branch can return without signalling it finished, so the panel hangs on a
// spinner forever. We only need the link/text, so:
//   1. skip image + video attachments entirely
//   2. never wait more than 2.5s for attachments — show the panel regardless
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'node_modules', 'expo-share-extension', 'plugin', 'swift', 'ShareExtensionViewController.swift');
if (!fs.existsSync(file)) {
  console.log('[patch-share-extension] expo-share-extension not installed, skipping');
  process.exit(0);
}
let src = fs.readFileSync(file, 'utf8');
if (src.includes('HD_PATCHED')) {
  console.log('[patch-share-extension] already patched');
  process.exit(0);
}

const swaps = [
  [
    '} else if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {',
    '} else if hdLoadMedia, provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {',
  ],
  [
    '} else if provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {',
    '} else if hdLoadMedia, provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {',
  ],
  [
    'let group = DispatchGroup()',
    'let group = DispatchGroup()\n    let hdLoadMedia = false // HD_PATCHED: Honey, Dinner? only needs links/text',
  ],
  [
    'group.notify(queue: .main) {\n      completion(sharedItems.isEmpty ? nil : sharedItems)\n    }',
    [
      'var hdDone = false // HD_PATCHED: never hang on a slow attachment',
      '    let hdFinish = {',
      '      if hdDone { return }',
      '      hdDone = true',
      '      completion(sharedItems.isEmpty ? nil : sharedItems)',
      '    }',
      '    group.notify(queue: .main) { hdFinish() }',
      '    DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { hdFinish() }',
    ].join('\n'),
  ],
];

for (const [from, to] of swaps) {
  if (!src.includes(from)) {
    console.error('[patch-share-extension] could not find:\n' + from);
    process.exit(1);
  }
  src = src.replace(from, to);
}
fs.writeFileSync(file, src);
console.log('[patch-share-extension] patched ShareExtensionViewController.swift');
