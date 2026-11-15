import AppKit
import ApplicationServices

/// Thin helpers over the Accessibility API. All ranges are UTF-16 offsets,
/// which is what the Accessibility API uses.
enum AX {
    static func element(_ element: AXUIElement, _ name: String) -> AXUIElement? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success,
              let value, CFGetTypeID(value) == AXUIElementGetTypeID()
        else { return nil }
        return (value as! AXUIElement)
    }

    static func string(_ element: AXUIElement, _ name: String) -> String? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else { return nil }
        return value as? String
    }

    static func selectedRange(_ element: AXUIElement) -> CFRange? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, kAXSelectedTextRangeAttribute as CFString, &value) == .success,
              let value, CFGetTypeID(value) == AXValueGetTypeID()
        else { return nil }
        var range = CFRange()
        return AXValueGetValue(value as! AXValue, .cfRange, &range) ? range : nil
    }

    /// Screen rectangle of a text range, in Accessibility coordinates
    /// (origin at the top left of the main display).
    static func bounds(_ element: AXUIElement, range: CFRange) -> CGRect? {
        var range = range
        guard let axRange = AXValueCreate(.cfRange, &range) else { return nil }
        var value: CFTypeRef?
        guard AXUIElementCopyParameterizedAttributeValue(
            element, kAXBoundsForRangeParameterizedAttribute as CFString, axRange, &value
        ) == .success, let value, CFGetTypeID(value) == AXValueGetTypeID()
        else { return nil }
        var rect = CGRect.zero
        return AXValueGetValue(value as! AXValue, .cgRect, &rect) ? rect : nil
    }

    /// An element's own frame, in Accessibility coordinates.
    static func frame(_ element: AXUIElement) -> CGRect? {
        var positionValue: CFTypeRef?
        var sizeValue: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, kAXPositionAttribute as CFString, &positionValue) == .success,
              AXUIElementCopyAttributeValue(element, kAXSizeAttribute as CFString, &sizeValue) == .success,
              let positionValue, let sizeValue,
              CFGetTypeID(positionValue) == AXValueGetTypeID(), CFGetTypeID(sizeValue) == AXValueGetTypeID()
        else { return nil }
        var point = CGPoint.zero
        var size = CGSize.zero
        guard AXValueGetValue(positionValue as! AXValue, .cgPoint, &point),
              AXValueGetValue(sizeValue as! AXValue, .cgSize, &size),
              size.width > 0, size.height > 0
        else { return nil }
        return CGRect(origin: point, size: size)
    }

    static func children(_ element: AXUIElement) -> [AXUIElement] {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &value) == .success,
              let array = value as? [AnyObject]
        else { return [] }
        return array.compactMap { item in
            CFGetTypeID(item) == AXUIElementGetTypeID() ? (item as! AXUIElement) : nil
        }
    }

    /// Chromium exposes the text of an editable field as AXStaticText
    /// children, one per line or run. Finds the first one that contains
    /// `text`, breadth-first, looking at no more than 300 elements.
    static func staticText(containing text: String, under root: AXUIElement) -> AXUIElement? {
        var queue = children(root)
        var seen = 0
        while !queue.isEmpty, seen < 300 {
            let element = queue.removeFirst()
            seen += 1
            if string(element, kAXRoleAttribute) == "AXStaticText",
               let value = string(element, kAXValueAttribute),
               value.range(of: text, options: .caseInsensitive) != nil {
                return element
            }
            queue.append(contentsOf: children(element))
        }
        return nil
    }

    @discardableResult
    static func setSelectedRange(_ element: AXUIElement, _ range: CFRange) -> AXError {
        var range = range
        guard let axRange = AXValueCreate(.cfRange, &range) else { return .failure }
        return AXUIElementSetAttributeValue(element, kAXSelectedTextRangeAttribute as CFString, axRange)
    }

    @discardableResult
    static func setSelectedText(_ element: AXUIElement, _ text: String) -> AXError {
        AXUIElementSetAttributeValue(element, kAXSelectedTextAttribute as CFString, text as CFString)
    }

    /// Chrome and Electron apps build their Accessibility tree only when
    /// they think assistive technology is running. These flags ask them to.
    static func enableTree(for app: NSRunningApplication) {
        let element = AXUIElementCreateApplication(app.processIdentifier)
        AXUIElementSetAttributeValue(element, "AXManualAccessibility" as CFString, kCFBooleanTrue)
        let id = (app.bundleIdentifier ?? "").lowercased()
        let chromium = ["chrome", "chromium", "brave", "edgemac", "vivaldi", "arc", "opera"]
        if chromium.contains(where: { id.contains($0) }) {
            AXUIElementSetAttributeValue(element, "AXEnhancedUserInterface" as CFString, kCFBooleanTrue)
        }
    }

    static func focusedElement(in app: NSRunningApplication) -> AXUIElement? {
        let appElement = AXUIElementCreateApplication(app.processIdentifier)
        return element(appElement, kAXFocusedUIElementAttribute)
            ?? element(AXUIElementCreateSystemWide(), kAXFocusedUIElementAttribute)
    }

    /// Converts an Accessibility rectangle (top-left origin) to AppKit
    /// screen coordinates (bottom-left origin).
    static func toCocoa(_ rect: CGRect) -> CGRect {
        let mainHeight = NSScreen.screens.first?.frame.height ?? 0
        return CGRect(x: rect.minX, y: mainHeight - rect.maxY, width: rect.width, height: rect.height)
    }
}
