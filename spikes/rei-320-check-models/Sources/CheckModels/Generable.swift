import FoundationModels

/// The model's answer for one habit. Mirrors the track's answers:
/// yes, partly, no, n/a.
@Generable
enum Answer {
    case yes
    case partly
    case no
    case notApplicable

    /// The answer as the track file spells it.
    var label: String {
        switch self {
        case .yes: "yes"
        case .partly: "partly"
        case .no: "no"
        case .notApplicable: "n/a"
        }
    }
}

/// One habit check. The quote comes first so the model finds the
/// evidence before it answers.
@Generable
struct HabitCheck {
    @Guide(description: "The exact words copied from the prompt that show this habit. An empty string if nothing in the prompt shows it.")
    var quote: String

    @Guide(description: "yes if the prompt clearly shows the habit, partly if only partly, no if it doesn't, notApplicable only if the habit can't apply to this kind of prompt.")
    var answer: Answer
}

/// All 16 habits in one response, for batch mode. The property names are
/// the track IDs in camel case. `HabitFields.all` maps them.
@Generable
struct PromptCheck {
    var targetUser: HabitCheck
    var problem: HabitCheck
    var successMetric: HabitCheck
    var acceptance: HabitCheck
    var scopeCut: HabitCheck
    var decomposed: HabitCheck
    var contextGiven: HabitCheck
    var specificFeedback: HabitCheck
    var asksTests: HabitCheck
    var costLatency: HabitCheck
    var edgeCases: HabitCheck
    var constraints: HabitCheck
    var noWhy: HabitCheck
    var kitchenSink: HabitCheck
    var vagueFix: HabitCheck
    var blindAccept: HabitCheck

    /// The checks keyed by track ID.
    var byID: [String: HabitCheck] {
        [
            "target_user": targetUser,
            "problem": problem,
            "success_metric": successMetric,
            "acceptance": acceptance,
            "scope_cut": scopeCut,
            "decomposed": decomposed,
            "context_given": contextGiven,
            "specific_feedback": specificFeedback,
            "asks_tests": asksTests,
            "cost_latency": costLatency,
            "edge_cases": edgeCases,
            "constraints": constraints,
            "no_why": noWhy,
            "kitchen_sink": kitchenSink,
            "vague_fix": vagueFix,
            "blind_accept": blindAccept,
        ]
    }
}

enum HabitFields {
    /// Track ID to the `PromptCheck` property name, in schema order.
    static let all: [(id: String, field: String)] = [
        ("target_user", "targetUser"),
        ("problem", "problem"),
        ("success_metric", "successMetric"),
        ("acceptance", "acceptance"),
        ("scope_cut", "scopeCut"),
        ("decomposed", "decomposed"),
        ("context_given", "contextGiven"),
        ("specific_feedback", "specificFeedback"),
        ("asks_tests", "asksTests"),
        ("cost_latency", "costLatency"),
        ("edge_cases", "edgeCases"),
        ("constraints", "constraints"),
        ("no_why", "noWhy"),
        ("kitchen_sink", "kitchenSink"),
        ("vague_fix", "vagueFix"),
        ("blind_accept", "blindAccept"),
    ]

    static func field(for id: String) -> String {
        all.first { $0.id == id }?.field ?? id
    }
}
