// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MacAgent",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(name: "MacAgentSecurity", targets: ["MacAgentSecurity"]),
        .library(name: "MacAgentCore", targets: ["MacAgentCore"]),
        .library(name: "MacAgentTools", targets: ["MacAgentTools"]),
        .library(name: "MacAgentLLM", targets: ["MacAgentLLM"]),
        .library(name: "MacAgentInterfaces", targets: ["MacAgentInterfaces"]),
        .library(name: "MacAgentVoice", targets: ["MacAgentVoice"]),
        .executable(name: "mac-agent-cli", targets: ["MacAgentCLI"]),
        .executable(name: "MacAgentMenuBar", targets: ["MacAgentMenuBar"]),
    ],
    dependencies: [
        .package(url: "https://github.com/openclaw/AXorcist.git", from: "0.1.6"),
        .package(url: "https://github.com/argmaxinc/argmax-oss-swift.git", from: "1.0.0"),
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
            dependencies: [
                "MacAgentSecurity",
                .product(name: "AXorcist", package: "AXorcist"),
            ],
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
            dependencies: [
                "MacAgentCore",
                "MacAgentSecurity",
                .product(name: "WhisperKit", package: "argmax-oss-swift"),
            ],
            path: "Sources/MacAgentVoice"
        ),
        .executableTarget(
            name: "MacAgentCLI",
            dependencies: ["MacAgentCore", "MacAgentInterfaces", "MacAgentLLM", "MacAgentVoice", "MacAgentSecurity", "MacAgentTools"],
            path: "Sources/MacAgentCLI"
        ),
        .executableTarget(
            name: "MacAgentMenuBar",
            dependencies: [
                "MacAgentCore",
                "MacAgentSecurity",
                "MacAgentVoice",
                "MacAgentLLM",
                "MacAgentTools",
            ],
            path: "Sources/MacAgentMenuBar",
            exclude: ["Info.plist", "MacAgent.entitlements"],
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("SwiftUI"),
                .linkedFramework("AVFoundation"),
                .linkedFramework("Speech"),
            ]
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
            dependencies: ["MacAgentCore", "MacAgentInterfaces", "MacAgentLLM", "MacAgentSecurity", "MacAgentVoice", "MacAgentTools"],
            path: "Tests/MacAgentCoreTests"
        ),
        .testTarget(
            name: "MacAgentIntegrationTests",
            dependencies: ["MacAgentCore", "MacAgentLLM", "MacAgentInterfaces", "MacAgentSecurity"],
            path: "Tests/MacAgentIntegrationTests"
        ),
    ]
)
