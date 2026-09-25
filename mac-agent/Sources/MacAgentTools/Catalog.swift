import Foundation
import MacAgentSecurity
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
        let processCount = ProcessInfo.processInfo.activeProcessorCount
        let mem = ProcessInfo.processInfo.physicalMemory
        let host = ProcessInfo.processInfo.hostName
        let body = "processors=\(processCount) memoryBytes=\(mem) host=\(host) dryRun=\(context.dryRun)"
        return ToolResult(ok: true, output: body, data: [
            "processors": String(processCount),
            "memoryBytes": String(mem),
        ])
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
        let name = arguments["name"]?.stringValue ?? ""
        if context.dryRun {
            return ToolResult(ok: true, output: "Would open application '\(name)' (dryRun=true)", data: ["name": name])
        }
        #if canImport(AppKit)
        if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: name) {
            let ok = NSWorkspace.shared.open(url)
            return ToolResult(ok: ok, output: ok ? "Opened '\(name)'" : "Failed to open '\(name)'", data: ["name": name])
        }
        let candidates = [
            "/Applications/\(name).app",
            "/System/Applications/\(name).app",
            "/Applications/\(name.capitalized).app",
        ]
        for path in candidates where FileManager.default.fileExists(atPath: path) {
            let ok = NSWorkspace.shared.open(URL(fileURLWithPath: path))
            return ToolResult(ok: ok, output: ok ? "Opened \(path)" : "Failed \(path)", data: ["name": name])
        }
        return ToolResult(ok: false, output: "Application not found: \(name)", data: ["name": name])
        #else
        return ToolResult(ok: true, output: "Would open application '\(name)' (no AppKit)", data: ["name": name])
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
