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

/// Ollama OpenAI-compatible chat endpoint (tool calling). Network optional — used when configured.
public struct OllamaProvider: LLMProvider {
    public var id: String { "ollama" }
    public var baseURL: URL
    public var model: String

    public init(baseURL: URL = URL(string: "http://127.0.0.1:11434")!, model: String = "qwen3:1.7b") {
        self.baseURL = baseURL
        self.model = model
    }

    public func generate(messages: [Message], tools: [ToolDefinition]) async throws -> LLMResponse {
        // MVP: return empty tool calls if unreachable; real JSON parsing lands in a later milestone.
        // Keeping network optional avoids CI flakiness.
        _ = tools
        var req = URLRequest(url: baseURL.appendingPathComponent("api/chat"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let payload: [String: Any] = [
            "model": model,
            "stream": false,
            "messages": messages.map { ["role": $0.role.rawValue, "content": $0.content] },
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: payload)
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            if let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let msg = obj["message"] as? [String: Any],
               let content = msg["content"] as? String {
                return LLMResponse(content: content, toolCalls: [])
            }
        } catch {
            return LLMResponse(content: "ollama_unavailable", toolCalls: [])
        }
        return LLMResponse(content: nil, toolCalls: [])
    }
}
