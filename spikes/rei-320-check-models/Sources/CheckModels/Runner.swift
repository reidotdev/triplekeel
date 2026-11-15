import Foundation
import FoundationModels

/// Runs Apple's on-device model over the prompts. Nothing leaves the Mac.
struct Runner {
    let habits: [Habit]
    let options = GenerationOptions(sampling: .greedy)

    static let preamble = """
        You check a prompt that someone wrote for an AI tool against prompt-writing habits.
        Judge only what the prompt says. Don't guess or assume.
        Copy quotes exactly from the prompt. Never invent a quote.
        If nothing in the prompt shows a habit, leave the quote empty and answer no.
        """

    /// Loads the model with a throwaway call so the first timed call
    /// doesn't include start-up. Returns how long that took.
    func warmUp() async throws -> Double {
        let clock = ContinuousClock()
        let start = clock.now
        let session = LanguageModelSession(instructions: Self.preamble)
        _ = try await session.respond(to: "Reply with the word ok.", options: options)
        return start.duration(to: clock.now).milliseconds
    }

    /// One call per prompt, all 16 habits at once.
    func batch(_ row: PromptRow, run: Int, schema: GenerationSchema) async -> CallRecord {
        let instructions = """
            \(Self.preamble)

            Each property of your answer is one habit. Its description defines the habit.
            """
        let session = LanguageModelSession(instructions: instructions)

        let clock = ContinuousClock()
        let start = clock.now
        do {
            let response = try await session.respond(
                to: Self.wrap(row.text),
                schema: schema,
                options: options
            )
            let ms = start.duration(to: clock.now).milliseconds
            let verdicts = try habits.map { habit in
                let check = try response.content.value(GeneratedContent.self, forProperty: habit.id)
                return try Schemas.verdict(from: check, habit: habit.id)
            }
            return record(mode: "batch", run: run, row: row, habit: nil, ms: ms, verdicts: verdicts)
        } catch {
            let ms = start.duration(to: clock.now).milliseconds
            return record(mode: "batch", run: run, row: row, habit: nil, ms: ms, error: error)
        }
    }

    /// One call per habit. Slower, but each call has a short context.
    func single(_ row: PromptRow, habit: Habit, run: Int, schema: GenerationSchema) async -> CallRecord {
        let instructions = """
            \(Self.preamble)

            The habit to check:
            \(habit.definition)
            """
        let session = LanguageModelSession(instructions: instructions)

        let clock = ContinuousClock()
        let start = clock.now
        do {
            let response = try await session.respond(
                to: Self.wrap(row.text),
                schema: schema,
                options: options
            )
            let ms = start.duration(to: clock.now).milliseconds
            let verdict = try Schemas.verdict(from: response.content, habit: habit.id)
            return record(mode: "single", run: run, row: row, habit: habit.id, ms: ms, verdicts: [verdict])
        } catch {
            let ms = start.duration(to: clock.now).milliseconds
            return record(mode: "single", run: run, row: row, habit: habit.id, ms: ms, error: error)
        }
    }

    private static func wrap(_ text: String) -> String {
        """
        Prompt to check:
        \"\"\"
        \(text)
        \"\"\"
        """
    }

    private func record(
        mode: String, run: Int, row: PromptRow, habit: String?, ms: Double,
        verdicts: [Verdict] = [], error: Error? = nil
    ) -> CallRecord {
        CallRecord(
            mode: mode,
            run: run,
            promptID: row.id,
            habit: habit,
            ms: ms,
            thermal: ProcessInfo.processInfo.thermalState.label,
            error: error.map { String(describing: $0) },
            verdicts: verdicts
        )
    }
}
