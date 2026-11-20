import AppKit

/// A click-through strip drawn under the target text.
final class UnderlinePanel: NSPanel {
    init() {
        super.init(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        isOpaque = false
        backgroundColor = .clear
        hasShadow = false
        ignoresMouseEvents = true
        level = .statusBar
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        contentView = UnderlineView()
    }

    /// `textRect` is in AppKit screen coordinates.
    func show(under textRect: CGRect) {
        setFrame(CGRect(x: textRect.minX, y: textRect.minY - 3, width: max(textRect.width, 8), height: 4), display: true)
        orderFrontRegardless()
    }
}

private final class UnderlineView: NSView {
    override func draw(_ dirtyRect: NSRect) {
        NSColor.systemOrange.setFill()
        NSBezierPath(roundedRect: bounds.insetBy(dx: 0, dy: 1), xRadius: 1, yRadius: 1).fill()
    }
}

/// The hover card: habit, hint, suggested text and a delayed Approve button.
final class CardPanel: NSPanel {
    var onApprove: (() -> Void)?

    private let habitLabel = NSTextField(labelWithString: "")
    private let hintLabel = NSTextField(wrappingLabelWithString: "")
    private let replacementLabel = NSTextField(wrappingLabelWithString: "")
    private let approveButton = NSButton(title: "Approve", target: nil, action: nil)
    private var unlockTimer: Timer?

    init() {
        super.init(contentRect: CGRect(x: 0, y: 0, width: 320, height: 150),
                   styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        level = .statusBar
        becomesKeyOnlyIfNeeded = true
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]

        let background = NSVisualEffectView()
        background.material = .popover
        background.state = .active
        background.wantsLayer = true
        background.layer?.cornerRadius = 10

        habitLabel.font = .systemFont(ofSize: 11, weight: .semibold)
        habitLabel.textColor = .secondaryLabelColor
        hintLabel.font = .systemFont(ofSize: 12)
        replacementLabel.font = .systemFont(ofSize: 13, weight: .medium)
        approveButton.target = self
        approveButton.action = #selector(approve)
        approveButton.bezelStyle = .rounded
        approveButton.keyEquivalent = ""

        let stack = NSStackView(views: [habitLabel, hintLabel, replacementLabel, approveButton])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 6
        stack.edgeInsets = NSEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)
        stack.translatesAutoresizingMaskIntoConstraints = false
        background.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: background.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: background.trailingAnchor),
            stack.topAnchor.constraint(equalTo: background.topAnchor),
            stack.bottomAnchor.constraint(equalTo: background.bottomAnchor),
            hintLabel.widthAnchor.constraint(equalToConstant: 296),
            replacementLabel.widthAnchor.constraint(equalToConstant: 296),
        ])
        contentView = background
    }

    // Lets the Approve button take the first click without the panel
    // needing to become key first.
    override var canBecomeKey: Bool { true }

    func show(_ suggestion: Suggestion, below textRect: CGRect) {
        habitLabel.stringValue = suggestion.habit.uppercased()
        hintLabel.stringValue = suggestion.hint
        replacementLabel.stringValue = "→ \(suggestion.replacement)"
        layoutIfNeeded()
        let size = contentView?.fittingSize ?? CGSize(width: 320, height: 150)

        var origin = CGPoint(x: textRect.minX, y: textRect.minY - size.height - 10)
        if let screen = NSScreen.screens.first(where: { $0.frame.intersects(textRect) }) ?? NSScreen.main {
            let visible = screen.visibleFrame
            if origin.y < visible.minY { origin.y = textRect.maxY + 10 }
            origin.x = min(max(origin.x, visible.minX + 8), visible.maxX - size.width - 8)
        }
        setFrame(CGRect(origin: origin, size: size), display: true)
        orderFrontRegardless()
        startDelay(suggestion.readDelay)
    }

    func hide() {
        unlockTimer?.invalidate()
        orderOut(nil)
    }

    private func startDelay(_ delay: TimeInterval) {
        unlockTimer?.invalidate()
        approveButton.isEnabled = false
        let unlockAt = Date().addingTimeInterval(delay)
        approveButton.title = String(format: "Approve (%.1f s)", delay)
        unlockTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] timer in
            guard let self else { return timer.invalidate() }
            let left = unlockAt.timeIntervalSinceNow
            if left <= 0 {
                self.approveButton.title = "Approve"
                self.approveButton.isEnabled = true
                timer.invalidate()
            } else {
                self.approveButton.title = String(format: "Approve (%.1f s)", left)
            }
        }
    }

    @objc private func approve() {
        onApprove?()
    }
}
