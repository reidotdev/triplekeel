import Foundation
import FoundationModels

/// REI-320: checks Apple's on-device model against the REI-247 hand labels.
///
/// Usage: swift run CheckModels [--mode batch|single|both] [--runs N]
///        [--only p01,p03] [--prompts path] [--habits path] [--out dir]
@main
struct CheckModels {
    static func main() async {
        do {
            try await run(Options(CommandLine.arguments.dropFirst()))
        } catch {
            print("Error: \(error)")
            exit(1)
        }
    }

    static func run(_ options: Options) async throws {
        switch SystemLanguageModel.default.availability {
        case .available:
            break
        case .unavailable(let reason):
            print("Apple's on-device model isn't available: \(reason)")
            print("Turn on Apple Intelligence in System Settings and wait for the model to download.")
            exit(1)
        }

        var rows = try Loader.load([PromptRow].self, from: options.promptsPath)
        if let only = options.only { rows = rows.filter { only.contains($0.id) } }
        let habits = try Loader.load([Habit].self, from: options.habitsPath)
        try check(habits, against: rows)
        // Derived habits aren't asked. The report works them out.
        let asked = habits.filter { !Derived.ids.contains($0.id) }
        let batchSchema = try Schemas.batch(asked)
        let singleSchema = try Schemas.single(allowNA: false)
        let singleSchemaNA = try Schemas.single(allowNA: true)

        let runner = Runner(habits: asked)
        print("Warming up the model…")
        let warmUpMs = try await runner.warmUp()
        print("Warm-up: \(Int(warmUpMs)) ms. Checking \(rows.count) prompts, \(options.runs) run(s), modes: \(options.modes.joined(separator: ", ")).")

        var calls: [CallRecord] = []
        for run in 1...options.runs {
            for mode in options.modes {
                for (index, row) in rows.enumerated() {
                    if mode == "batch" {
                        calls.append(await runner.batch(row, run: run, schema: batchSchema))
                    } else {
                        for habit in asked {
                            let schema = Schemas.naHabits.contains(habit.id) ? singleSchemaNA : singleSchema
                            calls.append(await runner.single(row, habit: habit, run: run, schema: schema))
                        }
                    }
                    let last = calls.last
                    print("run \(run) · \(mode) · \(index + 1)/\(rows.count) \(row.id) · \(Int(last?.ms ?? 0)) ms · \(last?.thermal ?? "")\(last?.error == nil ? "" : " · error")")
                }
            }
        }

        let report = Report(rows: rows, habits: habits, calls: calls, warmUpMs: warmUpMs, runs: options.runs)
        let markdown = report.markdown()
        try save(markdown: markdown, calls: calls, to: options.outDir)
        print("")
        print(markdown)
    }

    /// Each habit in habits.json must be listed once and have labels.
    static func check(_ habits: [Habit], against rows: [PromptRow]) throws {
        let ids = habits.map(\.id)
        guard Set(ids).count == ids.count, !ids.isEmpty else {
            throw HarnessError("habits.json must list each habit once.")
        }
        let labelled = Set(rows.flatMap { $0.expected.keys })
        let unlabelled = ids.filter { !labelled.contains($0) }
        guard unlabelled.isEmpty else {
            throw HarnessError("These habits have no labels in the prompts file: \(unlabelled).")
        }
    }

    static func save(markdown: String, calls: [CallRecord], to dir: String) throws {
        let folder = URL(fileURLWithPath: dir)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd-HHmmss"
        let stamp = formatter.string(from: Date())

        try markdown.write(to: folder.appendingPathComponent("\(stamp).md"), atomically: true, encoding: .utf8)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(calls).write(to: folder.appendingPathComponent("\(stamp).json"))
        print("Saved \(dir)/\(stamp).md and \(dir)/\(stamp).json")
    }
}

struct Options {
    var modes = ["batch", "single"]
    var runs = 1
    var only: Set<String>?
    var promptsPath = "../rei-247-gemma-speed/prompts.json"
    var habitsPath = "habits.json"
    var outDir = "results"

    init<S: Sequence>(_ args: S) throws where S.Element == String {
        var iterator = args.makeIterator()
        while let flag = iterator.next() {
            guard let value = iterator.next() else { throw HarnessError("Missing value for \(flag).") }
            switch flag {
            case "--mode":
                guard ["batch", "single", "both"].contains(value) else { throw HarnessError("--mode must be batch, single or both.") }
                modes = value == "both" ? ["batch", "single"] : [value]
            case "--runs":
                guard let n = Int(value), n > 0 else { throw HarnessError("--runs must be a positive number.") }
                runs = n
            case "--only":
                only = Set(value.split(separator: ",").map { String($0).trimmingCharacters(in: .whitespaces) })
            case "--prompts": promptsPath = value
            case "--habits": habitsPath = value
            case "--out": outDir = value
            default: throw HarnessError("Unknown option \(flag).")
            }
        }
    }
}

struct HarnessError: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}
