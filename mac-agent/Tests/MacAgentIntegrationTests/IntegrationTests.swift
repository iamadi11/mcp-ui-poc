import XCTest
@testable import MacAgentCore
import MacAgentInterfaces
import MacAgentLLM
import MacAgentSecurity

final class IntegrationTests: XCTestCase {
    func testAPIRequiresToken() async {
        let runtime = AgentRuntime(apiToken: "secret")
        let api = LocalAPIServer(runtime: runtime)
        let bad = await api.handleTask(instruction: "What's my battery?", token: "wrong")
        XCTAssertEqual(bad.state, .failed)

        let good = await api.handleTask(instruction: "What's my battery?", token: "secret")
        XCTAssertEqual(good.state, .succeeded)
    }

    func testMCPUsesSameGate() async {
        let runtime = AgentRuntime(apiToken: "secret")
        let mcp = MCPBridge(runtime: runtime)
        let denied = await mcp.callTool(name: "execute_shell", arguments: ["command": .string("id")], token: "secret")
        XCTAssertEqual(denied.state, .failed)

        let ok = await mcp.callTool(name: "get_system_status", arguments: [:], token: "secret")
        XCTAssertEqual(ok.state, .succeeded)
    }

    func testEndToOpenURLHappyPath() async {
        let llm = MockLLMProvider(canned: LLMResponse(toolCalls: [
            ToolCall(name: "open_url", arguments: ["url": .string("https://example.com")])
        ]))
        let runtime = AgentRuntime(llm: llm)
        let result = await runtime.submit(TaskRequest(instruction: "open example.com", source: "text"))
        XCTAssertEqual(result.state, .succeeded)
    }
}
