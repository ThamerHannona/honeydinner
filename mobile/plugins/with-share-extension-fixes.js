// Fixes the iOS share extension in Expo SDK 54 / New Architecture:
//
// 1) After pod install, patch RCTThirdPartyComponentsProvider.mm so
//    NSClassFromString nil entries cannot crash the extension on launch.
// 2) Present a cream Honey, Dinner? panel immediately (before React Native
//    starts) and write debug logs to the App Group, so a hang still shows UI
//    and the next test has evidence.
// 3) Strip UIApplicationSceneManifest from the extension Info.plist only.
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
  if (src.includes(POD_TAG)) return false;
  const snippet = `
    ${POD_TAG}
    codegen_patch = File.expand_path('../plugins/patch-rct-third-party-components.js', __dir__)
    if File.exist?(codegen_patch)
      puts "[ShareExtension] Patching RCTThirdPartyComponentsProvider.mm for nil-safety"
      system('node', codegen_patch, __dir__) || Pod::UI.warn('Share extension codegen patch failed')
    end
`;
  if (/post_install do \|installer\|\n/.test(src)) {
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

module.exports = function withShareExtensionFixes(config) {
  config = withDangerousMod(config, [
    'ios',
    (cfg) => {
      const pod = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (fs.existsSync(pod)) patchPodfile(pod);
      return cfg;
    },
  ]);

  config = withXcodeProject(config, (cfg) => {
    const root = cfg.modRequest.platformProjectRoot;
    for (const dir of extensionDirs(root)) {
      const swift = path.join(root, dir, 'ShareExtensionViewController.swift');
      if (fs.existsSync(swift)) {
        const changed = patchSwift(swift);
        console.log(`[${TAG}] ${swift}: ${changed ? 'patched' : 'already patched'}`);
      }
    }
    return cfg;
  });

  config = withInfoPlist(config, (cfg) => {
    patchExtensionPlist(cfg.modRequest.platformProjectRoot);
    return cfg;
  });

  return config;
};
