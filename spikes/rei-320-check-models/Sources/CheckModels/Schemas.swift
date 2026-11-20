import FoundationModels

/// Typed output schemas for guided generation, built at runtime with
/// `DynamicGenerationSchema`. This avoids the `@Generable` macro, whose
/// plugin ships only with full Xcode, not the Command Line Tools.
enum Schemas {
    /// Only follow-up habits may be n/a. The first full run overused n/a
    /// when every habit allowed it.
    static let naHabits: Set<String> = ["specific_feedback", "vague_fix"]

    static let quoteDescription =
        "The exact words copied from the prompt that show this habit. An empty string if nothing in the prompt shows it."
    static let answerDescription =
        "yes if the quote clearly shows the habit, partly if only partly, no if the quote is empty."

    private static func answer(allowNA: Bool) -> DynamicGenerationSchema {
        DynamicGenerationSchema(
            name: allowNA ? "AnswerWithNA" : "Answer",
            description: allowNA ? "notApplicable if the prompt starts something new instead of following up." : "One habit answer.",
            anyOf: allowNA ? ["yes", "partly", "no", "notApplicable"] : ["yes", "partly", "no"]
        )
    }

    /// One habit check. The quote comes first so the answer rests on
    /// evidence. Answer-first was tried and was less accurate: the model
    /// said yes without any quote.
    private static func habitCheck(allowNA: Bool) -> DynamicGenerationSchema {
        DynamicGenerationSchema(
            name: allowNA ? "HabitCheckWithNA" : "HabitCheck",
            properties: [
                .init(name: "quote", description: quoteDescription, schema: DynamicGenerationSchema(type: String.self)),
                .init(name: "answer", description: answerDescription, schema: DynamicGenerationSchema(referenceTo: allowNA ? "AnswerWithNA" : "Answer")),
            ]
        )
    }

    /// Single mode: one habit per call.
    static func single(allowNA: Bool) throws -> GenerationSchema {
        try GenerationSchema(root: habitCheck(allowNA: allowNA), dependencies: [answer(allowNA: allowNA)])
    }

    /// Batch mode: one property per habit, named by its track ID and
    /// described by its definition from habits.json.
    static func batch(_ habits: [Habit]) throws -> GenerationSchema {
        let root = DynamicGenerationSchema(
            name: "PromptCheck",
            properties: habits.map { habit in
                .init(
                    name: habit.id,
                    description: habit.definition,
                    schema: DynamicGenerationSchema(referenceTo: naHabits.contains(habit.id) ? "HabitCheckWithNA" : "HabitCheck")
                )
            }
        )
        return try GenerationSchema(
            root: root,
            dependencies: [habitCheck(allowNA: false), habitCheck(allowNA: true), answer(allowNA: false), answer(allowNA: true)]
        )
    }

    /// Reads one habit check out of generated content.
    static func verdict(from content: GeneratedContent, habit: String) throws -> Verdict {
        let answer = try content.value(String.self, forProperty: "answer")
        let quote = try content.value(String.self, forProperty: "quote")
        return Verdict(habit: habit, answer: answer == "notApplicable" ? "n/a" : answer, quote: quote)
    }
}

/// Habits worked out from other answers instead of asked. The first run
/// flagged `no_why` on almost any feature request.
enum Derived {
    static let ids: Set<String> = ["no_why"]

    /// `no_why`: a feature with no user and no reason behind it.
    static func verdicts(from answers: [String: String]) -> [Verdict] {
        guard let user = answers["target_user"], let problem = answers["problem"] else {
            return [Verdict(habit: "no_why", answer: "missing", quote: "")]
        }
        // A bare "fix it" follow-up is vague_fix, not a feature request.
        let followUp = answers["vague_fix"] == "yes"
        let answer = (user == "no" && problem == "no" && !followUp) ? "yes" : "no"
        return [Verdict(habit: "no_why", answer: answer, quote: "")]
    }
}
