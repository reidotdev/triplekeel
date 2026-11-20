import Foundation

/// One invented prompt with hand labels, from the REI-247 spike.
struct PromptRow: Codable {
    let id: String
    let text: String
    let expected: [String: String]
}

/// One habit definition from habits.json.
struct Habit: Codable {
    let id: String
    let definition: String
}

/// What the model said for one habit of one prompt.
struct Verdict: Codable {
    let habit: String
    let answer: String
    let quote: String
}

/// One model call and its result.
struct CallRecord: Codable {
    let mode: String
    let run: Int
    let promptID: String
    /// The habit for single mode. Nil for batch mode, which checks all 16.
    let habit: String?
    let ms: Double
    let thermal: String
    let error: String?
    let verdicts: [Verdict]
}

enum Loader {
    static func load<T: Decodable>(_ type: T.Type, from path: String) throws -> T {
        let url = URL(fileURLWithPath: path)
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(type, from: data)
    }
}

extension ProcessInfo.ThermalState {
    var label: String {
        switch self {
        case .nominal: "nominal"
        case .fair: "fair"
        case .serious: "serious"
        case .critical: "critical"
        @unknown default: "unknown"
        }
    }
}

extension Duration {
    var milliseconds: Double {
        let parts = components
        return Double(parts.seconds) * 1000 + Double(parts.attoseconds) / 1e15
    }
}
