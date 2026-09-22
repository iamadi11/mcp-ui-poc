import Foundation
import MacAgentSecurity

public protocol AgentTool: Sendable {
    var definition: ToolDefinition { get }
    func validate(arguments: [String: ToolArgumentValue]) throws
    func execute(arguments: [String: ToolArgumentValue], context: ToolContext) async throws -> ToolResult
}

public struct ToolContext: Sendable {
    public var taskId: String
    public var requestId: String
    public var source: String
    public var dryRun: Bool

    public init(taskId: String, requestId: String, source: String, dryRun: Bool = false) {
        self.taskId = taskId
        self.requestId = requestId
        self.source = source
        self.dryRun = dryRun
    }
}

public struct ToolResult: Sendable, Equatable {
    public var ok: Bool
    public var output: String
    public var data: [String: String]

    public init(ok: Bool, output: String, data: [String: String] = [:]) {
        self.ok = ok
        self.output = output
        self.data = data
    }
}

/// In-process tool host. OS side effects are simulated on Linux via dry-run adapters.
public struct ToolHost: Sendable {
    private let tools: [String: any AgentTool]

    public init(tools: [any AgentTool]) {
        var map: [String: any AgentTool] = [:]
        for t in tools { map[t.definition.name] = t }
        self.tools = map
    }

    public static func `default`(dryRun: Bool = true) -> ToolHost {
        ToolHost(tools: [
            GetSystemStatusTool(),
            OpenApplicationTool(),
            OpenURLTool(),
            ListFilesTool(),
            ReadFileTool(),
            CreateFileTool(),
            DeleteFileTool(),
            RunSafeCommandTool(),
        ])
    }

    public func tool(named name: String) -> (any AgentTool)? { tools[name] }
}
