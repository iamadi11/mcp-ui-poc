import Foundation
import MacAgentCore
import MacAgentInterfaces

@main
struct MacAgentCLI {
    static func main() async {
        let args = Array(CommandLine.arguments.dropFirst())
        let instruction = args.joined(separator: " ")
        guard !instruction.isEmpty else {
            print("usage: mac-agent-cli <instruction>")
            return
        }
        let runtime = AgentRuntime()
        let result = await runtime.submit(TaskRequest(instruction: instruction, source: "cli", dryRun: true))
        print("state=\(result.state.rawValue)")
        if let err = result.lastError { print("error=\(err)") }
        for r in result.results {
            print(r.output)
        }
    }
}
