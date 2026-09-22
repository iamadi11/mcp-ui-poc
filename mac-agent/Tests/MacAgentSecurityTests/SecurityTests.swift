import XCTest
@testable import MacAgentSecurity

final class PathSandboxTests: XCTestCase {
    func testAllowsDownloads() {
        let home = URL(fileURLWithPath: "/tmp/mac-agent-home-test", isDirectory: true)
        try? FileManager.default.createDirectory(at: home.appendingPathComponent("Downloads"), withIntermediateDirectories: true)
        let box = PathSandbox(home: home)
        let eval = box.evaluate(home.appendingPathComponent("Downloads/a.pdf").path)
        XCTAssertTrue(eval.allowed)
    }

    func testDeniesSSH() {
        let home = URL(fileURLWithPath: "/tmp/mac-agent-home-test", isDirectory: true)
        let box = PathSandbox(home: home)
        let eval = box.evaluate(home.appendingPathComponent(".ssh/id_rsa").path)
        XCTAssertFalse(eval.allowed)
    }

    func testDeniesEnvFilesEvenUnderAllowRoot() {
        let home = URL(fileURLWithPath: "/tmp/mac-agent-home-test", isDirectory: true)
        let box = PathSandbox(home: home)
        let eval = box.evaluate(home.appendingPathComponent("Downloads/.env").path)
        XCTAssertFalse(eval.allowed)
    }
}

final class SecurityGateTests: XCTestCase {
    func testUnknownToolDenied() {
        let gate = SecurityGate()
        let result = gate.evaluate(call: ToolCall(name: "execute_shell", arguments: ["command": .string("rm -rf /")]))
        switch result {
        case .success(let d):
            XCTAssertEqual(d.decision, .deny)
            XCTAssertEqual(d.risk, .blocked)
        case .failure:
            XCTFail("hard block should be deny decision")
        }
    }

    func testModelSelfApprovalRejected() {
        let gate = SecurityGate()
        let result = gate.evaluate(call: ToolCall(name: "get_system_status"), modelClaimsPreapproved: true)
        guard case .failure(let err) = result else { return XCTFail("expected failure") }
        XCTAssertEqual(err, .untrustedModelClaim)
    }

    func testDeleteRequiresConfirm() {
        let home = URL(fileURLWithPath: "/tmp/mac-agent-home-test", isDirectory: true)
        try? FileManager.default.createDirectory(at: home.appendingPathComponent("Downloads"), withIntermediateDirectories: true)
        let gate = SecurityGate(config: SecurityPolicyConfig(sandbox: PathSandbox(home: home)))
        let call = ToolCall(name: "delete_file", arguments: ["path": .string(home.appendingPathComponent("Downloads/x.txt").path)])
        let result = gate.evaluate(call: call)
        guard case .success(let d) = result else { return XCTFail("\(result)") }
        XCTAssertEqual(d.decision, .confirm)
        XCTAssertNotNil(d.confirmationToken)
    }

    func testOpenJavascriptURLBlocked() {
        let gate = SecurityGate()
        let call = ToolCall(name: "open_url", arguments: ["url": .string("javascript:alert(1)")])
        let result = gate.evaluate(call: call)
        guard case .failure = result else { return XCTFail("expected failure") }
    }

    func testSafeCommandRejectsUnknown() {
        let reg = SafeCommandRegistry()
        let r = reg.validate(commandId: "rm_rf", arguments: ["-rf", "/"])
        guard case .failure = r else { return XCTFail("must fail") }
    }
}

final class RedactorTests: XCTestCase {
    func testRedactsTokens() {
        let out = Redactor.redactString("Authorization Bearer sk-abcdefghilmnopq")
        XCTAssertTrue(out.contains("REDACTED"))
    }
}
