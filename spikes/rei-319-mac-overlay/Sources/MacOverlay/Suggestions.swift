import Foundation

/// A fix placed in the current text: where it is and what replaces it.
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

    /// Places an issue in the current text, or nil if its words are gone.
    static func place(_ issue: Issue, in text: String) -> Suggestion? {
        let ns = text as NSString
        let range = ns.range(of: issue.quote, options: .caseInsensitive)
        guard range.location != NSNotFound else { return nil }
        return Suggestion(range: range, original: ns.substring(with: range), habit: issue.habit,
                          hint: issue.hint, replacement: issue.replacement)
    }
}

/// Hardcoded fixes, used only when Apple's model isn't available.
enum FallbackRules {
    static let issues: [Issue] = [
        Issue(habit: "success_metric", quote: "make it better",
              hint: "Say what \"better\" means, so the result can be checked.",
              replacement: "make it load in under [2 seconds] on mobile"),
        Issue(habit: "specific_feedback", quote: "fix it",
              hint: "Say what's wrong and what the fix should do.",
              replacement: "fix [what's broken] so that [what should happen]"),
    ]

    static func find(in text: String) -> [Issue] {
        issues.filter { text.range(of: $0.quote, options: .caseInsensitive) != nil }
    }
}
