import AppKit
import ApplicationServices

/// Watches the focused prompt box. When the user pauses typing, asks
/// Apple's model for up to two fixes, underlines them, shows a card on
/// hover and writes the fix back on Approve.
final class Coach: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private let statusLine = NSMenuItem(title: "Starting…", action: nil, keyEquivalent: "")
    private let pauseItem = NSMenuItem(title: "Pause", action: #selector(togglePause), keyEquivalent: "")
    private let underlines = [UnderlinePanel(), UnderlinePanel()]
    private let card = CardPanel()
    private let findings = Findings()
    private var rewriter: Rewriter?

    /// How long the text must stay unchanged before it's checked.
    private let pauseBeforeCheck: TimeInterval = 1.2
    /// Shorter prompts aren't worth checking.
    private let minimumLength = 15

    private var paused = false
    private var enabledPIDs: Set<pid_t> = []

    // Current field.
    private var targetApp: NSRunningApplication?
    private var targetElement: AXUIElement?
    private var lastElement: AXUIElement?
    private var lastText = ""
    private var lastChange = Date()

    // Model results for the current text.
    private var issues: [Issue] = []
    private var analyzedText = ""
    private var checking = false
    private var checkStarted = Date()

    // What's on screen.
    private var placed: [(suggestion: Suggestion, rect: CGRect)] = []   // AppKit coordinates
    private var cardIndex: Int?
    private var lastInside = Date.distantPast
    private var writing = false

    // Learning log for this session (REI-322 will store it properly).
    private var approvedHabits: [String: Int] = [:]

    func applicationDidFinishLaunching(_ notification: Notification) {
        setUpMenu()
        card.onApprove = { [weak self] in self?.approve() }

        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        if !AXIsProcessTrustedWithOptions(options) {
            print("Accessibility permission needed. Allow your terminal app in System Settings → Privacy & Security → Accessibility, then run again.")
            statusLine.title = "Needs Accessibility permission"
        }

        if Rewriter.isAvailable {
            do {
                rewriter = try Rewriter()
                print("Using Apple's on-device model. Pause typing for a moment to get suggestions.")
            } catch {
                print("Couldn't set up Apple's model: \(error). Using hardcoded fixes.")
            }
        } else {
            print("Apple's on-device model isn't available. Using hardcoded fixes for \"make it better\" and \"fix it\".")
        }

        Timer.scheduledTimer(withTimeInterval: 0.3, repeats: true) { [weak self] _ in self?.poll() }
        Timer.scheduledTimer(withTimeInterval: 0.08, repeats: true) { [weak self] _ in self?.trackMouse() }
        print("Triplekeel coach running. Type a prompt in claude.ai, ChatGPT, Slack or Notes.")
    }

    func applicationWillTerminate(_ notification: Notification) {
        print("\n" + findings.markdown())
        print(learningSummary())
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
        let report = findings.markdown() + "\n\n" + learningSummary()
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(report, forType: .string)
        print("\n" + report + "\n(Copied to the clipboard.)")
    }

    private func learningSummary() -> String {
        guard !approvedHabits.isEmpty else { return "Approved fixes this session: none." }
        let list = approvedHabits.sorted { $0.value > $1.value }.map { "\($0.key) \($0.value)" }.joined(separator: ", ")
        return "Approved fixes this session: \(list)."
    }

    // MARK: - Polling

    private func poll() {
        guard !paused, !writing, cardIndex == nil, AXIsProcessTrusted() else { return }
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
        // Only multi-line prompt boxes. This skips address bars, search
        // fields and single-line inputs, and never touches password fields.
        guard role == "AXTextArea", subrole != "AXSecureTextField" else { return clear() }

        guard let value = AX.string(element, kAXValueAttribute), AX.selectedRange(element) != nil else {
            findings.record(app: app, role: role, read: false, bounds: nil, multiLine: false)
            return clear()
        }

        // A different field: forget the old field's suggestions.
        if let previous = lastElement, !CFEqual(previous, element) {
            issues = []
            analyzedText = ""
        }
        lastElement = element
        targetApp = app
        targetElement = element

        if value != lastText {
            lastText = value
            lastChange = Date()
        }

        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.count < minimumLength {
            issues = []
            statusLine.title = "\(app.localizedName ?? "App"): waiting for a longer prompt"
            return hideUnderlines()
        }

        // Check once the user pauses, unless this text was already checked.
        if !checking, value != analyzedText, Date().timeIntervalSince(lastChange) >= pauseBeforeCheck {
            check(value, in: app)
        }

        // Place each issue in the current text. Issues whose words were
        // edited away disappear; the rest follow the text as it moves.
        placed = []
        for issue in issues {
            guard let suggestion = Suggestion.place(issue, in: value) else { continue }
            let (bounds, method, multiLine) = locate(suggestion, in: element, value: value)
            findings.record(app: app, role: role, read: true, bounds: bounds, method: method, multiLine: multiLine)
            if let bounds { placed.append((suggestion, AX.toCocoa(bounds))) }
        }
        showUnderlines()

        if checking {
            statusLine.title = "\(app.localizedName ?? "App"): checking…"
        } else {
            statusLine.title = "\(app.localizedName ?? "App"): \(placed.count) suggestion\(placed.count == 1 ? "" : "s")"
        }
    }

    private func check(_ text: String, in app: NSRunningApplication) {
        guard let rewriter else {
            analyzedText = text
            issues = FallbackRules.find(in: text)
            return
        }
        checking = true
        checkStarted = Date()
        Task { @MainActor in
            defer { self.checking = false }
            do {
                let found = try await rewriter.analyze(text)
                let seconds = Date().timeIntervalSince(self.checkStarted)
                // Ignore results for text that has changed since.
                guard text == self.lastText else { return }
                self.issues = found
                self.analyzedText = text
                print("[\(app.localizedName ?? "App")] checked in \(String(format: "%.1f", seconds)) s: "
                      + (found.isEmpty ? "no suggestions" : found.map(\.habit).joined(separator: ", ")))
            } catch {
                self.analyzedText = text
                print("[\(app.localizedName ?? "App")] model error: \(error)")
            }
        }
    }

    /// Finds where a suggestion's text is on screen, trying the exact
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

    /// Places a range proportionally along the first line of a frame.
    private func estimate(_ range: NSRange, length: Int, in frame: CGRect) -> CGRect {
        let total = CGFloat(max(length, 1))
        let lineHeight = min(frame.height, 22)
        let x = frame.minX + frame.width * CGFloat(range.location) / total
        let width = max(frame.width * CGFloat(range.length) / total, 12)
        return CGRect(x: x, y: frame.minY, width: min(width, frame.maxX - x), height: lineHeight)
    }

    private func showUnderlines() {
        for (index, panel) in underlines.enumerated() {
            if index < placed.count {
                panel.show(under: placed[index].rect)
            } else {
                panel.orderOut(nil)
            }
        }
    }

    private func hideUnderlines() {
        placed = []
        underlines.forEach { $0.orderOut(nil) }
    }

    private func clear() {
        targetElement = nil
        hideUnderlines()
        if cardIndex != nil { hideCard() }
    }

    // MARK: - Hover

    private func trackMouse() {
        guard !placed.isEmpty else { return }
        let mouse = NSEvent.mouseLocation
        let overCard = cardIndex != nil && card.frame.insetBy(dx: -6, dy: -6).contains(mouse)
        let hovered = placed.firstIndex { $0.rect.insetBy(dx: -2, dy: -4).contains(mouse) }

        if hovered != nil || overCard { lastInside = Date() }
        if let hovered, hovered != cardIndex, !overCard {
            cardIndex = hovered
            card.show(placed[hovered].suggestion, below: placed[hovered].rect)
        } else if cardIndex != nil, hovered == nil, !overCard, Date().timeIntervalSince(lastInside) > 0.6 {
            hideCard()
        }
    }

    private func hideCard() {
        cardIndex = nil
        card.hide()
    }

    // MARK: - Write back

    private func approve() {
        guard let index = cardIndex, index < placed.count,
              let app = targetApp, let element = targetElement
        else { return }
        let suggestion = placed[index].suggestion
        writing = true
        hideCard()
        hideUnderlines()

        // The approved issue is done; keep the others.
        issues.removeAll { $0.quote.caseInsensitiveCompare(suggestion.original) == .orderedSame }
        approvedHabits[suggestion.habit, default: 0] += 1
        print("[\(app.localizedName ?? "App")] approved: \(suggestion.habit)")

        let range = CFRange(location: suggestion.range.location, length: suggestion.range.length)

        // 1. Accessibility: select the range, then replace the selection.
        let selectError = AX.setSelectedRange(element, range)
        let replaceError = AX.setSelectedText(element, suggestion.replacement)
        if replaced(element, suggestion) {
            findings.recordWrite(app: app, result: "accessibility ok")
            finishWrite(element)
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
                self.finishWrite(element)
            }
        }
    }

    /// After a write, treat the new text as already checked, so the coach
    /// doesn't immediately re-check the fix it just made.
    private func finishWrite(_ element: AXUIElement) {
        if let value = AX.string(element, kAXValueAttribute) {
            lastText = value
            analyzedText = value
        }
        writing = false
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
