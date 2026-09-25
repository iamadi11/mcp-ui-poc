import Foundation
import MacAgentSecurity
import MacAgentTools
import MacAgentLLM

public struct TaskRequest: Sendable {
    public var instruction: String
    public var source: String
    public var authToken: String?
    public var dryRun: Bool

    public init(instruction: String, source: String, authToken: String? = nil, dryRun: Bool = true) {
        self.instruction = instruction
        self.source = source
        self.authToken = authToken
        self.dryRun = dryRun
    }
}

public struct TaskRecord: Sendable {
    public var id: String
    public var state: TaskState
    public var instruction: String
    public var results: [ToolResult]
    public var lastError: String?
    /// Plain assistant reply when the model answers without tools (not an OS action).
    public var assistantText: String?

    public init(
        id: String = UUID().uuidString,
        state: TaskState = .planned,
        instruction: String,
        results: [ToolResult] = [],
        lastError: String? = nil,
        assistantText: String? = nil
    ) {
        self.id = id
        self.state = state
        self.instruction = instruction
        self.results = results
        self.lastError = lastError
        self.assistantText = assistantText
    }
}

public final class AgentRuntime: @unchecked Sendable {
    public let gate: SecurityGate
    public let host: ToolHost
    public let audit: AuditSink
    public let llm: any LLMProvider
    public var apiToken: String
    private var tasks: [String: TaskRecord] = [:]
    private let lock = NSLock()

    public init(
        gate: SecurityGate = SecurityGate(),
        host: ToolHost = .default(),
        audit: AuditSink = InMemoryAuditLog(),
        llm: any LLMProvider = MockLLMProvider(canned: LLMResponse()),
        apiToken: String = "dev-local-token"
    ) {
        self.gate = gate
        self.host = host
        self.audit = audit
        self.llm = llm
        self.apiToken = apiToken
    }

    public func submit(_ request: TaskRequest, confirmationToken: String? = nil) async -> TaskRecord {
        let requestId = UUID().uuidString
        if request.source == "api" || request.source == "mcp" {
            if request.authToken != apiToken {
                let denied = TaskRecord(state: .failed, instruction: request.instruction, lastError: "unauthorized")
                audit.record(AuditEvent(taskId: denied.id, requestId: requestId, source: request.source, result: "denied", reason: "bad token"))
                return denied
            }
        }

        var record = TaskRecord(instruction: request.instruction)
        record.state = .running
        store(record)

        let calls: [ToolCall]
        if let token = confirmationToken {
            switch gate.confirm(token: token) {
            case .failure(let e):
                record.state = .failed
                record.lastError = e.description
                store(record)
                return record
            case .success(let call):
                calls = [call]
            }
        } else if let fast = FastPathRouter.route(request.instruction) {
            calls = [fast]
        } else {
            let trimmed = request.instruction.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.count < 2 {
                record.state = .failed
                record.lastError = "empty_transcript"
                store(record)
                return record
            }
            let response = try? await llm.generate(
                messages: [
                    Message(
                        role: .system,
                        content: """
                        You are Mac Agent, a local computer-control runtime.
                        For actionable requests you MUST call one of the provided tools (never invent shell).
                        Map battery/CPU/memory/system status → get_system_status.
                        Only reply with short plain text (no tools) for greetings or when you need clarification.
                        """
                    ),
                    Message(role: .user, content: request.instruction),
                ],
                tools: gate.registry.all
            )
            if response?.claimsPreapproved == true {
                record.state = .failed
                record.lastError = SecurityError.untrustedModelClaim.description
                audit.record(AuditEvent(taskId: record.id, requestId: requestId, source: request.source, result: "denied", reason: "model self-approval"))
                store(record)
                return record
            }
            calls = response?.toolCalls ?? []
            if calls.isEmpty {
                let reply = (response?.content ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                if !reply.isEmpty {
                    // Conversational reply — not an OS action; not a hard failure.
                    record.state = .succeeded
                    record.assistantText = reply
                    record.results.append(ToolResult(ok: true, output: reply, data: ["kind": "assistant_text"]))
                    store(record)
                    return record
                }
                record.state = .failed
                record.lastError = "no_tool_calls"
                store(record)
                return record
            }
        }

        for call in calls {
            if Task.isCancelled {
                record.state = .cancelled
                store(record)
                return record
            }
            let decision: PolicyDecision
            switch gate.evaluate(call: call, modelClaimsPreapproved: false) {
            case .failure(let err):
                record.state = .failed
                record.lastError = err.description
                audit.record(AuditEvent(
                    taskId: record.id,
                    requestId: requestId,
                    source: request.source,
                    tool: call.name,
                    argumentsRedacted: Redactor.redactArguments(call.arguments),
                    permission: .deny,
                    result: "denied",
                    reason: err.description
                ))
                store(record)
                return record
            case .success(let d):
                decision = d
            }

            audit.record(AuditEvent(
                taskId: record.id,
                requestId: requestId,
                source: request.source,
                tool: call.name,
                argumentsRedacted: Redactor.redactArguments(call.arguments),
                risk: decision.risk,
                permission: decision.decision,
                result: decision.decision.rawValue,
                reason: decision.reason
            ))

            if decision.decision == .deny {
                record.state = .failed
                record.lastError = decision.reason
                store(record)
                return record
            }
            if decision.decision == .confirm {
                record.state = .waitingForConfirmation
                record.lastError = decision.confirmationToken
                store(record)
                return record
            }

            guard let tool = host.tool(named: call.name) else {
                record.state = .failed
                record.lastError = "tool adapter missing"
                store(record)
                return record
            }
            do {
                try tool.validate(arguments: call.arguments)
                let ctx = ToolContext(taskId: record.id, requestId: requestId, source: request.source, dryRun: request.dryRun)
                let result = try await tool.execute(arguments: call.arguments, context: ctx)
                record.results.append(result)
                audit.record(AuditEvent(
                    taskId: record.id,
                    requestId: requestId,
                    source: request.source,
                    tool: call.name,
                    argumentsRedacted: Redactor.redactArguments(call.arguments),
                    risk: decision.risk,
                    permission: .allow,
                    result: result.ok ? "success" : "tool_error",
                    reason: result.output
                ))
                if !result.ok {
                    record.state = .failed
                    record.lastError = result.output
                    store(record)
                    return record
                }
            } catch {
                record.state = .failed
                record.lastError = String(describing: error)
                store(record)
                return record
            }
        }

        record.state = .succeeded
        store(record)
        return record
    }

    private func store(_ record: TaskRecord) {
        lock.lock()
        tasks[record.id] = record
        lock.unlock()
    }

    public func task(id: String) -> TaskRecord? {
        lock.lock()
        defer { lock.unlock() }
        return tasks[id]
    }
}

/// Deterministic router — no LLM.
public enum FastPathRouter {
    public static func route(_ raw: String) -> ToolCall? {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if text.isEmpty { return nil }
        if text.contains("battery") || text.contains("cpu") || text.contains("memory")
            || text.contains("ram") || text == "system status" || text.contains("what's using")
            || text.contains("system status") || text.contains("how much memory")
            || text.contains("processor") {
            return ToolCall(name: "get_system_status", arguments: [:])
        }
        if text.hasPrefix("open ") {
            let name = String(text.dropFirst(5)).trimmingCharacters(in: .whitespaces)
            if !name.isEmpty {
                return ToolCall(name: "open_application", arguments: ["name": .string(name.capitalized)])
            }
        }
        if text.hasPrefix("lock") {
            return nil
        }
        return nil
    }
}
