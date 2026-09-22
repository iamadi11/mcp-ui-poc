import Foundation

/// Allowlisted argv templates only — never free-form shell.
public struct SafeCommandSpec: Sendable, Equatable {
    public var id: String
    public var executable: String
    public var argumentSchema: [SafeArg]
    public var risk: RiskLevel

    public init(id: String, executable: String, argumentSchema: [SafeArg], risk: RiskLevel = .medium) {
        self.id = id
        self.executable = executable
        self.argumentSchema = argumentSchema
        self.risk = risk
    }
}

public enum SafeArg: Sendable, Equatable {
    case literal(String)
    case enumChoice([String])
    case pathInSandbox
}

public struct SafeCommandRegistry: Sendable {
    public var commands: [String: SafeCommandSpec]

    public init(commands: [SafeCommandSpec] = SafeCommandRegistry.defaults()) {
        var map: [String: SafeCommandSpec] = [:]
        for c in commands { map[c.id] = c }
        self.commands = map
    }

    public static func defaults() -> [SafeCommandSpec] {
        [
            SafeCommandSpec(
                id: "echo_status",
                executable: "/bin/echo",
                argumentSchema: [.literal("ok")],
                risk: .safe
            ),
            SafeCommandSpec(
                id: "uname_s",
                executable: "/usr/bin/uname",
                argumentSchema: [.literal("-s")],
                risk: .safe
            ),
        ]
    }

    public func validate(commandId: String, arguments: [String]) -> Result<[String], SecurityError> {
        guard let spec = commands[commandId] else {
            return .failure(.unknownSafeCommand(commandId))
        }
        if arguments.count != spec.argumentSchema.count {
            return .failure(.invalidSafeCommandArgs("argument count mismatch"))
        }
        var built: [String] = []
        for (idx, arg) in arguments.enumerated() {
            switch spec.argumentSchema[idx] {
            case .literal(let lit):
                if arg != lit { return .failure(.invalidSafeCommandArgs("literal mismatch at \(idx)")) }
                built.append(arg)
            case .enumChoice(let choices):
                if !choices.contains(arg) { return .failure(.invalidSafeCommandArgs("enum mismatch at \(idx)")) }
                built.append(arg)
            case .pathInSandbox:
                // Path checked later by policy with sandbox
                if arg.contains(";") || arg.contains("|") || arg.contains("`") || arg.contains("$") || arg.contains("\n") {
                    return .failure(.commandInjectionDetected(arg))
                }
                built.append(arg)
            }
        }
        // Reject if executable looks like a shell wrapper abused as free-form
        let banned = ["/bin/sh", "/bin/bash", "/bin/zsh", "/usr/bin/env"]
        if banned.contains(spec.executable) {
            return .failure(.blocked("shell wrappers are not allowlisted as safe commands"))
        }
        return .success(built)
    }
}

public enum SecurityError: Error, Equatable, CustomStringConvertible {
    case unknownTool(String)
    case unknownSafeCommand(String)
    case invalidSafeCommandArgs(String)
    case commandInjectionDetected(String)
    case pathDenied(String)
    case blocked(String)
    case schemaInvalid(String)
    case confirmationRequired(token: String)
    case confirmationInvalid
    case untrustedModelClaim

    public var description: String {
        switch self {
        case .unknownTool(let n): return "Unknown tool: \(n)"
        case .unknownSafeCommand(let n): return "Unknown safe command: \(n)"
        case .invalidSafeCommandArgs(let m): return "Invalid safe command args: \(m)"
        case .commandInjectionDetected(let s): return "Command injection detected: \(s)"
        case .pathDenied(let r): return "Path denied: \(r)"
        case .blocked(let r): return "Blocked: \(r)"
        case .schemaInvalid(let r): return "Schema invalid: \(r)"
        case .confirmationRequired: return "Confirmation required"
        case .confirmationInvalid: return "Invalid confirmation token"
        case .untrustedModelClaim: return "Model cannot self-approve actions"
        }
    }
}
