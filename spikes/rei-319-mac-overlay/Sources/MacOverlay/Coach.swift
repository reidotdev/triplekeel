import AppKit
import ApplicationServices

/// Polls the focused text field, underlines a suggestion, shows the card
/// on hover and writes the fix back on Approve.
final class Coach: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private let statusLine = NSMenuItem(title: "Starting…", action: nil, keyEquivalent: "")
    private let pauseItem = NSMenuItem(title: "Pause", action: #selector(togglePause), keyEquivalent: "")
    private let underline = UnderlinePanel()
    private let card = CardPanel()
    private let findings = Findings()

    private var paused = false
    private var enabledPIDs: Set<pid_t> = []

    // Current target.
    private var targetApp: NSRunningApplication?
    private var targetElement: AXUIElement?
    private var suggestion: Suggestion?
    private var textRect: CGRect?   // AppKit coordinates
    private var cardVisible = false
    private var lastInside = Date.distantPast
    private var writing = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        setUpMenu()
        card.onApprove = { [weak self] in self?.approve() }

        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        if !AXIsProcessTrustedWithOptions(options) {
            print("Accessibility permission needed. Allow your terminal app in System Settings → Privacy & Security → Accessibility, then run again.")
            statusLine.title = "Needs Accessibility permission"
        }

        Timer.scheduledTimer(withTimeInterval: 0.3, repeats: true) { [weak self] _ in self?.poll() }
        Timer.scheduledTimer(withTimeInterval: 0.08, repeats: true) { [weak self] _ in self?.trackMouse() }
        print("Triplekeel overlay spike running. Focus a text field in Claude, Cursor or Chrome and type.")
        print("Try: \"make it better\", \"fix it\" or \"build an app\". Any other text gets a test underline.")
    }

    func applicationWillTerminate(_ notification: Notification) {
        print("\n" + findings.markdown())
    }

    // MARK: - Menu

    private func setUpMenu() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "TK"
        let menu = NSMenu()
        statusLine.isEnabled = false
        menu.addItem(statusLine)
        menu.addItem(.separator())
        pauseItem.target = self
        menu.addItem(pauseItem)
        let copy = NSMenuItem(title: "Copy report", action: #selector(copyReport), keyEquivalent: "c")
        copy.target = self
        menu.addItem(copy)
        menu.addItem(NSMenuItem(title: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        statusItem.menu = menu
    }

    @objc private func togglePause() {
        paused.toggle()
        pauseItem.title = paused ? "Resume" : "Pause"
        if paused { clear() }
    }

    @objc private func copyReport() {
        let report = findings.markdown()
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(report, forType: .string)
        print("\n" + report + "\n(Copied to the clipboard.)")
    }

    // MARK: - Polling

    private func poll() {
        guard !paused, !writing, !cardVisible, AXIsProcessTrusted() else { return }
        guard let app = NSWorkspace.shared.frontmostApplication,
              app.processIdentifier != ProcessInfo.processInfo.processIdentifier
        else { return clear() }

        if !enabledPIDs.contains(app.processIdentifier) {
            AX.enableTree(for: app)
            enabledPIDs.insert(app.processIdentifier)
        }

        guard let element = AX.focusedElement(in: app) else {
            statusLine.title = "\(app.localizedName ?? "App"): no focused element"
            return clear()
        }
        let role = AX.string(element, kAXRoleAttribute)
        let subrole = AX.string(element, kAXSubroleAttribute)
        // Never touch password fields.
        if role == "AXSecureTextField" || subrole == "AXSecureTextField" { return clear() }

        guard let value = AX.string(element, kAXValueAttribute), AX.selectedRange(element) != nil else {
            statusLine.title = "\(app.localizedName ?? "App"): \(role ?? "?") isn't a readable text field"
            findings.record(app: app, role: role, read: false, bounds: nil, multiLine: false)
            return clear()
        }

        guard let found = Suggestions.find(in: value) else {
            statusLine.title = "\(app.localizedName ?? "App"): \(role ?? "?"), nothing to underline"
            return clear()
        }

        let (bounds, method, multiLine) = locate(found, in: element, value: value)

        findings.record(app: app, role: role, read: true, bounds: bounds, method: method, multiLine: multiLine)
        statusLine.title = "\(app.localizedName ?? "App"): \(role ?? "?"), \(value.utf16.count) chars, position: \(method ?? "missing")"

        targetApp = app
        targetElement = element
        suggestion = found
        if let bounds {
            let rect = AX.toCocoa(bounds)
            textRect = rect
            underline.show(under: rect)
        } else {
            textRect = nil
            underline.orderOut(nil)
        }
    }

    /// Finds where the suggestion's text is on screen, trying the exact
    /// methods first and estimates last. Returns Accessibility coordinates.
    private func locate(_ found: Suggestion, in element: AXUIElement, value: String) -> (CGRect?, String?, Bool) {
        let range = CFRange(location: found.range.location, length: found.range.length)

        // 1. Exact: ask the field for the range's bounds. Works in native
        //    text fields; Chromium usually doesn't answer.
        if let rect = AX.bounds(element, range: range), rect.width > 0, rect.height > 0 {
            if let first = AX.bounds(element, range: CFRange(location: range.location, length: 1)),
               first.height > 0, rect.height > first.height * 1.6 {
                // Wrapped text: underline only the first line.
                return (CGRect(x: rect.minX, y: first.minY, width: rect.maxX - rect.minX, height: first.height), "range", true)
            }
            return (rect, "range", false)
        }

        // 2. Chromium: find the AXStaticText run that holds the words and
        //    ask it for the range, or estimate inside its frame.
        if let child = AX.staticText(containing: found.original, under: element),
           let childValue = AX.string(child, kAXValueAttribute) {
            let ns = childValue as NSString
            let local = ns.range(of: found.original, options: .caseInsensitive)
            if local.location != NSNotFound {
                let childRange = CFRange(location: local.location, length: local.length)
                if let rect = AX.bounds(child, range: childRange), rect.width > 0, rect.height > 0 {
                    return (rect, "text run range", false)
                }
                if let frame = AX.frame(child) {
                    return (estimate(local, length: ns.length, in: frame), "text run estimate", frame.height > 30)
                }
            }
        }

        // 3. Last resort: estimate inside the whole field.
        if let frame = AX.frame(element) {
            return (estimate(found.range, length: (value as NSString).length, in: frame), "field estimate", frame.height > 40)
        }
        return (nil, nil, false)
    }

    /// Places a range proportionally along the first line of a frame. Rough,
    /// but enough to test the card and the write-back where Chromium gives
    /// no exact positions.
    private func estimate(_ range: NSRange, length: Int, in frame: CGRect) -> CGRect {
        let total = CGFloat(max(length, 1))
        let lineHeight = min(frame.height, 22)
        let x = frame.minX + frame.width * CGFloat(range.location) / total
        let width = max(frame.width * CGFloat(range.length) / total, 12)
        return CGRect(x: x, y: frame.minY, width: min(width, frame.maxX - x), height: lineHeight)
    }

    private func clear() {
        targetElement = nil
        suggestion = nil
        textRect = nil
        underline.orderOut(nil)
        if cardVisible { hideCard() }
    }

    // MARK: - Hover

    private func trackMouse() {
        guard let rect = textRect, let suggestion else { return }
        let mouse = NSEvent.mouseLocation
        let overText = rect.insetBy(dx: -2, dy: -4).contains(mouse)
        let overCard = cardVisible && card.frame.insetBy(dx: -6, dy: -6).contains(mouse)

        if overText || overCard { lastInside = Date() }
        if overText, !cardVisible {
            cardVisible = true
            card.show(suggestion, below: rect)
        } else if cardVisible, !overText, !overCard, Date().timeIntervalSince(lastInside) > 0.6 {
            hideCard()
        }
    }

    private func hideCard() {
        cardVisible = false
        card.hide()
    }

    // MARK: - Write back

    private func approve() {
        guard let app = targetApp, let element = targetElement, let suggestion else { return }
        writing = true
        hideCard()
        underline.orderOut(nil)

        let range = CFRange(location: suggestion.range.location, length: suggestion.range.length)

        // 1. Accessibility: select the range, then replace the selection.
        let selectError = AX.setSelectedRange(element, range)
        let replaceError = AX.setSelectedText(element, suggestion.replacement)
        if replaced(element, suggestion) {
            findings.recordWrite(app: app, result: "accessibility ok")
            writing = false
            return
        }

        // 2. Clipboard: select the range, paste, then restore the clipboard.
        app.activate()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
            guard let self else { return }
            let reselect = AX.setSelectedRange(element, range)
            let saved = NSPasteboard.general.string(forType: .string)
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(suggestion.replacement, forType: .string)
            Self.pressCommandV()

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                let ok = self.replaced(element, suggestion)
                NSPasteboard.general.clearContents()
                if let saved { NSPasteboard.general.setString(saved, forType: .string) }
                let detail = "accessibility failed (select \(selectError.rawValue), replace \(replaceError.rawValue)); "
                    + "paste \(ok ? "ok" : "failed") (select \(reselect.rawValue))"
                self.findings.recordWrite(app: app, result: detail)
                self.writing = false
            }
        }
    }

    /// True if the field now holds the replacement where the original was.
    private func replaced(_ element: AXUIElement, _ suggestion: Suggestion) -> Bool {
        guard let text = AX.string(element, kAXValueAttribute) else { return false }
        let value = text as NSString
        let range = NSRange(location: suggestion.range.location, length: (suggestion.replacement as NSString).length)
        guard NSMaxRange(range) <= value.length else { return false }
        return value.substring(with: range) == suggestion.replacement
    }

    private static func pressCommandV() {
        let source = CGEventSource(stateID: .combinedSessionState)
        let vKey: CGKeyCode = 9
        let down = CGEvent(keyboardEventSource: source, virtualKey: vKey, keyDown: true)
        let up = CGEvent(keyboardEventSource: source, virtualKey: vKey, keyDown: false)
        down?.flags = .maskCommand
        up?.flags = .maskCommand
        down?.post(tap: .cghidEventTap)
        up?.post(tap: .cghidEventTap)
    }
}
