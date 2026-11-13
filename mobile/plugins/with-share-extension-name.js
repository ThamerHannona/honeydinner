// Shows "Honey, Dinner?" in the iOS share sheet instead of
// "Honey, Dinner? Share Extension". The share-extension plugin writes the extension's
// Info.plist inside its Info.plist mod, so this hooks the same mod and is listed
// BEFORE that plugin in app.json (mods registered earlier run later).
const { withInfoPlist } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withShareExtensionName(config, { displayName } = {}) {
  return withInfoPlist(config, (cfg) => {
    const root = cfg.modRequest.platformProjectRoot;
    const name = (displayName || cfg.name).replace(/&/g, '&amp;');
    for (const dir of fs.readdirSync(root)) {
      if (!/ShareExtension$/.test(dir)) continue;
      for (const file of ['Info.plist', 'ShareExtension-Info.plist']) {
        const plist = path.join(root, dir, file);
        if (!fs.existsSync(plist)) continue;
        const xml = fs.readFileSync(plist, 'utf8').replace(
          /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/,
          `$1${name}$2`,
        );
        fs.writeFileSync(plist, xml);
      }
    }
    return cfg;
  });
};
