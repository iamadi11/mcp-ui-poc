import Foundation

public struct PermissionNeed: Sendable, Equatable {
    public var id: String
    public var title: String
    public var reason: String
    public var enables: [String]
    public var howToEnable: String

    public init(id: String, title: String, reason: String, enables: [String], howToEnable: String) {
        self.id = id
        self.title = title
        self.reason = reason
        self.enables = enables
        self.howToEnable = howToEnable
    }
}

public enum PermissionDoctor {
    public static let catalog: [PermissionNeed] = [
        PermissionNeed(
            id: "accessibility",
            title: "Accessibility",
            reason: "Required to click, type, and read UI structure via the Accessibility API.",
            enables: ["click_element", "type_text", "press_key"],
            howToEnable: "System Settings → Privacy & Security → Accessibility → enable Mac Agent."
        ),
        PermissionNeed(
            id: "microphone",
            title: "Microphone",
            reason: "Required for voice commands.",
            enables: ["voice_pipeline"],
            howToEnable: "System Settings → Privacy & Security → Microphone → enable Mac Agent."
        ),
        PermissionNeed(
            id: "screen_recording",
            title: "Screen Recording",
            reason: "Optional. Needed only for screenshot/OCR tools (off by default).",
            enables: ["get_screen"],
            howToEnable: "System Settings → Privacy & Security → Screen Recording → enable Mac Agent."
        ),
        PermissionNeed(
            id: "automation",
            title: "Automation",
            reason: "Required when bridging AppleScript/Shortcuts for specific apps.",
            enables: ["open_application (some targets)"],
            howToEnable: "System Settings → Privacy & Security → Automation → allow Mac Agent for target apps."
        ),
    ]

    /// On Linux / without TCC, report all as unknown (not granted).
    public static func missing() -> [PermissionNeed] {
        #if os(macOS)
        // Real TCC checks belong in the App target.
        return catalog
        #else
        return catalog
        #endif
    }
}
