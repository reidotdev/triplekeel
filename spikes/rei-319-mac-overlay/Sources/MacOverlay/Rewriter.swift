import Foundation
import FoundationModels

/// One weak spot the model found, with its fix.
struct Issue: Equatable {
    let habit: String
    let quote: String
    let hint: String
    let replacement: String
}

/// Asks Apple's on-device model for up to two weak spots in a prompt and
/// a senior rewrite of each. Nothing leaves the Mac.
final class Rewriter {
    static var isAvailable: Bool {
        if case .available = SystemLanguageModel.default.availability { return true }
        return false
    }

    /// The track's habits, with one-line definitions for the model.
    static let habits: [(id: String, definition: String)] = [
        ("target_user", "names a specific user or audience"),
        ("problem", "states the problem or pain, not only the feature"),
        ("success_metric", "says how to tell it worked: a number, target or outcome"),
        ("acceptance", "lists concrete conditions the finished work must meet"),
        ("scope_cut", "says what to leave out or keep for later"),
        ("decomposed", "splits the work into ordered steps"),
        ("context_given", "gives examples, references or the current state"),
        ("specific_feedback", "for follow-ups: says exactly what is wrong and what to change"),
        ("asks_tests", "asks for tests or a way to check the result"),
        ("cost_latency", "mentions cost, speed, a deadline or another limit"),
        ("edge_cases", "mentions errors, empty states or edge cases"),
        ("constraints", "names a technology, platform or format to use"),
    ]

    static let instructions = """
        You coach people to write prompts for AI tools like a senior product manager would.
        Find at most two places where the prompt would get a much better result with one of these habits:
        \(habits.map { "- \($0.id): \($0.definition)" }.joined(separator: "\n"))

        Rules:
        - Look for vague words that should be specific, like "better", "nice", "good", "fix it" or "an app".
        - The quote is 2 to 6 words copied exactly from the prompt: the vague word plus the words it belongs to. Never the whole prompt.
        - The replacement rewrites only the quoted words so they still fit the sentence.
        - The replacement must be clearly more specific than the quote. Never swap one vague word for another, like "better" for "faster".
        - Put details only the author knows in square brackets, like [your users] or [5%]. Every replacement needs at least one bracket or number.
        - The hint is one short question or sentence that names the gap, so the author learns the habit.
        - If the prompt is already strong, use habit none for both.

        Examples:
        - "converts better" → "converts [5%] of visitors to sign-ups, up from [2%]". success_metric. Hint: Better by how much? A number makes the result checkable.
        - "make it nice" → "make it match [our brand colors] and pass [WCAG AA] contrast". acceptance. Hint: What would make you accept it? Name the conditions.
        - "build an app" → "build an app for [who] who struggle with [problem]". target_user. Hint: Who is it for? The user shapes every design choice.
        - "fix it" → "fix [what's broken] so that [what should happen]". specific_feedback. Hint: What's wrong, and what should it do instead?
        - "add a login page" → "add a login page, then [the next step]; skip [what's out of scope] for now". scope_cut. Hint: What's not in this version?
        """

    private let schema: GenerationSchema
    private let options = GenerationOptions(sampling: .greedy)

    init() throws {
        let habit = DynamicGenerationSchema(
            name: "Habit",
            description: "The habit this fix adds, or none.",
            anyOf: ["none"] + Self.habits.map(\.id)
        )
        let issue = DynamicGenerationSchema(
            name: "Issue",
            properties: [
                .init(name: "habit", description: "The habit, or none if there's nothing to fix.", schema: DynamicGenerationSchema(referenceTo: "Habit")),
                .init(name: "quote", description: "The exact words copied from the prompt to replace. Empty if habit is none.", schema: DynamicGenerationSchema(type: String.self)),
                .init(name: "replacement", description: "The senior rewrite of only the quoted words.", schema: DynamicGenerationSchema(type: String.self)),
                .init(name: "hint", description: "One short sentence on why.", schema: DynamicGenerationSchema(type: String.self)),
            ]
        )
        let root = DynamicGenerationSchema(
            name: "Coaching",
            properties: [
                .init(name: "first", description: "The most useful fix.", schema: DynamicGenerationSchema(referenceTo: "Issue")),
                .init(name: "second", description: "Another fix, or habit none.", schema: DynamicGenerationSchema(referenceTo: "Issue")),
            ]
        )
        schema = try GenerationSchema(root: root, dependencies: [issue, habit])
        // Loads the model early so the first check is faster.
        LanguageModelSession(instructions: Self.instructions).prewarm()
    }

    func analyze(_ text: String) async throws -> [Issue] {
        let session = LanguageModelSession(instructions: Self.instructions)
        let response = try await session.respond(
            to: "Prompt to coach:\n\"\"\"\n\(text)\n\"\"\"",
            schema: schema,
            options: options
        )
        var issues: [Issue] = []
        for key in ["first", "second"] {
            let item = try response.content.value(GeneratedContent.self, forProperty: key)
            let habit = try item.value(String.self, forProperty: "habit")
            let quote = try item.value(String.self, forProperty: "quote")
                .trimmingCharacters(in: CharacterSet(charactersIn: " \"'.,"))
            let replacement = try item.value(String.self, forProperty: "replacement")
            let hint = try item.value(String.self, forProperty: "hint")
            // Keep only fixes grounded in the prompt that change something.
            // A real fix is longer than the quote and adds a detail: a
            // [placeholder] or a number. This drops "better" → "faster".
            let addsDetail = replacement.contains("[") || replacement.rangeOfCharacter(from: .decimalDigits) != nil
            guard habit != "none", !quote.isEmpty, quote.count < text.count,
                  text.range(of: quote, options: .caseInsensitive) != nil,
                  replacement.caseInsensitiveCompare(quote) != .orderedSame,
                  replacement.count > quote.count, addsDetail,
                  !issues.contains(where: { $0.quote.caseInsensitiveCompare(quote) == .orderedSame })
            else { continue }
            issues.append(Issue(habit: habit, quote: quote, hint: hint, replacement: replacement))
        }
        return issues
    }
}
