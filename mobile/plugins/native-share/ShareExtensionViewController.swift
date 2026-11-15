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


private let kGenieLeaf = UIColor(red: 0x1D / 255, green: 0xAF / 255, blue: 0x3A / 255, alpha: 1)
private let kGenieHoney = UIColor(red: 0xF4 / 255, green: 0xAA / 255, blue: 0x22 / 255, alpha: 1)
private let kGenieOnHoney = UIColor(red: 0x14 / 255, green: 0x11 / 255, blue: 0x0D / 255, alpha: 1)
private let kGenieOnInk = UIColor(red: 0xFB / 255, green: 0xF6 / 255, blue: 0xEA / 255, alpha: 1)
private let kGenieCreamDeep = UIColor(red: 0xEF / 255, green: 0xE8 / 255, blue: 0xDC / 255, alpha: 1)

/// Native FridgeGenie, drawn to match the in-app SVG mascot.
final class FridgeGenieView: UIView {
  enum Mood { case idle, working }

  private let actor = UIView()
  private let sparkleHost = UIView()
  private var leftEye: CALayer?
  private var rightEye: CALayer?
  private var blinkLayers: [CALayer] = []
  private var mood: Mood = .idle

  override init(frame: CGRect) {
    super.init(frame: frame)
    isAccessibilityElement = true
    accessibilityLabel = "FridgeGenie"
    translatesAutoresizingMaskIntoConstraints = false
    clipsToBounds = false
    actor.translatesAutoresizingMaskIntoConstraints = false
    actor.isUserInteractionEnabled = false
    sparkleHost.translatesAutoresizingMaskIntoConstraints = false
    sparkleHost.isUserInteractionEnabled = false
    addSubview(actor)
    addSubview(sparkleHost)
    NSLayoutConstraint.activate([
      actor.centerXAnchor.constraint(equalTo: centerXAnchor),
      actor.centerYAnchor.constraint(equalTo: centerYAnchor),
      actor.widthAnchor.constraint(equalToConstant: 92),
      actor.heightAnchor.constraint(equalToConstant: 120),
      sparkleHost.leadingAnchor.constraint(equalTo: actor.leadingAnchor, constant: -16),
      sparkleHost.trailingAnchor.constraint(equalTo: actor.trailingAnchor, constant: 16),
      sparkleHost.topAnchor.constraint(equalTo: actor.topAnchor),
      sparkleHost.bottomAnchor.constraint(equalTo: actor.bottomAnchor),
      heightAnchor.constraint(equalToConstant: 126),
    ])
    buildCharacter()
    buildSparkles()
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

  override var intrinsicContentSize: CGSize { CGSize(width: 140, height: 126) }

  func play(_ mood: Mood) {
    self.mood = mood
    accessibilityLabel = mood == .working
      ? "FridgeGenie is pulling the recipe from this post."
      : "FridgeGenie"
    restartMotion()
  }

  func stop() {
    actor.layer.removeAllAnimations()
    blinkLayers.forEach { $0.removeAllAnimations() }
    leftEye?.removeAllAnimations()
    rightEye?.removeAllAnimations()
    actor.transform = .identity
    sparkleHost.subviews.forEach {
      $0.layer.removeAllAnimations()
      $0.alpha = 0
    }
  }

  private let s: CGFloat = 120.0 / 260.0

  private func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * s, y: y * s) }
  private func sz(_ w: CGFloat, _ h: CGFloat) -> CGSize { CGSize(width: w * s, height: h * s) }

  private func buildCharacter() {
    actor.layer.sublayers?.forEach { $0.removeFromSuperlayer() }
    // shadow
    addFill(ellipse: CGRect(origin: pt(41, 228), size: sz(118, 14)), color: kGenieCreamDeep)
    // arms, legs, stem (stroke)
    stroke(path: {
      let p = UIBezierPath()
      p.move(to: pt(59, 134))
      p.addCurve(to: pt(37, 101), controlPoint1: pt(38, 131), controlPoint2: pt(33, 117))
      p.move(to: pt(32, 102))
      p.addQuadCurve(to: pt(42, 101), controlPoint: pt(35, 95))
      p.move(to: pt(143, 134))
      p.addQuadCurve(to: pt(169, 152), controlPoint: pt(162, 134))
      p.move(to: pt(79, 190)); p.addLine(to: pt(77, 207))
      p.move(to: pt(122, 190)); p.addLine(to: pt(121, 207))
      p.move(to: pt(103, 47)); p.addLine(to: pt(103, 35))
      p.move(to: pt(56, 99)); p.addLine(to: pt(144, 99))
      return p
    }(), width: 2.8 * s)
    // shoes
    addFill(ellipse: CGRect(center: pt(69, 212), size: sz(24, 11)), color: kGenieOnInk)
    addFill(ellipse: CGRect(center: pt(130, 212), size: sz(24, 11)), color: kGenieOnInk)
    // leaf
    let leaf = UIBezierPath()
    leaf.move(to: pt(103, 36))
    leaf.addQuadCurve(to: pt(130, 20), controlPoint: pt(103, 17))
    leaf.addQuadCurve(to: pt(103, 36), controlPoint: pt(126, 37))
    leaf.close()
    addFill(path: leaf, color: kGenieLeaf, stroke: true)
    // body
    let body = UIBezierPath(roundedRect: CGRect(origin: pt(55, 45), size: sz(90, 151)), cornerRadius: 21 * s)
    addFill(path: body, color: kGenieLeaf, stroke: true)
    // handles
    addFill(path: UIBezierPath(roundedRect: CGRect(origin: pt(129, 65), size: sz(5, 25)), cornerRadius: 2 * s), color: kGenieOnHoney, stroke: false)
    addFill(path: UIBezierPath(roundedRect: CGRect(origin: pt(129, 111), size: sz(5, 34)), cornerRadius: 2 * s), color: kGenieOnHoney, stroke: false)
    // eyes
    leftEye = addFill(ellipse: CGRect(center: pt(84, 128), size: sz(14, 16)), color: kGenieOnHoney)
    rightEye = addFill(ellipse: CGRect(center: pt(114, 128), size: sz(14, 16)), color: kGenieOnHoney)
    let pupilL = addFill(ellipse: CGRect(center: pt(86, 125), size: sz(4, 4)), color: kGenieOnInk)
    let pupilR = addFill(ellipse: CGRect(center: pt(116, 125), size: sz(4, 4)), color: kGenieOnInk)
    blinkLayers = [leftEye, rightEye, pupilL, pupilR].compactMap { $0 }
    // cheeks
    addFill(ellipse: CGRect(center: pt(75, 143), size: sz(9, 9)), color: kGenieHoney, alpha: 0.8)
    addFill(ellipse: CGRect(center: pt(124, 143), size: sz(9, 9)), color: kGenieHoney, alpha: 0.8)
    // smile
    let smile = UIBezierPath()
    smile.move(to: pt(85, 148))
    smile.addQuadCurve(to: pt(115, 148), controlPoint: pt(100, 162))
    smile.close()
    addFill(path: smile, color: kGenieOnInk, stroke: true, strokeWidth: 2.4 * s)
  }

  @discardableResult
  private func addFill(path: UIBezierPath, color: UIColor, stroke: Bool, strokeWidth: CGFloat? = nil, alpha: CGFloat = 1) -> CAShapeLayer {
    let layer = CAShapeLayer()
    layer.path = path.cgPath
    layer.fillColor = color.withAlphaComponent(alpha).cgColor
    if stroke {
      layer.strokeColor = kGenieOnHoney.cgColor
      layer.lineWidth = strokeWidth ?? (2.8 * s)
      layer.lineCap = .round
      layer.lineJoin = .round
    } else {
      layer.strokeColor = UIColor.clear.cgColor
    }
    actor.layer.addSublayer(layer)
    return layer
  }

  @discardableResult
  private func addFill(ellipse rect: CGRect, color: UIColor, alpha: CGFloat = 1) -> CAShapeLayer {
    addFill(path: UIBezierPath(ovalIn: rect), color: color, stroke: false, alpha: alpha)
  }

  private func stroke(path: UIBezierPath, width: CGFloat) {
    let layer = CAShapeLayer()
    layer.path = path.cgPath
    layer.fillColor = UIColor.clear.cgColor
    layer.strokeColor = kGenieOnHoney.cgColor
    layer.lineWidth = width
    layer.lineCap = .round
    layer.lineJoin = .round
    actor.layer.addSublayer(layer)
  }

  private func buildSparkles() {
    sparkleHost.subviews.forEach { $0.removeFromSuperview() }
    let spots: [(CGFloat, CGFloat, CGFloat)] = [
      (4, 16, 7), (108, 24, 6), (114, 52, 7), (0, 48, 5),
    ]
    for (x, y, size) in spots {
      let wrap = UIView(frame: CGRect(x: x, y: y, width: size, height: size))
      wrap.backgroundColor = .clear
      wrap.alpha = 0
      let star = UIView(frame: wrap.bounds)
      star.backgroundColor = kGenieHoney
      star.layer.cornerRadius = 1
      star.transform = CGAffineTransform(rotationAngle: .pi / 4)
      wrap.addSubview(star)
      sparkleHost.addSubview(wrap)
    }
  }

  private func restartMotion() {
    stop()
    if UIAccessibility.isReduceMotionEnabled {
      if mood == .working { sparkleHost.subviews.forEach { $0.alpha = 0.75 } }
      return
    }
    startBob(busy: mood == .working)
    startBlink()
    if mood == .working {
      startWiggle()
      startSparkles()
    }
  }

  private func startBob(busy: Bool) {
    let anim = CABasicAnimation(keyPath: "transform.translation.y")
    anim.fromValue = 0
    anim.toValue = busy ? -5 : -4
    anim.duration = busy ? 0.42 : 0.9
    anim.autoreverses = true
    anim.repeatCount = .infinity
    anim.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
    actor.layer.add(anim, forKey: "bob")
  }

  private func startWiggle() {
    let anim = CABasicAnimation(keyPath: "transform.rotation.z")
    anim.fromValue = -7 * CGFloat.pi / 180
    anim.toValue = 7 * CGFloat.pi / 180
    anim.duration = 0.38
    anim.autoreverses = true
    anim.repeatCount = .infinity
    anim.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
    actor.layer.add(anim, forKey: "wiggle")
  }

  private func startBlink() {
    for (i, layer) in blinkLayers.enumerated() {
      let key = "blink\(i)"
      layer.anchorPoint = CGPoint(x: 0.5, y: 0.5)
      let blink = CABasicAnimation(keyPath: "transform.scale.y")
      blink.fromValue = 1
      blink.toValue = 0.08
      blink.duration = 0.08
      blink.autoreverses = true
      blink.beginTime = 0
      let group = CAAnimationGroup()
      group.animations = [blink]
      group.duration = 2.8
      group.repeatCount = .infinity
      group.isRemovedOnCompletion = false
      layer.add(group, forKey: key)
    }
  }

  private func startSparkles() {
    for (i, star) in sparkleHost.subviews.enumerated() {
      star.alpha = 1
      let fade = CABasicAnimation(keyPath: "opacity")
      fade.fromValue = 0.15
      fade.toValue = 1
      fade.duration = 0.7
      fade.autoreverses = true
      fade.repeatCount = .infinity
      fade.beginTime = CACurrentMediaTime() + Double(i) * 0.18
      fade.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
      let scale = CABasicAnimation(keyPath: "transform.scale")
      scale.fromValue = 0.6
      scale.toValue = 1.15
      scale.duration = 0.7
      scale.autoreverses = true
      scale.repeatCount = .infinity
      scale.beginTime = fade.beginTime
      star.layer.add(fade, forKey: "fade")
      star.layer.add(scale, forKey: "scale")
    }
  }
}

