import Foundation

public protocol AuditSink: Sendable {
    func record(_ event: AuditEvent)
}

public final class InMemoryAuditLog: AuditSink, @unchecked Sendable {
    private let lock = NSLock()
    private var events: [AuditEvent] = []

    public init() {}

    public func record(_ event: AuditEvent) {
        lock.lock()
        events.append(event)
        lock.unlock()
    }

    public func all() -> [AuditEvent] {
        lock.lock()
        defer { lock.unlock() }
        return events
    }
}

public enum Redactor {
    private static let secretKeys: Set<String> = [
        "password", "token", "api_key", "apikey", "authorization", "secret", "cookie",
    ]

    public static func redactArguments(_ args: [String: ToolArgumentValue]) -> [String: String] {
        var out: [String: String] = [:]
        for (k, v) in args {
            if secretKeys.contains(k.lowercased()) {
                out[k] = "***REDACTED***"
                continue
            }
            switch v {
            case .string(let s):
                out[k] = redactString(s)
            case .int(let i):
                out[k] = String(i)
            case .double(let d):
                out[k] = String(d)
            case .bool(let b):
                out[k] = String(b)
            case .null:
                out[k] = "null"
            }
        }
        return out
    }

    public static func redactString(_ s: String) -> String {
        var text = s
        // crude patterns
        let patterns = [
            #"sk-[A-Za-z0-9]{10,}"#,
            #"ghp_[A-Za-z0-9]{20,}"#,
            #"Bearer\s+[A-Za-z0-9\-._~+/]+=*"#,
        ]
        for p in patterns {
            if let regex = try? NSRegularExpression(pattern: p) {
                let range = NSRange(text.startIndex..<text.endIndex, in: text)
                text = regex.stringByReplacingMatches(in: text, range: range, withTemplate: "***REDACTED***")
            }
        }
        return text
    }
}
