import Foundation

/// Turns call records into a Markdown note for Linear.
struct Report {
    let rows: [PromptRow]
    let habits: [Habit]
    let calls: [CallRecord]
    let warmUpMs: Double
    let runs: Int

    /// REI-247 keyword scorer on the same prompts and labels.
    static let keywordBaseline = (correct: 249, total: 289)

    func markdown() -> String {
        var out: [String] = []
        let modes = ["batch", "single"].filter { mode in calls.contains { $0.mode == mode } }

        out.append("## REI-320 check model results")
        out.append("")
        out.append("Apple Foundation Models, on-device, greedy sampling. \(rows.count) prompts, \(habits.count) habits, \(runs) run(s). Warm-up call: \(fmt(warmUpMs)) ms.")
        out.append("Machine: macOS \(ProcessInfo.processInfo.operatingSystemVersionString), \(ProcessInfo.processInfo.physicalMemory / 1_073_741_824) GB memory, Low Power Mode \(ProcessInfo.processInfo.isLowPowerModeEnabled ? "on" : "off").")
        out.append("")

        // Summary table.
        let base = Self.keywordBaseline
        out.append("| Scorer | Strict agreement | Found vs not found | Quote in prompt | p50 ms/prompt | p95 ms/prompt | Errors |")
        out.append("|---|---:|---:|---:|---:|---:|---:|")
        out.append("| Keyword (REI-247) | \(base.correct)/\(base.total) (\(pct(base.correct, base.total))) | – | – | <1 | <8 | – |")
        for mode in modes {
            let a = agreement(mode: mode)
            let q = quotes(mode: mode)
            let perPrompt = promptTimes(mode: mode)
            let errors = calls.filter { $0.mode == mode && $0.error != nil }.count
            out.append("| Apple, \(mode) | \(a.strict)/\(a.total) (\(pct(a.strict, a.total))) | \(a.lenient)/\(a.total) (\(pct(a.lenient, a.total))) | \(q.found)/\(q.total) (\(pct(q.found, q.total))) | \(fmt(percentile(perPrompt, 0.5))) | \(fmt(percentile(perPrompt, 0.95))) | \(errors) |")
        }
        out.append("")
        out.append("- **Strict:** the answer matches the label exactly. Labels of n/a are skipped, as in REI-247.")
        out.append("- **Found vs not found:** yes and partly count as the same.")
        out.append("- **Quote in prompt:** for yes and partly answers, the quote appears word for word in the prompt.")
        out.append("- **Derived:** `no_why` isn't asked. It's yes when `target_user` and `problem` are both no. n/a is offered only for `specific_feedback` and `vague_fix`.")
        out.append("")

        // Per-habit table.
        out.append("### Per habit")
        out.append("")
        let header = modes.map { "Apple \($0)" }.joined(separator: " | ")
        out.append("| Habit | \(header) |")
        out.append("|---|" + String(repeating: "---:|", count: modes.count))
        for habit in habits {
            let cells = modes.map { mode -> String in
                let a = agreement(mode: mode, habit: habit.id)
                return "\(a.strict)/\(a.total) · FP \(a.falsePositive) · FN \(a.falseNegative)"
            }
            out.append("| \(habit.id) | \(cells.joined(separator: " | ")) |")
        }
        out.append("")
        out.append("FP: the model found the habit but the label says no. FN: the label says yes or partly but the model said no or n/a.")
        out.append("")

        // Thermal slowdown.
        out.append("### Speed over time")
        out.append("")
        out.append("| Mode | p50 ms/call | p95 ms/call | First third p50 | Last third p50 | Thermal states seen |")
        out.append("|---|---:|---:|---:|---:|---|")
        for mode in modes {
            let times = calls.filter { $0.mode == mode }.map(\.ms)
            let third = max(times.count / 3, 1)
            let first = Array(times.prefix(third))
            let last = Array(times.suffix(third))
            let thermal = Set(calls.filter { $0.mode == mode }.map(\.thermal)).sorted().joined(separator: ", ")
            out.append("| \(mode) | \(fmt(percentile(times, 0.5))) | \(fmt(percentile(times, 0.95))) | \(fmt(percentile(first, 0.5))) | \(fmt(percentile(last, 0.5))) | \(thermal) |")
        }
        out.append("")

        // Misses, so the definitions can be fixed.
        out.append("### Misses")
        out.append("")
        for mode in modes {
            let misses = missList(mode: mode)
            out.append("**\(mode)** (\(misses.count))")
            out.append("")
            if misses.isEmpty { out.append("None."); out.append("") }
            for miss in misses.prefix(40) { out.append("- \(miss)") }
            if misses.count > 40 { out.append("- … \(misses.count - 40) more in the JSON file") }
            out.append("")
        }

        let errors = calls.compactMap(\.error)
        if !errors.isEmpty {
            out.append("### Errors")
            out.append("")
            for error in Set(errors).sorted().prefix(10) { out.append("- `\(error)`") }
            out.append("")
        }
        return out.joined(separator: "\n")
    }

    // MARK: - Metrics

