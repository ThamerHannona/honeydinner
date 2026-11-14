// HD_NATIVE_SHARE_PANEL
// Pure UIKit share panel. No React Native, Hermes, or Expo modules.
// Reads a URL from the host share sheet, calls import-recipe, writes the
// App Group inbox + share-extension.log, and offers Done / Cook it now.

import UIKit
import MobileCoreServices
import UniformTypeIdentifiers

private let kCream = UIColor(red: 244/255, green: 237/255, blue: 224/255, alpha: 1)
private let kInk = UIColor(red: 20/255, green: 17/255, blue: 13/255, alpha: 1)
private let kInkSoft = UIColor(red: 107/255, green: 100/255, blue: 88/255, alpha: 1)
private let kWhite = UIColor(red: 255/255, green: 250/255, blue: 243/255, alpha: 1)
private let kLine = UIColor(red: 228/255, green: 216/255, blue: 200/255, alpha: 1)
private let kGreen = UIColor(red: 46/255, green: 158/255, blue: 91/255, alpha: 1)
private let kGreenSoft = UIColor(red: 216/255, green: 240/255, blue: 224/255, alpha: 1)
private let kForest = UIColor(red: 31/255, green: 107/255, blue: 58/255, alpha: 1)
private let kOnGreen = UIColor(red: 251/255, green: 246/255, blue: 234/255, alpha: 1)
private let kHoney = UIColor(red: 245/255, green: 184/255, blue: 61/255, alpha: 1)

private let kImportSteps = [
  "Reading caption",
  "Listening to audio",
  "Reading on-screen text",
  "Writing recipe",
]

class ShareExtensionViewController: UIViewController {
  private enum Phase { case reading, saved, failed, nolink }

  private var phase: Phase = .reading
  private var stepIndex: Int = 0
  private var savedTitle: String = ""
  private var failedMessage: String = "Couldn't read that one."
  private var currentURL: String?

  private let card = UIView()
  private let stack = UIStackView()
  private let grabber = UIView()
  private let logoLabel = UILabel()
  private let closeButton = UIButton(type: .system)
  private let statusLabel = UILabel()
  private let stepsStack = UIStackView()
  private let noteWrap = UIView()
  private let noteLabel = UILabel()
  private let primaryButton = UIButton(type: .system)
  private let secondaryButton = UIButton(type: .system)

  private var stepTimer: Timer?
  private var importTask: URLSessionDataTask?

  override func loadView() {
    let v = UIView(frame: UIScreen.main.bounds)
    v.backgroundColor = .clear
    self.view = v
    logExt("loadView HD_NATIVE_SHARE_PANEL")
    buildChrome()
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    preferredContentSize = CGSize(width: UIScreen.main.bounds.width, height: 620)
    logExt("viewDidLoad HD_NATIVE_SHARE_PANEL")
    startImport()
  }

  override func viewDidDisappear(_ animated: Bool) {
    super.viewDidDisappear(animated)
    stepTimer?.invalidate()
    importTask?.cancel()
  }

  // MARK: - Layout

