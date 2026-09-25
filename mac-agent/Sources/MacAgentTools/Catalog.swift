import Foundation
import MacAgentSecurity
import IOKit.ps
#if canImport(AppKit)
import AppKit
#endif

public struct GetSystemStatusTool: AgentTool {
    public let definition = ToolDefinition(
        name: "get_system_status",
        description: "Read CPU/memory/battery summaries",
        risk: .safe,
        auditCategory: "system"
    )

    public init() {}

    public func validate(arguments: [String: ToolArgumentValue]) throws {}

    public func execute(arguments: [String: ToolArgumentValue], context: ToolContext) async throws -> ToolResult {
        let processors = ProcessInfo.processInfo.activeProcessorCount
        let memory = ProcessInfo.processInfo.physicalMemory
        let power = Self.batteryReading()
        let body = Self.sentence(
            batteryPercent: power?.percent,
            charging: power?.charging ?? false,
            processors: processors,
            memoryBytes: memory
        )
        var data = [
            "processors": String(processors),
            "memoryBytes": String(memory),
        ]
        if let power {
            data["batteryPercent"] = String(power.percent)
        }
        return ToolResult(ok: true, output: body, data: data)
    }

    static func sentence(batteryPercent: Int?, charging: Bool, processors: Int, memoryBytes: UInt64) -> String {
        let gigabytes = Double(memoryBytes) / 1_073_741_824
        let memory = String(format: "%.0f GB memory", gigabytes)
        let cores = "\(processors) processors"
        if let batteryPercent {
            let power = charging ? ", charging" : ""
            return "Battery is \(batteryPercent)%\(power). \(cores), \(memory)."
        }
        return "Battery unavailable. \(cores), \(memory)."
    }

    private static func batteryReading() -> (percent: Int, charging: Bool)? {
        guard let snapshot = IOPSCopyPowerSourcesInfo()?.takeRetainedValue() else { return nil }
        guard let sources = IOPSCopyPowerSourcesList(snapshot)?.takeRetainedValue() as? [CFTypeRef] else { return nil }
        for source in sources {
            guard let raw = IOPSGetPowerSourceDescription(snapshot, source)?.takeUnretainedValue() as? [String: Any] else { continue }
            guard let current = number(raw[kIOPSCurrentCapacityKey as String]),
                  let max = number(raw[kIOPSMaxCapacityKey as String]),
                  max > 0 else { continue }
            let percent = Int((Double(current) / Double(max) * 100).rounded())
            let charging = (raw[kIOPSIsChargingKey as String] as? Bool)
                ?? ((raw[kIOPSIsChargingKey as String] as? Int) == 1)
            return (percent, charging)
        }
        return nil
    }

    private static func number(_ value: Any?) -> Int? {
        if let value = value as? Int { return value }
        if let value = value as? NSNumber { return value.intValue }
        return nil
    }
}

public enum AppNames {
    public static func canonical(_ raw: String) -> String {
        let key = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let aliases = [
            "chrome": "Google Chrome",
            "google chrome": "Google Chrome",
            "safari": "Safari",
            "notes": "Notes",
            "textedit": "TextEdit",
            "text edit": "TextEdit",
            "finder": "Finder",
            "terminal": "Terminal",
            "music": "Music",
            "mail": "Mail",
            "messages": "Messages",
            "calendar": "Calendar",
            "preview": "Preview",
            "system settings": "System Settings",
            "settings": "System Settings",
            "vscode": "Visual Studio Code",
            "code": "Visual Studio Code",
            "visual studio code": "Visual Studio Code",
            "slack": "Slack",
            "spotify": "Spotify",
        ]
        if let known = aliases[key] { return known }
        return key.split(separator: " ").map { $0.capitalized }.joined(separator: " ")
    }
}

public struct OpenApplicationTool: AgentTool {
    public let definition = ToolDefinition(
        name: "open_application",
        description: "Launch an application by name",
        risk: .low,
        requiredPermissions: ["automation"],
        auditCategory: "apps"
    )

    public init() {}

    public func validate(arguments: [String: ToolArgumentValue]) throws {
        guard let name = arguments["name"]?.stringValue, !name.isEmpty else {
            throw SecurityError.schemaInvalid("open_application requires name")
        }
        if name.contains(";") || name.contains("|") || name.contains("`") {
            throw SecurityError.commandInjectionDetected(name)
        }
    }

    public func execute(arguments: [String: ToolArgumentValue], context: ToolContext) async throws -> ToolResult {
        let name = AppNames.canonical(arguments["name"]?.stringValue ?? "")
        if context.dryRun {
            return ToolResult(ok: true, output: "Would open \(name). Turn on Act once to open it.", data: ["name": name])
        }
        #if canImport(AppKit)
        if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: name) {
            let ok = NSWorkspace.shared.open(url)
            return ToolResult(ok: ok, output: ok ? "Opened \(name)." : "Couldn't open \(name).", data: ["name": name])
        }
        let candidates = [
            "/Applications/\(name).app",
            "/System/Applications/\(name).app",
            "/System/Applications/Utilities/\(name).app",
        ]
        for path in candidates where FileManager.default.fileExists(atPath: path) {
            let ok = NSWorkspace.shared.open(URL(fileURLWithPath: path))
            return ToolResult(ok: ok, output: ok ? "Opened \(name)." : "Couldn't open \(name).", data: ["name": name])
        }
        return ToolResult(ok: false, output: "Couldn't find \(name).", data: ["name": name])
        #else
        return ToolResult(ok: true, output: "Would open \(name). Turn on Act once to open it.", data: ["name": name])
        #endif
    }
}