    struct Agreement {
        var strict = 0
        var lenient = 0
        var total = 0
        var falsePositive = 0
        var falseNegative = 0
    }

    private func verdicts(mode: String) -> [(promptID: String, verdict: Verdict)] {
        calls.filter { $0.mode == mode }.flatMap { call in
            call.verdicts.map { (promptID: call.promptID, verdict: $0) }
        }
    }

    /// All answers for each run and prompt, including derived habits.
    /// Habits with no answer, for example after an error, are "missing",
    /// so a crash can't raise the score.
    private func answerSets(mode: String) -> [(promptID: String, answers: [String: Verdict])] {
        var groups: [String: (promptID: String, answers: [String: Verdict])] = [:]
        var order: [String] = []
        for call in calls where call.mode == mode {
            let key = "\(call.run)/\(call.promptID)"
            if groups[key] == nil {
                groups[key] = (call.promptID, [:])
                order.append(key)
            }
            for verdict in call.verdicts { groups[key]?.answers[verdict.habit] = verdict }
        }
        return order.compactMap { key in
            guard var group = groups[key] else { return nil }
            let plain = group.answers.mapValues(\.answer)
            for verdict in Derived.verdicts(from: plain) { group.answers[verdict.habit] = verdict }
            for habit in habits where group.answers[habit.id] == nil {
                group.answers[habit.id] = Verdict(habit: habit.id, answer: "missing", quote: "")
            }
            return group
        }
    }

    func agreement(mode: String, habit: String? = nil) -> Agreement {
        var a = Agreement()
        let expected = Dictionary(uniqueKeysWithValues: rows.map { ($0.id, $0.expected) })
        for entry in answerSets(mode: mode) {
            for id in habits.map(\.id) where habit == nil || habit == id {
                guard let label = expected[entry.promptID]?[id], label != "n/a" else { continue }
                a.total += 1
                let answer = entry.answers[id]?.answer ?? "missing"
                if answer == label { a.strict += 1 }
                let found = answer == "yes" || answer == "partly"
                let shouldFind = label == "yes" || label == "partly"
                if found == shouldFind { a.lenient += 1 }
                if found && !shouldFind { a.falsePositive += 1 }
                if !found && shouldFind { a.falseNegative += 1 }
            }
        }
        return a
    }

    func quotes(mode: String) -> (found: Int, total: Int) {
        let texts = Dictionary(uniqueKeysWithValues: rows.map { ($0.id, normalize($0.text)) })
        var found = 0
        var total = 0
        for (promptID, verdict) in verdicts(mode: mode) where verdict.answer == "yes" || verdict.answer == "partly" {
            total += 1
            let quote = normalize(verdict.quote)
            if !quote.isEmpty, texts[promptID]?.contains(quote) == true { found += 1 }
        }
        return (found, total)
    }

    /// Time per prompt: one call in batch mode, the sum of 16 calls in single mode.
    func promptTimes(mode: String) -> [Double] {
        var totals: [String: Double] = [:]
        for call in calls where call.mode == mode {
            totals["\(call.run)/\(call.promptID)", default: 0] += call.ms
        }
        return Array(totals.values)
    }

    private func missList(mode: String) -> [String] {
        let expected = Dictionary(uniqueKeysWithValues: rows.map { ($0.id, $0.expected) })
        var misses: [String] = []
        for entry in answerSets(mode: mode) {
            for habit in habits {
                guard let verdict = entry.answers[habit.id],
                      let label = expected[entry.promptID]?[habit.id], label != "n/a", label != verdict.answer
                else { continue }
                let quote = verdict.quote.isEmpty ? "" : " · \"\(verdict.quote)\""
                let derived = Derived.ids.contains(habit.id) ? " (derived)" : ""
                misses.append("\(entry.promptID) \(habit.id)\(derived): said \(verdict.answer), label \(label)\(quote)")
            }
        }
        return misses
    }

    // MARK: - Helpers

    /// Lowercases, folds curly quotes and collapses spaces, and trims
    /// surrounding punctuation, so small copy differences still match.
    private func normalize(_ text: String) -> String {
        let folded = text.lowercased()
            .replacingOccurrences(of: "\u{2018}", with: "'")
            .replacingOccurrences(of: "\u{2019}", with: "'")
            .replacingOccurrences(of: "\u{201C}", with: "\"")
            .replacingOccurrences(of: "\u{201D}", with: "\"")
        let words = folded.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        return words.trimmingCharacters(in: CharacterSet(charactersIn: " .,;:!?\"'"))
    }

    private func percentile(_ values: [Double], _ p: Double) -> Double {
        let sorted = values.sorted()
        guard !sorted.isEmpty else { return 0 }
        let index = Int((p * Double(sorted.count)).rounded(.up)) - 1
        return sorted[min(max(index, 0), sorted.count - 1)]
    }

    private func pct(_ part: Int, _ whole: Int) -> String {
        whole == 0 ? "–" : String(format: "%.1f%%", Double(part) / Double(whole) * 100)
    }

    private func fmt(_ ms: Double) -> String {
        String(format: "%.0f", ms)
    }
}
