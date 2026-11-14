// Fixes the iOS share extension in Expo SDK 54 / New Architecture:
//
// 1) After pod install, patch RCTThirdPartyComponentsProvider.mm so
//    NSClassFromString nil entries cannot crash the main app (kept as a
//    safety net; the extension itself no longer loads React Native).
// 2) Replace the React-hosted ShareExtensionViewController with a pure
//    UIKit panel (HD_NATIVE_SHARE_PANEL) that calls import-recipe itself,
//    writes the App Group inbox + share-extension.log, and never starts RN.
// 3) Remove use_react_native! / Expo modules from the extension Podfile
//    target so React, Hermes, and ReactNativeDependencies are not linked.
// 4) Strip UIApplicationSceneManifest from the extension Info.plist only
//    and inject SupabaseUrl / SupabaseAnonKey for the import call.
//
// Listed BEFORE expo-share-extension in app.json so these mods run after it
// writes the extension files. Does not touch the main app's UI or screens.
const { withDangerousMod, withInfoPlist, withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TAG = 'with-share-extension-fixes';
const POD_TAG = '# with-share-extension-fixes codegen patch';
const SWIFT_MARK = 'HD_SHARE_EXT_CHROME';

function extensionDirs(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter((d) => /ShareExtension$/.test(d));
}

function patchPodfile(podfilePath) {
  let src = fs.readFileSync(podfilePath, 'utf8');
  if (src.includes('HD_SHARE_EXT_NIL_SAFE_GENSPECS')) return false;
  const snippet = `
    ${POD_TAG}
    codegen_patch = File.expand_path('../plugins/patch-rct-third-party-components.js', __dir__)
    if File.exist?(codegen_patch)
      puts "[ShareExtension] Patching RCTThirdPartyComponentsProvider.mm for nil-safety"
      system('node', codegen_patch, __dir__) || Pod::UI.warn('Share extension codegen patch failed')
    end
    # Xcode's [CP-User] Generate Specs regenerates the provider after pod
    # install and would compile the unpatched nil-crashing dictionary.
    installer.pods_project.targets.each do |target|
      target.build_phases.each do |phase|
        next unless phase.respond_to?(:name) && phase.respond_to?(:shell_script)
        next unless phase.name.to_s.include?('Generate Specs')
        next if phase.shell_script.include?('HD_SHARE_EXT_NIL_SAFE_GENSPECS')
        phase.shell_script += %(
# HD_SHARE_EXT_NIL_SAFE_GENSPECS
echo "[ShareExtension] Re-applying nil-safe patch after Generate Specs"
node "#{codegen_patch}" "#{__dir__}" || echo "Share extension codegen patch failed"
)
      end
    end
`;
  if (src.includes(POD_TAG)) {
    // Upgrade an older hook that only patched at pod install time.
    src = src.replace(POD_TAG, snippet.trimStart());
  } else if (/post_install do \|installer\|\n/.test(src)) {
    src = src.replace(/post_install do \|installer\|\n/, (m) => m + snippet);
  } else {
    src += `\npost_install do |installer|${snippet}end\n`;
  }
  fs.writeFileSync(podfilePath, src);
  return true;
}

function patchExtensionPlist(root) {
  for (const dir of extensionDirs(root)) {
    for (const file of ['Info.plist', 'ShareExtension-Info.plist']) {
      const plist = path.join(root, dir, file);
      if (!fs.existsSync(plist)) continue;
      let xml = fs.readFileSync(plist, 'utf8');
      const next = xml.replace(
        /\s*<key>UIApplicationSceneManifest<\/key>\s*<dict>[\s\S]*?<\/dict>/,
        '',
      );
      if (next !== xml) {
        fs.writeFileSync(plist, next);
        xml = next;
      }
    }
  }
}

const CHROME_HELPERS = `
  // ${SWIFT_MARK}: show a cream panel immediately, log to the App Group, and
  // do not wait forever for share-sheet attachments before starting RN.
  private let hdChromeTag = 0x48444352

  override func loadView() {
    let v = UIView(frame: UIScreen.main.bounds)
    v.backgroundColor = .clear
    self.view = v
    setupImmediateChrome()
    logExt("loadView ${SWIFT_MARK}")
  }

  private func logExt(_ message: String) {
    let line = "\\(ISO8601DateFormatter().string(from: Date())) \\(message)\\n"
    print("[ShareExtension] \\(message)")
    NSLog("[ShareExtension] %@", message)
    guard
      let appGroup = Bundle.main.object(forInfoDictionaryKey: "AppGroup") as? String,
      let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
    else { return }
    let url = container.appendingPathComponent("share-extension.log")
    guard let data = line.data(using: .utf8) else { return }
    if FileManager.default.fileExists(atPath: url.path) {
      if let handle = try? FileHandle(forWritingTo: url) {
        defer { try? handle.close() }
        handle.seekToEndOfFile()
        handle.write(data)
      }
    } else {
      try? data.write(to: url)
    }
  }

  private func setupImmediateChrome() {
    if view.viewWithTag(hdChromeTag) != nil { return }
    view.backgroundColor = .clear
    let cream = UIColor(red: 244.0 / 255.0, green: 237.0 / 255.0, blue: 224.0 / 255.0, alpha: 1)
    let ink = UIColor(red: 20.0 / 255.0, green: 17.0 / 255.0, blue: 13.0 / 255.0, alpha: 1)
    let green = UIColor(red: 29.0 / 255.0, green: 175.0 / 255.0, blue: 58.0 / 255.0, alpha: 1)
    let onGreen = UIColor(red: 251.0 / 255.0, green: 246.0 / 255.0, blue: 234.0 / 255.0, alpha: 1)
    let height = CGFloat((Bundle.main.object(forInfoDictionaryKey: "ShareExtensionHeight") as? NSNumber)?.doubleValue ?? 620)

    let panel = UIView()
    panel.tag = hdChromeTag
    panel.backgroundColor = cream
    panel.layer.cornerRadius = 28
    panel.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
    panel.layer.borderWidth = 1.5
    panel.layer.borderColor = ink.cgColor
    panel.clipsToBounds = true
    panel.translatesAutoresizingMaskIntoConstraints = false
    view.insertSubview(panel, at: 0)
    NSLayoutConstraint.activate([
      panel.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      panel.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      panel.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      panel.heightAnchor.constraint(equalToConstant: height),
    ])

    let grabber = UIView()
    grabber.backgroundColor = UIColor(red: 216.0 / 255.0, green: 205.0 / 255.0, blue: 185.0 / 255.0, alpha: 1)
    grabber.layer.cornerRadius = 3
    grabber.translatesAutoresizingMaskIntoConstraints = false
    panel.addSubview(grabber)

    let logo = UILabel()
    logo.text = "HONEY, DINNER?"
    logo.textColor = onGreen
    logo.font = UIFont.systemFont(ofSize: 15, weight: .black)
    logo.textAlignment = .center
    logo.translatesAutoresizingMaskIntoConstraints = false
    let logoWrap = UIView()
    logoWrap.backgroundColor = green
    logoWrap.layer.cornerRadius = 8
    logoWrap.layer.borderWidth = 1.5
    logoWrap.layer.borderColor = ink.cgColor
    logoWrap.translatesAutoresizingMaskIntoConstraints = false
    logoWrap.addSubview(logo)

    let title = UILabel()
    title.text = "Reading the recipe…"
    title.textColor = ink
    title.font = UIFont.systemFont(ofSize: 24, weight: .bold)
    title.translatesAutoresizingMaskIntoConstraints = false

    panel.addSubview(logoWrap)
    panel.addSubview(title)
    NSLayoutConstraint.activate([
      grabber.topAnchor.constraint(equalTo: panel.topAnchor, constant: 8),
      grabber.centerXAnchor.constraint(equalTo: panel.centerXAnchor),
      grabber.widthAnchor.constraint(equalToConstant: 40),
      grabber.heightAnchor.constraint(equalToConstant: 5),
      logo.topAnchor.constraint(equalTo: logoWrap.topAnchor, constant: 6),
      logo.bottomAnchor.constraint(equalTo: logoWrap.bottomAnchor, constant: -6),
      logo.leadingAnchor.constraint(equalTo: logoWrap.leadingAnchor, constant: 10),
      logo.trailingAnchor.constraint(equalTo: logoWrap.trailingAnchor, constant: -10),
      logoWrap.topAnchor.constraint(equalTo: grabber.bottomAnchor, constant: 16),
      logoWrap.leadingAnchor.constraint(equalTo: panel.leadingAnchor, constant: 20),
      title.topAnchor.constraint(equalTo: logoWrap.bottomAnchor, constant: 16),
      title.leadingAnchor.constraint(equalTo: panel.leadingAnchor, constant: 20),
      title.trailingAnchor.constraint(equalTo: panel.trailingAnchor, constant: -20),
    ])
  }

  private func hideImmediateChrome() {
    view.viewWithTag(hdChromeTag)?.isHidden = true
  }
`;

function patchSwift(file) {
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes(SWIFT_MARK)) return false;

  if (!src.includes('override func viewDidLoad()')) {
    throw new Error(`ShareExtensionViewController.swift missing viewDidLoad: ${file}`);
  }

  src = src.replace(
    /override func viewDidLoad\(\) \{\n\s*super\.viewDidLoad\(\)\n/,
    (m) =>
      `${m}    logExt("viewDidLoad ${SWIFT_MARK}")\n    setupImmediateChrome()\n    NSSetUncaughtExceptionHandler { exception in\n      let reason = exception.reason ?? "unknown"\n      let name = exception.name.rawValue\n      let message = "uncaught \\(name): \\(reason)"\n      print("[ShareExtension] \\(message)")\n      NSLog("[ShareExtension] %@", message)\n      if let appGroup = Bundle.main.object(forInfoDictionaryKey: "AppGroup") as? String,\n         let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup),\n         let data = "\\(ISO8601DateFormatter().string(from: Date())) \\(message)\\n".data(using: .utf8) {\n        let url = container.appendingPathComponent("share-extension.log")\n        if FileManager.default.fileExists(atPath: url.path), let handle = try? FileHandle(forWritingTo: url) {\n          handle.seekToEndOfFile(); handle.write(data); try? handle.close()\n        } else { try? data.write(to: url) }\n      }\n    }\n`,
  );

  // Start RN even if attachment loading hangs (common with some host apps).
  if (!src.includes('private func loadReactNativeContent()')) {
    throw new Error(`ShareExtensionViewController.swift missing loadReactNativeContent: ${file}`);
  }
  src = src.replace(
    'private func loadReactNativeContent() {\n    getShareData { [weak self] sharedData in\n      guard let self = self else {\n        print("❌ Self was deallocated")\n        return\n      }\n',
    `private func loadReactNativeContent() {\n    var delivered = false\n    let deliver: ([String: Any]?) -> Void = { [weak self] sharedData in\n      guard let self = self, !delivered else { return }\n      delivered = true\n      self.logExt("starting React Native; keys=\\(Array((sharedData ?? [:]).keys))")\n      self.startReactNative(sharedData: sharedData)\n    }\n    getShareData { deliver($0) }\n    DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {\n      deliver(nil)\n    }\n  }\n\n  private func startReactNative(sharedData: [String: Any]?) {\n`,
  );
  src = src.replace(
    `      self.loadingIndicator.stopAnimating()
      self.loadingIndicator.removeFromSuperview()
    }
  }`,
    `      self.loadingIndicator.stopAnimating()
      self.loadingIndicator.removeFromSuperview()
  }`,
  );

  // Defer React Native until after this run loop so the cream panel can paint.
  // Starting RN in the same viewDidLoad turn can crash (unpatched Fabric
  // provider) before the first frame, which looks like a frozen share sheet.
  if (src.includes('deferred loadReactNativeContent')) {
    // already rewritten
  } else if (src.includes('    loadReactNativeContent()\n    setupNotificationCenterObserver()')) {
    src = src.replace(
      '    loadReactNativeContent()\n    setupNotificationCenterObserver()\n',
      '    DispatchQueue.main.async { [weak self] in\n      self?.logExt("deferred loadReactNativeContent")\n      self?.loadReactNativeContent()\n    }\n    setupNotificationCenterObserver()\n',
    );
  } else {
    throw new Error(`ShareExtensionViewController.swift missing loadReactNativeContent() call: ${file}`);
  }

  // Hide the native chrome once the RN view is on screen (keeps the designed
  // transparent-around-card look when React Native starts successfully).
  src = src.replace(
    'view.addSubview(reactNativeRootView)\n',
    'view.addSubview(reactNativeRootView)\n      hideImmediateChrome()\n      logExt("React Native root view attached")\n',
  );

  // Insert helpers before the final class closing brace.
  const lastBrace = src.lastIndexOf('\n}');
  if (lastBrace === -1) throw new Error('could not find class closing brace');
  src = src.slice(0, lastBrace) + '\n' + CHROME_HELPERS + src.slice(lastBrace);

  fs.writeFileSync(file, src);
  return true;
}

const NATIVE_MARK = 'HD_NATIVE_SHARE_PANEL';
const NATIVE_SRC = path.join(__dirname, 'native-share', 'ShareExtensionViewController.swift');

function slimExtensionPodfile(podfilePath) {
  let src = fs.readFileSync(podfilePath, 'utf8');
  if (src.includes('HD_NATIVE_SHARE_NO_RN')) return false;
  const start = src.search(/target\s+'[^']*ShareExtension'\s+do/);
  if (start < 0) {
    console.warn(`[${TAG}] could not find ShareExtension Podfile target`);
    return false;
  }
  const nameMatch = src.slice(start).match(/target\s+'([^']*ShareExtension)'/);
  const name = nameMatch ? nameMatch[1] : 'HoneyDinnerShareExtension';
  const after = src.slice(start);
  const rn = after.search(/use_react_native!/);
  let endRel = -1;
  if (rn >= 0) {
    const close = after.slice(rn).search(/\nend\b/);
    if (close >= 0) endRel = rn + close + '\nend'.length;
  }
  if (endRel < 0) {
    // Last resort: the final top-level end after this target.
    const close = after.search(/\nend\s*$/);
    if (close >= 0) endRel = close + '\nend'.length;
  }
  if (endRel < 0) {
    console.warn(`[${TAG}] could not slim ShareExtension Podfile target`);
    return false;
  }
  const slim = `target '${name}' do\n  # HD_NATIVE_SHARE_NO_RN\n  # Pure UIKit share panel: do not link React, Hermes, or Expo modules.\nend`;
  src = src.slice(0, start) + slim + after.slice(endRel);
  fs.writeFileSync(podfilePath, src);
  console.log(`[${TAG}] slimmed ShareExtension Podfile target (no React Native)`);
  return true;
}

