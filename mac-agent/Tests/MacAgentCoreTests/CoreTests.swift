import XCTest
@testable import MacAgentCore
import MacAgentLLM
import MacAgentSecurity
import MacAgentVoice

final class FastPathTests: XCTestCase {
    func testBatteryFastPath() {
        let call = FastPathRouter.route("What's my battery?")
        XCTAssertEqual(call?.name, "get_system_status")
    }

    func testOpenAppFastPath() {
        let call = FastPathRouter.route("open safari")
        XCTAssertEqual(call?.name, "open_application")
    }

    func testFastPathExecutesWithoutLLM() async {
        let llm = MockLLMProvider(canned: LLMResponse(content: "should not be used", toolCalls: []))
        let runtime = AgentRuntime(llm: llm)
        let result = await runtime.submit(TaskRequest(instruction: "cpu usage please", source: "voice"))
        XCTAssertEqual(result.state, .succeeded)
        XCTAssertFalse(result.results.isEmpty)
    }
}

final class TaskStateTests: XCTestCase {
    func testConfirmationState() async {
        let home = URL(fileURLWithPath: "/tmp/mac-agent-home-test", isDirectory: true)
        try? FileManager.default.createDirectory(at: home.appendingPathComponent("Downloads"), withIntermediateDirectories: true)
        let path = home.appendingPathComponent("Downloads/victim.txt").path
        let llm = MockLLMProvider(canned: LLMResponse(toolCalls: [
            ToolCall(name: "delete_file", arguments: ["path": .string(path)])
        ]))
        let gate = SecurityGate(config: SecurityPolicyConfig(sandbox: PathSandbox(home: home)))
        let runtime = AgentRuntime(gate: gate, llm: llm)
        let result = await runtime.submit(TaskRequest(instruction: "delete the file", source: "text"))
        XCTAssertEqual(result.state, .waitingForConfirmation)
        XCTAssertNotNil(result.lastError) // token
    }
}

final class VoicePipelineTests: XCTestCase {
    func testVoiceUsesFastPath() async throws {
        let stt = MockSTTProvider(transcript: "What's my battery?")
        let runtime = AgentRuntime()
        let pipeline = VoicePipeline(stt: stt, tts: MockTTSProvider(), runtime: runtime)
        let record = try await pipeline.handleAudio(Data())
        XCTAssertEqual(record.state, .succeeded)
    }
}

final class GrantStoreTests: XCTestCase {
    func testSessionGrantSkipsSecondConfirm() {
        let home = URL(fileURLWithPath: "/tmp/mac-agent-home-test", isDirectory: true)
        try? FileManager.default.createDirectory(at: home.appendingPathComponent("Downloads"), withIntermediateDirectories: true)
        let path = home.appendingPathComponent("Downloads/a.txt").path
        let grants = GrantStore()
        let gate = SecurityGate(config: SecurityPolicyConfig(sandbox: PathSandbox(home: home)), grants: grants)
        let call = ToolCall(name: "delete_file", arguments: ["path": .string(path)])
        let first = gate.evaluate(call: call)
        guard case .success(let d) = first, let token = d.confirmationToken else {
            return XCTFail("expected confirm")
        }
        _ = gate.applyGrant(token: token, choice: .allowSession)
        let second = gate.evaluate(call: call)
        guard case .success(let d2) = second else { return XCTFail("\(second)") }
        XCTAssertEqual(d2.decision, .allow)
    }
}
