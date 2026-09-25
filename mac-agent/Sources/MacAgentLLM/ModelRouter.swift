import Foundation
import MacAgentSecurity

/// Routes simple vs complex work to different providers.
public struct ModelRouter: Sendable {
    public var small: any LLMProvider
    public var large: any LLMProvider

    public init(small: any LLMProvider, large: any LLMProvider) {
        self.small = small
        self.large = large
    }

    public func provider(for instruction: String) -> any LLMProvider {
        let words = instruction.split(separator: " ").count
        if words <= 8 { return small }
        if instruction.lowercased().contains("then") || instruction.lowercased().contains("and then") {
            return large
        }
        return words > 20 ? large : small
    }
}
