import FoundationModels

/// Typed output schemas for guided generation, built at runtime with
/// `DynamicGenerationSchema`. This avoids the `@Generable` macro, whose
/// plugin ships only with full Xcode, not the Command Line Tools.
enum Schemas {
    /// Answer values the model may pick. `notApplicable` maps to "n/a".
    static let answers = ["yes", "partly", "no", "notApplicable"]

    static let quoteDescription =
        "The exact words copied from the prompt that show this habit. An empty string if nothing in the prompt shows it."
    static let answerDescription =
        "yes if the prompt clearly shows the habit, partly if only partly, no if it doesn't, notApplicable only if the habit can't apply to this kind of prompt."

    private static func answer() -> DynamicGenerationSchema {
        DynamicGenerationSchema(name: "Answer", description: "One habit answer.", anyOf: answers)
    }

    /// One habit check. The quote comes first so the model finds the
    /// evidence before it answers.
    private static func habitCheck() -> DynamicGenerationSchema {
        DynamicGenerationSchema(
            name: "HabitCheck",
            properties: [
                .init(name: "quote", description: quoteDescription, schema: DynamicGenerationSchema(type: String.self)),
                .init(name: "answer", description: answerDescription, schema: DynamicGenerationSchema(referenceTo: "Answer")),
            ]
        )
    }

    /// Single mode: one habit per call.
    static func single() throws -> GenerationSchema {
        try GenerationSchema(root: habitCheck(), dependencies: [answer()])
    }

    /// Batch mode: one property per habit, named by its track ID and
    /// described by its definition from habits.json.
    static func batch(_ habits: [Habit]) throws -> GenerationSchema {
        let root = DynamicGenerationSchema(
            name: "PromptCheck",
            properties: habits.map { habit in
                .init(name: habit.id, description: habit.definition, schema: DynamicGenerationSchema(referenceTo: "HabitCheck"))
            }
        )
        return try GenerationSchema(root: root, dependencies: [habitCheck(), answer()])
    }

    /// Reads one habit check out of generated content.
    static func verdict(from content: GeneratedContent, habit: String) throws -> Verdict {
        let quote = try content.value(String.self, forProperty: "quote")
        let answer = try content.value(String.self, forProperty: "answer")
        return Verdict(habit: habit, answer: answer == "notApplicable" ? "n/a" : answer, quote: quote)
    }
}
