import Foundation

/// A hardcoded suggestion. No models in this spike: the point is to test
/// reading, underlining and writing back, not the advice itself.
struct Suggestion {
    let range: NSRange
    let original: String
    let habit: String
    let hint: String
    let replacement: String

    /// Approve unlocks after a delay that scales with the size of the
    /// change, so the user has time to read it. At least 1 second.
    var readDelay: TimeInterval {
        let words = (original + " " + replacement).split(whereSeparator: \.isWhitespace).count
        return max(1.0, Double(words) * 0.2)
    }
}

enum Suggestions {
    private static let rules: [(pattern: String, habit: String, hint: String, replacement: String)] = [
        ("\\bmake it better\\b", "success_metric", "Say what \"better\" means, so the result can be checked.",
         "make it load in under 2 seconds on mobile"),
        ("\\bfix it\\b", "vague_fix", "Say what's wrong and what the fix should do.",
         "fix the labels that overlap on screens under 320px"),
        ("\\b(an?|the) app\\b", "target_user", "Name who it's for and the problem they have.",
         "an app for freelance designers who miss invoice follow-ups"),
    ]

    /// The first matching rule, or the first 20 characters as a fallback,
    /// so every field gets an underline to test with.
    static func find(in text: String) -> Suggestion? {
        let ns = text as NSString
        guard ns.length > 0 else { return nil }
        for rule in rules {
            let range = ns.range(of: rule.pattern, options: [.regularExpression, .caseInsensitive])
            if range.location != NSNotFound {
                return Suggestion(range: range, original: ns.substring(with: range), habit: rule.habit,
                                  hint: rule.hint, replacement: rule.replacement)
            }
        }
        // Fallback: the first word or two, up to 20 characters, on one line.
        var length = min(20, ns.length)
        let newline = ns.range(of: "\n")
        if newline.location != NSNotFound, newline.location > 0 { length = min(length, newline.location) }
        if newline.location == 0 { return nil }
        let range = NSRange(location: 0, length: length)
        return Suggestion(range: range, original: ns.substring(with: range), habit: "test",
                          hint: "Test suggestion. Approve replaces the underlined text.",
                          replacement: "[Triplekeel test]")
    }
}
