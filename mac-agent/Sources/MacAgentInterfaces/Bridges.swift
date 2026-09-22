import Foundation
import MacAgentCore
import MacAgentSecurity
import MacAgentLLM

/// Placeholder MCP/API façade — always goes through AgentRuntime.
public struct LocalAPIServer: Sendable {
    public var runtime: AgentRuntime

    public init(runtime: AgentRuntime) {
        self.runtime = runtime
    }

    public func handleTask(instruction: String, token: String?) async -> TaskRecord {
        await runtime.submit(TaskRequest(instruction: instruction, source: "api", authToken: token, dryRun: true))
    }
}

public struct MCPBridge: Sendable {
    public var runtime: AgentRuntime

    public init(runtime: AgentRuntime) {
        self.runtime = runtime
    }

    public func callTool(name: String, arguments: [String: ToolArgumentValue], token: String?) async -> TaskRecord {
        // External models still cannot skip SecurityGate: we wrap as a single-call LLM mock.
        let mock = MockLLMViaCall(call: ToolCall(name: name, arguments: arguments))
        let rt = AgentRuntime(gate: runtime.gate, host: runtime.host, audit: runtime.audit, llm: mock, apiToken: runtime.apiToken)
        return await rt.submit(TaskRequest(instruction: "mcp:\(name)", source: "mcp", authToken: token, dryRun: true))
    }
}

private struct MockLLMViaCall: LLMProvider {
    var id: String { "mcp-inject" }
    var call: ToolCall
    func generate(messages: [Message], tools: [ToolDefinition]) async throws -> LLMResponse {
        LLMResponse(toolCalls: [call])
    }
}