  private func buildChrome() {
    card.backgroundColor = kCream
    card.layer.cornerRadius = 28
    card.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
    card.clipsToBounds = true
    card.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(card)

    NSLayoutConstraint.activate([
      card.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      card.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      card.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      card.heightAnchor.constraint(greaterThanOrEqualToConstant: 420),
    ])

    grabber.backgroundColor = kLine
    grabber.layer.cornerRadius = 2.5
    grabber.translatesAutoresizingMaskIntoConstraints = false

    logoLabel.text = "HONEY, DINNER?"
    logoLabel.font = roundedFont(size: 13, weight: .heavy)
    logoLabel.textColor = kGreen
    logoLabel.textAlignment = .center

    closeButton.setTitle("✕", for: .normal)
    closeButton.setTitleColor(kInkSoft, for: .normal)
    closeButton.titleLabel?.font = .systemFont(ofSize: 18, weight: .semibold)
    closeButton.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
    closeButton.translatesAutoresizingMaskIntoConstraints = false

    statusLabel.font = roundedFont(size: 26, weight: .bold)
    statusLabel.textColor = kInk
    statusLabel.numberOfLines = 0

    stepsStack.axis = .vertical
    stepsStack.spacing = 10
    stepsStack.translatesAutoresizingMaskIntoConstraints = false

    noteWrap.backgroundColor = kForest
    noteWrap.layer.cornerRadius = 16
    noteLabel.font = roundedFont(size: 15, weight: .semibold)
    noteLabel.textColor = kOnGreen
    noteLabel.numberOfLines = 0
    noteLabel.translatesAutoresizingMaskIntoConstraints = false
    noteWrap.addSubview(noteLabel)
    NSLayoutConstraint.activate([
      noteLabel.leadingAnchor.constraint(equalTo: noteWrap.leadingAnchor, constant: 16),
      noteLabel.trailingAnchor.constraint(equalTo: noteWrap.trailingAnchor, constant: -16),
      noteLabel.topAnchor.constraint(equalTo: noteWrap.topAnchor, constant: 12),
      noteLabel.bottomAnchor.constraint(equalTo: noteWrap.bottomAnchor, constant: -12),
    ])

    stylePrimary(primaryButton)
    styleSecondary(secondaryButton)
    primaryButton.addTarget(self, action: #selector(primaryTapped), for: .touchUpInside)
    secondaryButton.addTarget(self, action: #selector(secondaryTapped), for: .touchUpInside)

    stack.axis = .vertical
    stack.spacing = 14
    stack.translatesAutoresizingMaskIntoConstraints = false
    [logoLabel, statusLabel, stepsStack, noteWrap, secondaryButton, primaryButton].forEach { stack.addArrangedSubview($0) }
    stack.setCustomSpacing(8, after: logoLabel)
    stack.setCustomSpacing(18, after: statusLabel)

    card.addSubview(grabber)
    card.addSubview(closeButton)
    card.addSubview(stack)

    NSLayoutConstraint.activate([
      grabber.topAnchor.constraint(equalTo: card.topAnchor, constant: 10),
      grabber.centerXAnchor.constraint(equalTo: card.centerXAnchor),
      grabber.widthAnchor.constraint(equalToConstant: 36),
      grabber.heightAnchor.constraint(equalToConstant: 5),
      closeButton.topAnchor.constraint(equalTo: card.topAnchor, constant: 8),
      closeButton.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -10),
      closeButton.widthAnchor.constraint(equalToConstant: 44),
      closeButton.heightAnchor.constraint(equalToConstant: 44),
      stack.topAnchor.constraint(equalTo: grabber.bottomAnchor, constant: 22),
      stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 22),
      stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -22),
      stack.bottomAnchor.constraint(equalTo: card.safeAreaLayoutGuide.bottomAnchor, constant: -18),
      primaryButton.heightAnchor.constraint(equalToConstant: 54),
      secondaryButton.heightAnchor.constraint(equalToConstant: 48),
    ])

