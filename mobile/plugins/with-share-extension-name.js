// Shows "Honey, Dinner?" in the iOS share sheet instead of
// "Honey, Dinner? - Share Extension". expo-share-intent writes the extension's
// Info.plist inside its Xcode-project mod, so this hooks the same mod and is listed
// BEFORE expo-share-intent in app.json (mods registered earlier run later).
const { withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withShareExtensionName(config, { displayName } = {}) {
  return withXcodeProject(config, (cfg) => {
    const plist = path.join(cfg.modRequest.platformProjectRoot, 'ShareExtension', 'ShareExtension-Info.plist');
    if (fs.existsSync(plist)) {
      const name = (displayName || cfg.name).replace(/&/g, '&amp;');
      const xml = fs.readFileSync(plist, 'utf8').replace(
        /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/,
        `$1${name}$2`,
      );
      fs.writeFileSync(plist, xml);
    }
    return cfg;
  });
};
