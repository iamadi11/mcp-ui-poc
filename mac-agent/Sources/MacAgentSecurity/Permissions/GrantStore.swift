import Foundation

/// User grant choices for confirmation UX.
public enum GrantChoice: String, Codable, Sendable {
    case allowOnce
    case allowSession
    case alwaysAllow
    case deny
}

public struct GrantKey: Hashable, Sendable, Codable {
    public var tool: String
    public var argumentFingerprint: String

    public init(tool: String, argumentFingerprint: String) {
        self.tool = tool
        self.argumentFingerprint = argumentFingerprint
    }

    public static func fingerprint(_ args: [String: ToolArgumentValue]) -> String {
        let keys = args.keys.sorted()
        var parts: [String] = []
        for k in keys {
            parts.append("\(k)=\(String(describing: args[k]))")
        }
        return parts.joined(separator: "&")
    }
}

/// In-memory session + durable always-allow store (file persistence later on macOS).
public final class GrantStore: @unchecked Sendable {
    private let lock = NSLock()
    private var session: Set<GrantKey> = []
    private var always: Set<GrantKey> = []

    public init() {}

    public func record(choice: GrantChoice, tool: String, arguments: [String: ToolArgumentValue]) {
        let key = GrantKey(tool: tool, argumentFingerprint: GrantKey.fingerprint(arguments))
        lock.lock()
        defer { lock.unlock() }
        switch choice {
        case .allowOnce:
            break
        case .allowSession:
            session.insert(key)
        case .alwaysAllow:
            always.insert(key)
            session.insert(key)
        case .deny:
            session.remove(key)
            always.remove(key)
        }
    }

    public func isGranted(tool: String, arguments: [String: ToolArgumentValue]) -> Bool {
        let key = GrantKey(tool: tool, argumentFingerprint: GrantKey.fingerprint(arguments))
        lock.lock()
        defer { lock.unlock() }
        return always.contains(key) || session.contains(key)
    }

    public func clearSession() {
        lock.lock()
        session.removeAll()
        lock.unlock()
    }
}
