import Foundation

public struct SecurityPolicyConfig: Sendable {
    public var autoAllowUpTo: RiskLevel
    public var sandbox: PathSandbox
    public var safeCommands: SafeCommandRegistry
    /// Non-bypassable: blocked always denied.
    public var hardBlockTools: Set<String>

    public init(
        autoAllowUpTo: RiskLevel = .low,
        sandbox: PathSandbox = PathSandbox(),
        safeCommands: SafeCommandRegistry = SafeCommandRegistry(),
        hardBlockTools: Set<String> = ["execute_shell", "sudo", "run_apple_script_raw"]
    ) {
        self.autoAllowUpTo = autoAllowUpTo
        self.sandbox = sandbox
        self.safeCommands = safeCommands
        self.hardBlockTools = hardBlockTools
    }
}

public struct ToolRegistry: Sendable {
    private var tools: [String: ToolDefinition]

    public init(tools: [ToolDefinition] = ToolRegistry.defaultCatalog()) {
        var map: [String: ToolDefinition] = [:]
        for t in tools { map[t.name] = t }
        self.tools = map
    }

    public func definition(named name: String) -> ToolDefinition? { tools[name] }
    public var all: [ToolDefinition] { Array(tools.values).sorted { $0.name < $1.name } }

    public static func defaultCatalog() -> [ToolDefinition] {
        [
            ToolDefinition(name: "get_system_status", description: "Read CPU/memory/battery summaries", risk: .safe, auditCategory: "system"),
            ToolDefinition(name: "open_application", description: "Launch an application by name or bundle id", risk: .low, requiredPermissions: ["automation"], auditCategory: "apps"),
            ToolDefinition(name: "open_url", description: "Open an http(s) URL", risk: .low, auditCategory: "browser"),
            ToolDefinition(name: "list_files", description: "List files in an allowed directory", risk: .safe, auditCategory: "fs"),
            ToolDefinition(name: "read_file", description: "Read a text file under allow roots", risk: .low, auditCategory: "fs"),
            ToolDefinition(name: "create_file", description: "Create a file under allow roots", risk: .low, auditCategory: "fs"),
            ToolDefinition(name: "delete_file", description: "Move a file to Trash under allow roots", risk: .medium, requiresConfirmation: true, auditCategory: "fs"),
            ToolDefinition(name: "click_element", description: "Activate an accessibility element", risk: .low, requiredPermissions: ["accessibility"], auditCategory: "ui"),
            ToolDefinition(name: "type_text", description: "Type text into the focused element", risk: .low, requiredPermissions: ["accessibility"], auditCategory: "ui"),
            ToolDefinition(name: "run_safe_command", description: "Run an allowlisted argv template", risk: .medium, requiresConfirmation: true, auditCategory: "terminal"),
        ]
    }
}

/// Authoritative gate between untrusted ToolCall and execution.
public final class SecurityGate: @unchecked Sendable {
    public let config: SecurityPolicyConfig
    public let registry: ToolRegistry
    public let grants: GrantStore
    private var pendingConfirmations: [String: ToolCall] = [:]
    private let lock = NSLock()

    public init(
        config: SecurityPolicyConfig = SecurityPolicyConfig(),
        registry: ToolRegistry = ToolRegistry(),
        grants: GrantStore = GrantStore()
    ) {
        self.config = config
        self.registry = registry
        self.grants = grants
    }

    public func evaluate(call: ToolCall, modelClaimsPreapproved: Bool = false) -> Result<PolicyDecision, SecurityError> {
        if modelClaimsPreapproved {
            return .failure(.untrustedModelClaim)
        }
        if config.hardBlockTools.contains(call.name) || call.name.lowercased().contains("shell") && call.name != "run_safe_command" {
            return .success(PolicyDecision(decision: .deny, risk: .blocked, reason: "Tool is hard-blocked"))
        }
        guard let def = registry.definition(named: call.name) else {
            return .failure(.unknownTool(call.name))
        }
        if def.risk == .blocked {
            return .success(PolicyDecision(decision: .deny, risk: .blocked, reason: "Tool risk is blocked"))
        }

        if let pathErr = validatePaths(call: call) {
            return .failure(pathErr)
        }
        if call.name == "open_url", let urlErr = validateURL(call: call) {
            return .failure(urlErr)
        }
        if call.name == "run_safe_command" {
            let cmdId = call.arguments["command_id"]?.stringValue ?? ""
            let args = (call.arguments["argv"]?.stringValue ?? "").split(separator: "\u{1e}").map(String.init)
            let argvList = extractArgv(call: call)
            switch config.safeCommands.validate(commandId: cmdId, arguments: argvList.isEmpty ? args : argvList) {
            case .failure(let e): return .failure(e)
            case .success: break
            }
        }

        // Session/always grants can skip confirm for medium — never for blocked/high hard rules.
        if def.risk < .high && grants.isGranted(tool: call.name, arguments: call.arguments) {
            return .success(PolicyDecision(decision: .allow, risk: def.risk, reason: "Granted by user policy"))
        }

        let needsConfirm = def.requiresConfirmation || def.risk > config.autoAllowUpTo || def.risk >= .medium
        if needsConfirm {
            let token = UUID().uuidString
            lock.lock()
            pendingConfirmations[token] = call
            lock.unlock()
            return .success(PolicyDecision(decision: .confirm, risk: def.risk, reason: "User confirmation required", confirmationToken: token))
        }
        return .success(PolicyDecision(decision: .allow, risk: def.risk, reason: "Within auto-allow policy"))
    }

    public func applyGrant(token: String, choice: GrantChoice) -> Result<ToolCall, SecurityError> {
        switch confirm(token: token) {
        case .failure(let e): return .failure(e)
        case .success(let call):
            if choice == .deny {
                return .failure(.blocked("User denied"))
            }
            // Never persist always-allow for high/blocked
            if let def = registry.definition(named: call.name), def.risk >= .high, choice == .alwaysAllow {
                grants.record(choice: .allowOnce, tool: call.name, arguments: call.arguments)
            } else {
                grants.record(choice: choice, tool: call.name, arguments: call.arguments)
            }
            return .success(call)
        }
    }

    public func confirm(token: String) -> Result<ToolCall, SecurityError> {
        lock.lock()
        defer { lock.unlock() }
        guard let call = pendingConfirmations.removeValue(forKey: token) else {
            return .failure(.confirmationInvalid)
        }
        return .success(call)
    }

    private func extractArgv(call: ToolCall) -> [String] {
        var out: [String] = []
        var i = 0
        while let v = call.arguments["argv_\(i)"]?.stringValue {
            out.append(v)
            i += 1
        }
        return out
    }

    private func validatePaths(call: ToolCall) -> SecurityError? {
        let keys = ["path", "from", "to", "directory"]
        for key in keys {
            guard let raw = call.arguments[key]?.stringValue else { continue }
            let eval = config.sandbox.evaluate(raw)
            if !eval.allowed {
                return .pathDenied(eval.reason)
            }
        }
        return nil
    }

    private func validateURL(call: ToolCall) -> SecurityError? {
        guard let raw = call.arguments["url"]?.stringValue else {
            return .schemaInvalid("open_url requires url")
        }
        guard let url = URL(string: raw), let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" else {
            return .blocked("Only http(s) URLs are allowed")
        }
        return nil
    }
}
