// Raises every pod target's IPHONEOS_DEPLOYMENT_TARGET to at least MIN (Xcode 27 rejects <15).
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MIN = '15.1';
const TAG = '# withPodDeploymentTarget';

module.exports = function withPodDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let src = fs.readFileSync(file, 'utf8');
      if (src.includes(TAG)) return cfg;
      const snippet = `
    ${TAG}
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |c|
        cur = c.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if cur.nil? || Gem::Version.new(cur.to_s) < Gem::Version.new('${MIN}')
          c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN}'
        end
      end
    end
`;
      if (/post_install do \|installer\|\n/.test(src)) {
        src = src.replace(/post_install do \|installer\|\n/, (m) => m + snippet);
      } else {
        src += `\npost_install do |installer|${snippet}end\n`;
      }
      fs.writeFileSync(file, src);
      return cfg;
    },
  ]);
};
