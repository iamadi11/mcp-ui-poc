// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MacAgent",
    platforms: [
        .macOS(.v13),
    ],
    products: [
        .library(name: "MacAgentSecurity", targets: ["MacAgentSecurity"]),
        .library(name: "MacAgentCore", targets: ["MacAgentCore"]),
        .library(name: "MacAgentTools", targets: ["MacAgentTools"]),
        .library(name: "MacAgentLLM", targets: ["MacAgentLLM"]),
        .library(name: "MacAgentInterfaces", targets: ["MacAgentInterfaces"]),
        .library(name: "MacAgentVoice", targets: ["MacAgentVoice"]),
        .executable(name: "mac-agent-cli", targets: ["MacAgentCLI"]),
    ],
    targets: [
        .target(
            name: "MacAgentSecurity",
            path: "Sources/MacAgentSecurity"
        ),
        .target(
            name: "MacAgentCore",
            dependencies: ["MacAgentSecurity", "MacAgentTools", "MacAgentLLM"],
            path: "Sources/MacAgentCore"
        ),
        .target(
            name: "MacAgentTools",
            dependencies: ["MacAgentSecurity"],
            path: "Sources/MacAgentTools"
        ),
        .target(
            name: "MacAgentLLM",
            dependencies: ["MacAgentSecurity"],
            path: "Sources/MacAgentLLM"
        ),
        .target(
            name: "MacAgentInterfaces",
            dependencies: ["MacAgentCore", "MacAgentSecurity", "MacAgentLLM"],
            path: "Sources/MacAgentInterfaces"
        ),
        .target(
            name: "MacAgentVoice",
            dependencies: ["MacAgentCore", "MacAgentSecurity"],
            path: "Sources/MacAgentVoice"
        ),
        .executableTarget(
            name: "MacAgentCLI",
            dependencies: ["MacAgentCore", "MacAgentInterfaces"],
            path: "Sources/MacAgentCLI"
        ),
        .testTarget(
            name: "MacAgentSecurityTests",
            dependencies: ["MacAgentSecurity"],
            path: "Tests/MacAgentSecurityTests"
        ),
        .testTarget(
            name: "MacAgentSecurityAdversarialTests",
            dependencies: ["MacAgentSecurity", "MacAgentCore", "MacAgentLLM"],
            path: "Tests/MacAgentSecurityAdversarialTests"
        ),
        .testTarget(
            name: "MacAgentCoreTests",
            dependencies: ["MacAgentCore", "MacAgentInterfaces", "MacAgentLLM", "MacAgentSecurity", "MacAgentVoice"],
            path: "Tests/MacAgentCoreTests"
        ),
        .testTarget(
            name: "MacAgentIntegrationTests",
            dependencies: ["MacAgentCore", "MacAgentLLM", "MacAgentInterfaces", "MacAgentSecurity"],
            path: "Tests/MacAgentIntegrationTests"
        ),
    ]
)