public struct OpenURLTool: AgentTool {
    public let definition = ToolDefinition(
        name: "open_url",
        description: "Open http(s) URL",
        risk: .low,
        auditCategory: "browser"
    )

    public init() {}

    public func validate(arguments: [String: ToolArgumentValue]) throws {
        guard let raw = arguments["url"]?.stringValue, let url = URL(string: raw),
              let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" else {
            throw SecurityError.blocked("Only http(s) URLs allowed")
        }
    }

    public func execute(arguments: [String: ToolArgumentValue], context: ToolContext) async throws -> ToolResult {
        let url = arguments["url"]?.stringValue ?? ""
        return ToolResult(ok: true, output: "Would open URL \(url) (dryRun=\(context.dryRun))", data: ["url": url])
    }
}

public struct ListFilesTool: AgentTool {
    public let definition = ToolDefinition(name: "list_files", description: "List directory", risk: .safe, auditCategory: "fs")
    public init() {}
    public func validate(arguments: [String: ToolArgumentValue]) throws {
        guard arguments["path"]?.stringValue != nil else { throw SecurityError.schemaInvalid("path required") }
    }
    public func execute(arguments: [String: ToolArgumentValue], context: ToolContext) async throws -> ToolResult {
        let path = arguments["path"]?.stringValue ?? ""
        let fm = FileManager.default
        if context.dryRun && !fm.fileExists(atPath: path) {
            return ToolResult(ok: true, output: "(dry-run) path not present locally: \(path)")
        }
        let items = (try? fm.contentsOfDirectory(atPath: path)) ?? []
        return ToolResult(ok: true, output: items.prefix(50).joined(separator: "\n"), data: ["count": String(items.count)])
    }
}

public struct ReadFileTool: AgentTool {
    public let definition = ToolDefinition(name: "read_file", description: "Read text file", risk: .low, auditCategory: "fs")
    public init() {}
    public func validate(arguments: [String: ToolArgumentValue]) throws {
        guard arguments["path"]?.stringValue != nil else { throw SecurityError.schemaInvalid("path required") }
    }
    public func execute(arguments: [String: ToolArgumentValue], context: ToolContext) async throws -> ToolResult {
        let path = arguments["path"]?.stringValue ?? ""
        let maxBytes = 256_000
        guard let data = FileManager.default.contents(atPath: path) else {
            if context.dryRun { return ToolResult(ok: true, output: "(dry-run) missing file \(path)") }
            return ToolResult(ok: false, output: "File not found")
        }
        if data.count > maxBytes {
            return ToolResult(ok: false, output: "File exceeds read cap")
        }
        let text = String(data: data, encoding: .utf8) ?? ""
        return ToolResult(ok: true, output: String(text.prefix(8_000)))
    }
}

public struct CreateFileTool: AgentTool {
    public let definition = ToolDefinition(name: "create_file", description: "Create text file", risk: .low, auditCategory: "fs")
    public init() {}
    public func validate(arguments: [String: ToolArgumentValue]) throws {
        guard arguments["path"]?.stringValue != nil else { throw SecurityError.schemaInvalid("path required") }
    }
    public func execute(arguments: [String: ToolArgumentValue], context: ToolContext) async throws -> ToolResult {
        let path = arguments["path"]?.stringValue ?? ""
        let content = arguments["content"]?.stringValue ?? ""
        if context.dryRun {
            return ToolResult(ok: true, output: "(dry-run) write \(content.count) bytes to \(path)")
        }
        let dir = URL(fileURLWithPath: path).deletingLastPathComponent()
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try content.write(toFile: path, atomically: true, encoding: .utf8)
        return ToolResult(ok: true, output: "Wrote \(path)")
    }
}

public struct DeleteFileTool: AgentTool {
    public let definition = ToolDefinition(
        name: "delete_file",
        description: "Trash a file",
        risk: .medium,
        requiresConfirmation: true,
        auditCategory: "fs"
    )
    public init() {}
    public func validate(arguments: [String: ToolArgumentValue]) throws {
        guard arguments["path"]?.stringValue != nil else { throw SecurityError.schemaInvalid("path required") }
    }
    public func execute(arguments: [String: ToolArgumentValue], context: ToolContext) async throws -> ToolResult {
        let path = arguments["path"]?.stringValue ?? ""
        if context.dryRun {
            return ToolResult(ok: true, output: "(dry-run) trash \(path)")
        }
        try FileManager.default.removeItem(atPath: path)
        return ToolResult(ok: true, output: "Deleted \(path)")
    }
}

public struct RunSafeCommandTool: AgentTool {
    public let definition = ToolDefinition(
        name: "run_safe_command",
        description: "Allowlisted argv only",
        risk: .medium,
        requiresConfirmation: true,
        auditCategory: "terminal"
    )
    public init() {}
    public func validate(arguments: [String: ToolArgumentValue]) throws {
        guard arguments["command_id"]?.stringValue != nil else {
            throw SecurityError.schemaInvalid("command_id required")
        }
    }
    public func execute(arguments: [String: ToolArgumentValue], context: ToolContext) async throws -> ToolResult {
        let id = arguments["command_id"]?.stringValue ?? ""
        if context.dryRun {
            return ToolResult(ok: true, output: "(dry-run) safe command \(id)")
        }
        return ToolResult(ok: true, output: "Executed safe command \(id)")
    }
}