    render()
  }

  private func stylePrimary(_ b: UIButton) {
    b.backgroundColor = kInk
    b.setTitleColor(kCream, for: .normal)
    b.titleLabel?.font = roundedFont(size: 17, weight: .heavy)
    b.layer.cornerRadius = 27
  }

  private func styleSecondary(_ b: UIButton) {
    b.backgroundColor = .clear
    b.setTitleColor(kInk, for: .normal)
    b.titleLabel?.font = roundedFont(size: 16, weight: .heavy)
    b.layer.cornerRadius = 24
    b.layer.borderWidth = 1
    b.layer.borderColor = kLine.cgColor
  }

  private func roundedFont(size: CGFloat, weight: UIFont.Weight) -> UIFont {
    let base = UIFont.systemFont(ofSize: size, weight: weight)
    if let desc = base.fontDescriptor.withDesign(.rounded) {
      return UIFont(descriptor: desc, size: size)
    }
    return base
  }

  private func render() {
    switch phase {
    case .reading:
      statusLabel.text = "Reading your post…"
      stepsStack.isHidden = false
      rebuildSteps()
      noteWrap.isHidden = false
      noteLabel.text = "FridgeGenie is pulling the recipe from this post."
      secondaryButton.isHidden = true
      primaryButton.setTitle("Done", for: .normal)
    case .saved:
      statusLabel.text = savedTitle.isEmpty ? "Saved to your kitchen." : "Saved: \(savedTitle)"
      stepsStack.isHidden = false
      stepIndex = kImportSteps.count
      rebuildSteps()
      noteWrap.isHidden = false
      noteLabel.text = "It's in your kitchen. Open the app when you're ready to cook."
      secondaryButton.isHidden = false
      secondaryButton.setTitle("Done", for: .normal)
      primaryButton.setTitle("Cook it now", for: .normal)
    case .failed:
      statusLabel.text = failedMessage
      stepsStack.isHidden = true
      noteWrap.isHidden = false
      noteLabel.text = "We'll keep the link so you can finish it in the app."
      secondaryButton.isHidden = false
      secondaryButton.setTitle("Done", for: .normal)
      primaryButton.setTitle("Finish in the app", for: .normal)
    case .nolink:
      statusLabel.text = "Couldn't find a link in that share."
      stepsStack.isHidden = true
      noteWrap.isHidden = true
      secondaryButton.isHidden = true
      primaryButton.setTitle("Done", for: .normal)
    }
  }

  private func rebuildSteps() {
    stepsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
    for (i, label) in kImportSteps.enumerated() {
      let row = UIStackView()
      row.axis = .horizontal
      row.spacing = 10
      row.alignment = .center
      let tick = UILabel()
      let done = i < stepIndex
      tick.text = done ? "✓" : "○"
      tick.font = roundedFont(size: 16, weight: .bold)
      tick.textColor = done ? kGreen : kInkSoft
      tick.widthAnchor.constraint(equalToConstant: 22).isActive = true
      let text = UILabel()
      text.text = label
      text.font = roundedFont(size: 16, weight: done ? .heavy : .semibold)
      text.textColor = done ? kInk : kInkSoft
      row.addArrangedSubview(tick)
      row.addArrangedSubview(text)
      stepsStack.addArrangedSubview(row)
    }
  }

  // MARK: - Import

  private func startImport() {
    extractSharedURL { [weak self] url in
      guard let self else { return }
      DispatchQueue.main.async {
        guard let url, !url.isEmpty else {
          self.phase = .nolink
          self.logExt("no link in share")
          self.render()
          return
        }
        self.currentURL = url
        self.logExt("importing \(url)")
        self.animateSteps()
        self.callImport(url: url)
      }
    }
  }

  private func animateSteps() {
    stepTimer?.invalidate()
    stepIndex = 0
    rebuildSteps()
    stepTimer = Timer.scheduledTimer(withTimeInterval: 2.4, repeats: true) { [weak self] t in
      guard let self else { t.invalidate(); return }
      if self.phase != .reading { t.invalidate(); return }
      if self.stepIndex < kImportSteps.count - 1 {
        self.stepIndex += 1
        self.rebuildSteps()
      }
    }
  }

  private func callImport(url: String) {
    let bakedUrl = "__HD_SUPABASE_URL__"
    let bakedKey = "__HD_SUPABASE_ANON_KEY__"
    let fn = (Bundle.main.object(forInfoDictionaryKey: "SupabaseUrl") as? String).flatMap { $0.isEmpty ? nil : $0 } ?? bakedUrl
    let key = (Bundle.main.object(forInfoDictionaryKey: "SupabaseAnonKey") as? String).flatMap { $0.isEmpty ? nil : $0 } ?? bakedKey
    guard
      !fn.isEmpty, !key.isEmpty, fn.hasPrefix("https://"),
      let endpoint = URL(string: fn.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/functions/v1/import-recipe")
    else {
      logExt("missing SupabaseUrl/SupabaseAnonKey")
      finishFailed(url: url, message: "Couldn't reach the kitchen.")
      return
    }

    var req = URLRequest(url: endpoint)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue(key, forHTTPHeaderField: "apikey")
    req.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
    req.timeoutInterval = 45
    req.httpBody = try? JSONSerialization.data(withJSONObject: ["url": url], options: [])

    importTask = URLSession.shared.dataTask(with: req) { [weak self] data, resp, err in
      guard let self else { return }
      if let err {
        self.logExt("import error \(err.localizedDescription)")
        self.queueLink(url)
        DispatchQueue.main.async { self.finishFailed(url: url, message: "Couldn't read that one.") }
        return
      }
      let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
      self.logExt("import status \(code)")
      guard let data else {
        self.queueLink(url)
        DispatchQueue.main.async { self.finishFailed(url: url, message: "Couldn't read that one.") }
        return
      }
      if code == 200, let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
        let recipe = (obj["recipe"] as? [String: Any]) ?? obj
        if recipe["title"] != nil {
          self.queueRecipe(recipe)
          let title = recipe["title"] as? String ?? ""
          DispatchQueue.main.async {
            self.stepTimer?.invalidate()
            self.phase = .saved
            self.savedTitle = title
            self.render()
          }
          return
        }
      }
      if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
         let msg = obj["error"] as? String {
        self.logExt("import 422 \(msg)")
      }
      self.queueLink(url)
      DispatchQueue.main.async { self.finishFailed(url: url, message: "Couldn't read that one.") }
    }
    importTask?.resume()
  }

  private func finishFailed(url: String, message: String) {
    stepTimer?.invalidate()
    currentURL = url
    failedMessage = message
    phase = .failed
    render()
  }

  // MARK: - Share items

  private func extractSharedURL(completion: @escaping (String?) -> Void) {
    let items = extensionContext?.inputItems as? [NSExtensionItem] ?? []
    let providers = items.flatMap { $0.attachments ?? [] }
    let urlType = UTType.url.identifier
    let textType = UTType.plainText.identifier
    let deadline = DispatchTime.now() + 2.5
    var settled = false
    let finish: (String?) -> Void = { value in
      guard !settled else { return }
      settled = true
      completion(value)
    }
    DispatchQueue.global().asyncAfter(deadline: deadline) { finish(nil) }

    func takeText(_ raw: String) -> String? {
      let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
      if let u = URL(string: trimmed), let s = u.scheme, s.hasPrefix("http") { return trimmed }
      if let found = trimmed.range(of: #"https?://[^\s]+"#, options: .regularExpression) {
        return String(trimmed[found]).trimmingCharacters(in: CharacterSet(charactersIn: ".,);\"'"))
      }
      return nil
    }

    let urlProviders = providers.filter { $0.hasItemConformingToTypeIdentifier(urlType) }
    let textProviders = providers.filter { $0.hasItemConformingToTypeIdentifier(textType) }
    let work = urlProviders + textProviders
    if work.isEmpty {
      finish(nil)
      return
    }
    var pending = work.count
    func oneDone(_ value: String?) {
      if let value { finish(value); return }
      pending -= 1
      if pending <= 0 { finish(nil) }
    }
    for p in urlProviders {
      p.loadItem(forTypeIdentifier: urlType, options: nil) { item, _ in
        if let u = item as? URL { oneDone(u.absoluteString); return }
        if let u = item as? String { oneDone(takeText(u) ?? u); return }
        oneDone(nil)
      }
    }
    for p in textProviders {
      p.loadItem(forTypeIdentifier: textType, options: nil) { item, _ in
        if let s = item as? String { oneDone(takeText(s)); return }
        if let u = item as? URL { oneDone(u.absoluteString); return }
        oneDone(nil)
      }
    }
  }

  // MARK: - App Group inbox

  private func containerURL() -> URL? {
    guard let appGroup = Bundle.main.object(forInfoDictionaryKey: "AppGroup") as? String else { return nil }
    return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
  }

  private func queueRecipe(_ recipe: [String: Any]) {
    var pending = readInbox()
    var rec = recipe
    rec["sharedAt"] = ISO8601DateFormatter().string(from: Date())
    var recipes = pending["recipes"] as? [[String: Any]] ?? []
    recipes.append(rec)
    pending["recipes"] = recipes
    writeInbox(pending)
    logExt("queued recipe")
  }

  private func queueLink(_ url: String) {
    var pending = readInbox()
    var links = pending["links"] as? [String] ?? []
    if !links.contains(url) { links.append(url) }
    pending["links"] = links
    writeInbox(pending)
    logExt("queued link")
  }

  private func readInbox() -> [String: Any] {
    guard let url = containerURL()?.appendingPathComponent("share-inbox.json"),
          let data = try? Data(contentsOf: url),
          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return ["recipes": [], "links": []] }
    return obj
  }

  private func writeInbox(_ pending: [String: Any]) {
    guard let url = containerURL()?.appendingPathComponent("share-inbox.json") else { return }
    if let data = try? JSONSerialization.data(withJSONObject: pending, options: []) {
      try? data.write(to: url, options: .atomic)
    }
  }

  func logExt(_ message: String) {
    let line = "\(ISO8601DateFormatter().string(from: Date())) \(message)\n"
    print("[ShareExtension] \(message)")
    NSLog("[ShareExtension] %@", message)
    guard let url = containerURL()?.appendingPathComponent("share-extension.log"),
          let data = line.data(using: .utf8) else { return }
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

  // MARK: - Actions

  @objc private func closeTapped() { close() }

  @objc private func primaryTapped() {
    switch phase {
    case .reading, .nolink:
      close()
    case .saved:
      openHost("shared")
      close()
    case .failed:
      openHost("shared")
      close()
    }
  }

  @objc private func secondaryTapped() { close() }

  private func close() {
    stepTimer?.invalidate()
    extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
  }

  private func openHost(_ path: String) {
    let scheme = Bundle.main.object(forInfoDictionaryKey: "HostAppScheme") as? String ?? "honeydinner"
    guard let url = URL(string: "\(scheme)://\(path)") else { return }
    logExt("openHost \(url.absoluteString)")
    // Open the host app without referencing UIApplication (the extension is built
    // with APPLICATION_EXTENSION_API_ONLY = YES).
    var responder: UIResponder? = self
    let sel = NSSelectorFromString("openURL:options:completionHandler:")
    while let r = responder {
      if r.responds(to: sel) {
        typealias OpenFn = @convention(c) (Any, Selector, URL, NSDictionary, Any?) -> Void
        let fn = unsafeBitCast(r.method(for: sel), to: OpenFn.self)
        fn(r, sel, url, [:], nil)
        return
      }
      responder = r.next
    }
    extensionContext?.open(url, completionHandler: nil)
  }
}
