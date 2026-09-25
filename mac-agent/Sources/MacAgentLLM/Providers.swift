import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
import MacAgentSecurity

public struct Message: Codable, Sendable, Equatable {
    public enum Role: String, Codable, Sendable { case system, user, assistant, tool }
    public var role: Role
    public var content: String

    public init(role: Role, content: String) {
        self.role = role
        self.content = content
    }
}

public struct LLMResponse: Codable, Sendable, Equatable {
    public var content: String?
    public var toolCalls: [ToolCall]
    /// If the model claims approval, SecurityGate must reject.
    public var claimsPreapproved: Bool

    public init(content: String? = nil, toolCalls: [ToolCall] = [], claimsPreapproved: Bool = false) {
        self.content = content
        self.toolCalls = toolCalls
        self.claimsPreapproved = claimsPreapproved
    }
}

public protocol LLMProvider: Sendable {
    var id: String { get }
    func generate(messages: [Message], tools: [ToolDefinition]) async throws -> LLMResponse
}

/// Test double that only emits structured tool calls supplied by the test harness.
public struct MockLLMProvider: LLMProvider {
    public var id: String { "mock" }
    public var canned: LLMResponse

    public init(canned: LLMResponse) {
        self.canned = canned
    }

    public func generate(messages: [Message], tools: [ToolDefinition]) async throws -> LLMResponse {
        _ = messages
        _ = tools
        return canned
    }
}

/// Ollama chat API with tool calling (local-first default).
public struct OllamaProvider: LLMProvider {
    public var id: String { "ollama" }
    public var baseURL: URL
    public var model: String
    public var timeout: TimeInterval

    public init(
        baseURL: URL = URL(string: "http://127.0.0.1:11434")!,
        model: String = ProcessInfo.processInfo.environment["MAC_AGENT_OLLAMA_MODEL"] ?? "qwen2.5:0.5b",
        timeout: TimeInterval = 120
    ) {
        self.baseURL = baseURL
        self.model = model
        self.timeout = timeout
    }

    public func generate(messages: [Message], tools: [ToolDefinition]) async throws -> LLMResponse {
        var req = URLRequest(url: baseURL.appendingPathComponent("api/chat"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = timeout

        let toolPayload: [[String: Any]] = tools.map { def in
            [
                "type": "function",
                "function": [
                    "name": def.name,
                    "description": def.description,
                    "parameters": [
                        "type": "object",
                        "properties": [:] as [String: Any],
                        "additionalProperties": true,
                    ] as [String: Any],
                ] as [String: Any],
            ]
        }

        var payload: [String: Any] = [
            "model": model,
            "stream": false,
            "messages": messages.map { ["role": $0.role.rawValue, "content": $0.content] },
        ]
        if !toolPayload.isEmpty {
            payload["tools"] = toolPayload
        }
        req.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await URLSession.shared.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw NSError(
                domain: "OllamaProvider",
                code: http.statusCode,
                userInfo: [NSLocalizedDescriptionKey: "Ollama HTTP \(http.statusCode): \(body.prefix(400))"]
            )
        }

        guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let msg = obj["message"] as? [String: Any]
        else {
            return LLMResponse(content: "ollama_bad_response", toolCalls: [])
        }

        let content = msg["content"] as? String
        let claims = (content ?? "").lowercased().contains("preapproved")
            || (content ?? "").lowercased().contains("already approved")

        var calls: [ToolCall] = []
        if let rawCalls = msg["tool_calls"] as? [[String: Any]] {
            for raw in rawCalls {
                let parsed = Self.parseToolCall(raw)
                if let parsed { calls.append(parsed) }
            }
        }

        // Some models emit JSON tool intents in content when tool_calls is empty.
        if calls.isEmpty, let content, let recovered = Self.recoverToolCall(from: content, allowed: Set(tools.map(\.name))) {
            calls.append(recovered)
        }

        return LLMResponse(content: content, toolCalls: calls, claimsPreapproved: claims)
    }

    private static func parseToolCall(_ raw: [String: Any]) -> ToolCall? {
        let fn = (raw["function"] as? [String: Any]) ?? raw
        guard let name = fn["name"] as? String, !name.isEmpty else { return nil }
        var args: [String: ToolArgumentValue] = [:]
        if let argsObj = fn["arguments"] as? [String: Any] {
            args = coerceArgs(argsObj)
        } else if let argsStr = fn["arguments"] as? String,
                  let data = argsStr.data(using: .utf8),
                  let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            args = coerceArgs(obj)
        }
        let id = (raw["id"] as? String) ?? UUID().uuidString
        return ToolCall(id: id, name: name, arguments: args)
    }

    private static func coerceArgs(_ obj: [String: Any]) -> [String: ToolArgumentValue] {
        var out: [String: ToolArgumentValue] = [:]
        for (k, v) in obj {
            switch v {
            case let s as String: out[k] = .string(s)
            case let i as Int: out[k] = .int(i)
            case let d as Double: out[k] = .double(d)
            case let b as Bool: out[k] = .bool(b)
            case is NSNull: out[k] = .null
            default: out[k] = .string(String(describing: v))
            }
        }
        return out
    }

    private static func recoverToolCall(from content: String, allowed: Set<String>) -> ToolCall? {
        guard let data = content.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        let name = (obj["name"] as? String) ?? (obj["tool"] as? String)
        guard let name, allowed.contains(name) else { return nil }
        let argsObj = (obj["arguments"] as? [String: Any]) ?? [:]
        return ToolCall(name: name, arguments: coerceArgs(argsObj))
    }
}
