import Foundation

/// Risk classification for every capability tool.
public enum RiskLevel: String, Codable, Sendable, Comparable {
    case safe
    case low
    case medium
    case high
    case blocked

    private var rank: Int {
        switch self {
        case .safe: return 0
        case .low: return 1
        case .medium: return 2
        case .high: return 3
        case .blocked: return 4
        }
    }

    public static func < (lhs: RiskLevel, rhs: RiskLevel) -> Bool {
        lhs.rank < rhs.rank
    }
}

public enum PermissionDecision: String, Codable, Sendable {
    case allow
    case confirm
    case deny
}

public enum TaskState: String, Codable, Sendable {
    case planned
    case running
    case waitingForConfirmation
    case succeeded
    case failed
    case cancelled
}

public struct ToolDefinition: Codable, Sendable, Equatable {
    public var name: String
    public var description: String
    public var risk: RiskLevel
    public var requiresConfirmation: Bool
    public var requiredPermissions: [String]
    public var allowedPathRoots: [String]
    public var auditCategory: String

    public init(
        name: String,
        description: String,
        risk: RiskLevel,
        requiresConfirmation: Bool = false,
        requiredPermissions: [String] = [],
        allowedPathRoots: [String] = [],
        auditCategory: String = "general"
    ) {
        self.name = name
        self.description = description
        self.risk = risk
        self.requiresConfirmation = requiresConfirmation
        self.requiredPermissions = requiredPermissions
        self.allowedPathRoots = allowedPathRoots
        self.auditCategory = auditCategory
    }
}

public struct ToolCall: Codable, Sendable, Equatable {
    public var id: String
    public var name: String
    public var arguments: [String: ToolArgumentValue]

    public init(id: String = UUID().uuidString, name: String, arguments: [String: ToolArgumentValue] = [:]) {
        self.id = id
        self.name = name
        self.arguments = arguments
    }
}

public enum ToolArgumentValue: Codable, Sendable, Equatable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case null

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null; return }
        if let v = try? c.decode(Bool.self) { self = .bool(v); return }
        if let v = try? c.decode(Int.self) { self = .int(v); return }
        if let v = try? c.decode(Double.self) { self = .double(v); return }
        if let v = try? c.decode(String.self) { self = .string(v); return }
        throw DecodingError.dataCorruptedError(in: c, debugDescription: "Unsupported tool argument")
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let v): try c.encode(v)
        case .int(let v): try c.encode(v)
        case .double(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .null: try c.encodeNil()
        }
    }

    public var stringValue: String? {
        if case .string(let v) = self { return v }
        return nil
    }
}

public struct PolicyDecision: Sendable, Equatable {
    public var decision: PermissionDecision
    public var risk: RiskLevel
    public var reason: String
    public var confirmationToken: String?

    public init(decision: PermissionDecision, risk: RiskLevel, reason: String, confirmationToken: String? = nil) {
        self.decision = decision
        self.risk = risk
        self.reason = reason
        self.confirmationToken = confirmationToken
    }
}

public struct AuditEvent: Codable, Sendable, Equatable {
    public var timestamp: Date
    public var taskId: String
    public var requestId: String
    public var source: String
    public var tool: String?
    public var argumentsRedacted: [String: String]
    public var risk: RiskLevel?
    public var permission: PermissionDecision?
    public var result: String
    public var reason: String?

    public init(
        timestamp: Date = Date(),
        taskId: String,
        requestId: String,
        source: String,
        tool: String? = nil,
        argumentsRedacted: [String: String] = [:],
        risk: RiskLevel? = nil,
        permission: PermissionDecision? = nil,
        result: String,
        reason: String? = nil
    ) {
        self.timestamp = timestamp
        self.taskId = taskId
        self.requestId = requestId
        self.source = source
        self.tool = tool
        self.argumentsRedacted = argumentsRedacted
        self.risk = risk
        self.permission = permission
        self.result = result
        self.reason = reason
    }
}
