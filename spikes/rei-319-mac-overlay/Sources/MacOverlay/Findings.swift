import AppKit

/// What worked in each app. Never stores prompt text, only counts,
/// roles and methods.
final class Findings {
    struct App {
        var name: String
        var roles: Set<String> = []
        var checks = 0
        var readOK = 0
        var boundsOK = 0
        var boundsMissing = 0
        var multiLine = 0
        var methods: [String: Int] = [:]
        var writes: [String] = []
    }

    private(set) var apps: [String: App] = [:]
    private var lastLine = ""

    func record(app: NSRunningApplication, role: String?, read: Bool, bounds: CGRect?, method: String? = nil, multiLine: Bool) {
        let id = app.bundleIdentifier ?? "unknown"
        var entry = apps[id] ?? App(name: app.localizedName ?? id)
        entry.checks += 1
        if let role { entry.roles.insert(role) }
        if read { entry.readOK += 1 }
        if read, bounds != nil { entry.boundsOK += 1 }
        if read, bounds == nil { entry.boundsMissing += 1 }
        if multiLine { entry.multiLine += 1 }
        if read, let method { entry.methods[method, default: 0] += 1 }
        apps[id] = entry

        let line = "[\(entry.name)] role=\(role ?? "none") read=\(read) position=\(bounds == nil ? "missing" : (method ?? "ok"))\(multiLine ? " multi-line" : "")"
        if line != lastLine {
            print(line)
            lastLine = line
        }
    }

    func recordWrite(app: NSRunningApplication, result: String) {
        let id = app.bundleIdentifier ?? "unknown"
        var entry = apps[id] ?? App(name: app.localizedName ?? id)
        entry.writes.append(result)
        apps[id] = entry
        print("[\(entry.name)] write: \(result)")
    }

    func markdown() -> String {
        var out = [
            "## REI-319 overlay results",
            "",
            "macOS \(ProcessInfo.processInfo.operatingSystemVersionString). Counts are polling checks while a text field was focused.",
            "",
            "| App | Roles | Read | Position found | Position methods | Multi-line | Writes |",
            "|---|---|---:|---:|---|---:|---|",
        ]
        for (_, app) in apps.sorted(by: { $0.value.name < $1.value.name }) {
            let writes = app.writes.isEmpty ? "–" : app.writes.joined(separator: "; ")
            let methods = app.methods.isEmpty ? "–" : app.methods.sorted { $0.key < $1.key }.map { "\($0.key) \($0.value)" }.joined(separator: ", ")
            out.append("| \(app.name) | \(app.roles.sorted().joined(separator: ", ")) | \(app.readOK)/\(app.checks) | \(app.boundsOK)/\(app.readOK) | \(methods) | \(app.multiLine) | \(writes) |")
        }
        out += [
            "",
            "Manual checks per app: does the underline line up after scrolling and resizing? Does Cmd+Z undo an approved fix?",
        ]
        return out.joined(separator: "\n")
    }
}