function supabaseEnv(projectRoot) {
  const fromEnv = {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
  if (fromEnv.url && fromEnv.key) return fromEnv;
  try {
    const eas = JSON.parse(fs.readFileSync(path.join(projectRoot, 'eas.json'), 'utf8'));
    const env = (eas.build && eas.build.production && eas.build.production.env) || {};
    return {
      url: fromEnv.url || env.EXPO_PUBLIC_SUPABASE_URL || 'https://rzacuyrcbujcnkpoktyg.supabase.co',
      key: fromEnv.key || env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    };
  } catch {
    return { url: fromEnv.url || 'https://rzacuyrcbujcnkpoktyg.supabase.co', key: fromEnv.key || '' };
  }
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setPlistString(xml, key, value) {
  const block = `  <key>${key}</key>\n  <string>${xmlEscape(value)}</string>\n`;
  const re = new RegExp(`\\s*<key>${key}<\\/key>\\s*<string>[\\s\\S]*?<\\/string>`);
  if (re.test(xml)) return xml.replace(re, '\n' + block.replace(/\n$/, ''));
  const last = xml.lastIndexOf('</dict>');
  if (last >= 0) return xml.slice(0, last) + block + xml.slice(last);
  return xml;
}

function injectExtensionKeys(root, projectRoot) {
  const { url, key } = supabaseEnv(projectRoot);
  if (!key) console.warn(`[${TAG}] SupabaseAnonKey missing; import-recipe will fail until EAS env is present`);
  for (const dir of extensionDirs(root)) {
    for (const file of ['Info.plist', 'ShareExtension-Info.plist']) {
      const plist = path.join(root, dir, file);
      if (!fs.existsSync(plist)) continue;
      let xml = fs.readFileSync(plist, 'utf8');
      xml = setPlistString(xml, 'SupabaseUrl', url);
      xml = setPlistString(xml, 'SupabaseAnonKey', key);
      fs.writeFileSync(plist, xml);
    }
  }
}


function stripExtensionRnPhases(project) {
  const natives = project.pbxNativeTargetSection();
  for (const key of Object.keys(natives)) {
    const t = natives[key];
    if (!t || typeof t !== 'object' || !t.buildPhases) continue;
    const name = String(t.name || '').replace(/"/g, '');
    if (!/ShareExtension$/.test(name)) continue;
    const before = t.buildPhases.length;
    t.buildPhases = t.buildPhases.filter((phase) => {
      const comment = String(phase.comment || '');
      const skip = /Start Packager|Bundle React Native|Compile RCT|\[CP-User\] Generate Specs/.test(comment);
      if (skip) console.log(`[${TAG}] removed build phase "${comment}" from ${name}`);
      return !skip;
    });
    console.log(`[${TAG}] ${name} build phases ${before} -> ${t.buildPhases.length}`);
  }
}

function installNativeShareController(root, projectRoot) {
  if (!fs.existsSync(NATIVE_SRC)) {
    throw new Error(`Native share controller missing: ${NATIVE_SRC}`);
  }
  const { url, key } = supabaseEnv(projectRoot);
  let body = fs.readFileSync(NATIVE_SRC, 'utf8');
  body = body
    .replaceAll('__HD_SUPABASE_URL__', url || '')
    .replaceAll('__HD_SUPABASE_ANON_KEY__', key || '');
  if (body.includes('__HD_SUPABASE_')) {
    throw new Error('Failed to bake Supabase constants into the native share panel');
  }
  let wrote = 0;
  for (const dir of extensionDirs(root)) {
    const dest = path.join(root, dir, 'ShareExtensionViewController.swift');
    fs.writeFileSync(dest, body);
    wrote += 1;
    console.log(`[${TAG}] installed native panel at ${dest}`);
  }
  return wrote;
}


module.exports = function withShareExtensionFixes(config) {
  config = withDangerousMod(config, [
    'ios',
    (cfg) => {
      const pod = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (fs.existsSync(pod)) {
        patchPodfile(pod);
        slimExtensionPodfile(pod);
      }
      return cfg;
    },
  ]);

  config = withXcodeProject(config, (cfg) => {
    const root = cfg.modRequest.platformProjectRoot;
    const n = installNativeShareController(root, cfg.modRequest.projectRoot);
    stripExtensionRnPhases(cfg.modResults);
    console.log(`[${TAG}] native share panel installed in ${n} target(s)`);
    return cfg;
  });

  config = withInfoPlist(config, (cfg) => {
    const root = cfg.modRequest.platformProjectRoot;
    patchExtensionPlist(root);
    injectExtensionKeys(root, cfg.modRequest.projectRoot);
    return cfg;
  });

  return config;
};