private extension CGRect {
  init(center: CGPoint, size: CGSize) {
    self.init(x: center.x - size.width / 2, y: center.y - size.height / 2, width: size.width, height: size.height)
  }
}

class ShareExtensionViewController: UIViewController {
  private enum Phase { case reading, saved, failed, nolink }

  private var phase: Phase = .reading
  private var stepIndex: Int = 0
  private var savedTitle: String = ""
  private var failedMessage: String = "Couldn't read that one."
  private var currentURL: String?
  private var queuedRecipeId: String?

  private let card = UIView()
  private let stack = UIStackView()
  private let grabber = UIView()
  private let logoLabel = UILabel()
  private let closeButton = UIButton(type: .system)
  private let statusLabel = UILabel()
  private let stepsStack = UIStackView()
  private let noteWrap = UIView()
  private let noteLabel = UILabel()
  private let genieView = FridgeGenieView()
  private let primaryButton = UIButton(type: .custom)
  private let secondaryButton = UIButton(type: .custom)
  private let actions = UIView()

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
    preferredContentSize = CGSize(width: UIScreen.main.bounds.width, height: 520)
    logExt("viewDidLoad HD_NATIVE_SHARE_PANEL")
    startImport()
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    if phase == .reading { genieView.play(.working) }
  }

  override func viewDidDisappear(_ animated: Bool) {
    super.viewDidDisappear(animated)
    stepTimer?.invalidate()
    importTask?.cancel()
    genieView.stop()
  }

  // MARK: - Layout

  private func buildChrome() {
    card.backgroundColor = kCream
    card.layer.cornerRadius = 28
    card.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
    card.clipsToBounds = true
    card.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(card)

    view.isUserInteractionEnabled = true
    card.isUserInteractionEnabled = true

    NSLayoutConstraint.activate([
      card.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      card.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      card.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      card.topAnchor.constraint(greaterThanOrEqualTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
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
    primaryButton.isUserInteractionEnabled = true
    secondaryButton.isUserInteractionEnabled = true
    closeButton.isUserInteractionEnabled = true

    stack.axis = .vertical
    stack.spacing = 14
    stack.translatesAutoresizingMaskIntoConstraints = false
    [logoLabel, statusLabel, stepsStack, genieView, noteWrap].forEach { stack.addArrangedSubview($0) }
    stack.setCustomSpacing(8, after: logoLabel)
    stack.setCustomSpacing(18, after: statusLabel)

    let actionStack = UIStackView(arrangedSubviews: [secondaryButton, primaryButton])
    actionStack.axis = .vertical
    actionStack.spacing = 10
    actionStack.isUserInteractionEnabled = true
    actionStack.translatesAutoresizingMaskIntoConstraints = false
    actions.isUserInteractionEnabled = true
    actions.translatesAutoresizingMaskIntoConstraints = false
    actions.addSubview(actionStack)

    card.addSubview(grabber)
    card.addSubview(closeButton)
    card.addSubview(stack)
    card.addSubview(actions)

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
      actions.topAnchor.constraint(equalTo: stack.bottomAnchor, constant: 18),
      actions.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 22),
      actions.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -22),
      actions.bottomAnchor.constraint(equalTo: card.safeAreaLayoutGuide.bottomAnchor, constant: -16),
      actionStack.topAnchor.constraint(equalTo: actions.topAnchor),
      actionStack.leadingAnchor.constraint(equalTo: actions.leadingAnchor),
      actionStack.trailingAnchor.constraint(equalTo: actions.trailingAnchor),
      actionStack.bottomAnchor.constraint(equalTo: actions.bottomAnchor),
      secondaryButton.heightAnchor.constraint(equalToConstant: 52),
      primaryButton.heightAnchor.constraint(equalToConstant: 56),
    ])

    render()
  }

  private func stylePrimary(_ b: UIButton) {
    b.backgroundColor = kInk
    b.setTitleColor(kCream, for: .normal)
    b.setTitleColor(kCream.withAlphaComponent(0.7), for: .highlighted)
    b.titleLabel?.font = roundedFont(size: 17, weight: .heavy)
    b.layer.cornerRadius = 28
    b.clipsToBounds = true
    b.contentEdgeInsets = UIEdgeInsets(top: 14, left: 16, bottom: 14, right: 16)
  }

  private func styleSecondary(_ b: UIButton) {
    b.backgroundColor = kWhite
    b.setTitleColor(kInk, for: .normal)
    b.setTitleColor(kInk.withAlphaComponent(0.6), for: .highlighted)
    b.titleLabel?.font = roundedFont(size: 16, weight: .heavy)
    b.layer.cornerRadius = 26
    b.layer.borderWidth = 1
    b.layer.borderColor = kLine.cgColor
    b.clipsToBounds = true
    b.contentEdgeInsets = UIEdgeInsets(top: 12, left: 16, bottom: 12, right: 16)
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
      genieView.isHidden = false
      genieView.play(.working)
      noteWrap.isHidden = true
      secondaryButton.isHidden = true
      primaryButton.setTitle("Done", for: .normal)
    case .saved:
      statusLabel.text = savedTitle.isEmpty ? "Saved to your kitchen." : "Saved: \(savedTitle)"
      stepsStack.isHidden = false
      stepIndex = kImportSteps.count
      rebuildSteps()
      genieView.stop()
      genieView.isHidden = true
      noteWrap.isHidden = false
      noteLabel.text = "It's in your kitchen. Open the app when you're ready to cook."
      secondaryButton.isHidden = false
      secondaryButton.setTitle("Done", for: .normal)
      primaryButton.setTitle("Cook it now", for: .normal)
    case .failed:
      statusLabel.text = failedMessage
      stepsStack.isHidden = true
      genieView.stop()
      genieView.isHidden = true
      noteWrap.isHidden = false
      noteLabel.text = "We'll keep the link so you can finish it in the app."
      secondaryButton.isHidden = false
      secondaryButton.setTitle("Done", for: .normal)
      primaryButton.setTitle("Finish in the app", for: .normal)
    case .nolink:
      statusLabel.text = "Couldn't find a link in that share."
      stepsStack.isHidden = true
      genieView.stop()
      genieView.isHidden = true
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
    req.timeoutInterval = 90
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
    if rec["id"] == nil {
      rec["id"] = "r-\(Int(Date().timeIntervalSince1970 * 1000))-\(UUID().uuidString.prefix(6).lowercased())"
    }
    queuedRecipeId = rec["id"] as? String
    var recipes = pending["recipes"] as? [[String: Any]] ?? []
    recipes.append(rec)
    pending["recipes"] = recipes
    writeInbox(pending)
    logExt("queued recipe \(queuedRecipeId ?? "")")
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

  @objc private func closeTapped() {
    logExt("close tapped")
    dismissExtension()
  }

  @objc private func primaryTapped() {
    logExt("primary tapped \(String(describing: phase))")
    switch phase {
    case .reading, .nolink:
      dismissExtension()
    case .saved, .failed:
      openHostAndDismiss()
    }
  }

  @objc private func secondaryTapped() {
    logExt("secondary tapped \(String(describing: phase))")
    dismissExtension()
  }

  private func dismissExtension() {
    stepTimer?.invalidate()
    logExt("completeRequest")
    DispatchQueue.main.async {
      self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
  }

  private func openHostAndDismiss() {
    // Always carry the post link: if the App Group inbox can't be read, the app
    // re-reads it from the link (the server returns it instantly from cache).
    var path = "shared"
    let query = currentURL
      .flatMap { $0.addingPercentEncoding(withAllowedCharacters: .alphanumerics) }
      .map { "url=\($0)" }
    if phase == .saved, let id = queuedRecipeId, !id.isEmpty {
      path = "cook/\(id)" + (query.map { "?\($0)" } ?? "")
    } else if let query {
      path = "shared?\(query)"
    }
    openHost(path) { [weak self] in
      self?.dismissExtension()
    }
  }

  // ObjC name of UIApplication.open(_:options:completionHandler:). We cannot
  // reference the UIApplication type because the extension is built with
  // APPLICATION_EXTENSION_API_ONLY = YES, so we bind the selector ourselves.
  @objc private protocol HDApplicationOpenURL {
    @objc(openURL:options:completionHandler:)
    func open(_ url: URL, options: [AnyHashable: Any], completionHandler: ((Bool) -> Void)?)
  }

  private func openHost(_ path: String, done: @escaping () -> Void) {
    let scheme = Bundle.main.object(forInfoDictionaryKey: "HostAppScheme") as? String ?? "honeydinner"
    guard let url = URL(string: "\(scheme)://\(path)") else {
      done()
      return
    }
    logExt("openHost \(url.absoluteString)")
    let selector = NSSelectorFromString("openURL:options:completionHandler:")
    var finished = false
    let finish = {
      guard !finished else { return }
      finished = true
      done()
    }
    var opened = false
    var responder: UIResponder? = self
    while let r = responder {
      if r !== self, r.responds(to: selector) {
        let opener = unsafeBitCast(r, to: HDApplicationOpenURL.self)
        opener.open(url, options: [:], completionHandler: { success in
          self.logExt("openURL:options:completionHandler: \(success) via \(type(of: r))")
          DispatchQueue.main.async(execute: finish)
        })
        opened = true
        logExt("opened via responder \(type(of: r))")
        break
      }
      responder = r.next
    }
    if !opened {
      extensionContext?.open(url) { success in
        self.logExt("extensionContext.open \(success)")
        DispatchQueue.main.async(execute: finish)
      }
    }
    // Never dismiss before the open has a chance to leave the extension.
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: finish)
  }
}
