import Foundation
#if canImport(AVFoundation)
import AVFoundation
#endif
#if canImport(ApplicationServices)
import ApplicationServices
#endif
#if canImport(AppKit)
import AppKit
#endif

public struct PermissionNeed: Sendable, Equatable {
    public var id: String
    public var title: String
    public var reason: String
    public var enables: [String]
    public var howToEnable: String
    public var status: String

    public init(id: String, title: String, reason: String, enables: [String], howToEnable: String, status: String = "unknown") {
        self.id = id
        self.title = title
        self.reason = reason
        self.enables = enables
        self.howToEnable = howToEnable
        self.status = status
    }
}

public enum PermissionDoctor {
    public static let catalog: [PermissionNeed] = [
        PermissionNeed(
            id: "accessibility",
            title: "Accessibility",
            reason: "Required to click, type, and read UI structure via the Accessibility API.",
            enables: ["click_element", "type_text"],
            howToEnable: "System Settings → Privacy & Security → Accessibility → enable Mac Agent."
        ),
        PermissionNeed(
            id: "microphone",
            title: "Microphone",
            reason: "Required for voice commands (WhisperKit / Apple Speech).",
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

    public static func snapshot() -> [PermissionNeed] {
        catalog.map { need in
            var copy = need
            copy.status = status(for: need.id)
            return copy
        }
    }

    public static func missing() -> [PermissionNeed] {
        snapshot().filter { $0.status != "granted" && $0.status != "optional" }
    }

    public static func status(for id: String) -> String {
        switch id {
        case "accessibility":
            #if canImport(ApplicationServices)
            return AXIsProcessTrusted() ? "granted" : "denied_or_prompt"
            #else
            return "unavailable"
            #endif
        case "microphone":
            #if canImport(AVFoundation)
            switch AVCaptureDevice.authorizationStatus(for: .audio) {
            case .authorized: return "granted"
            case .denied, .restricted: return "denied"
            case .notDetermined: return "not_determined"
            @unknown default: return "unknown"
            }
            #else
            return "unavailable"
            #endif
        case "screen_recording":
            return "optional"
        case "automation":
            return "unknown"
        default:
            return "unknown"
        }
    }

    /// Result of a microphone permission attempt.
    public enum MicRequestOutcome: Sendable, Equatable {
        case granted
        case deniedOpenedSettings
        case promptedButDenied
        case unavailable
    }

    /// Requests mic access when still undecided; if already denied, opens System Settings
    /// (macOS never shows the sheet again after Deny).
    public static func requestMicrophoneAccessDetailed() async -> MicRequestOutcome {
        #if canImport(AVFoundation)
        #if canImport(AppKit)
        await MainActor.run { NSApp.activate() }
        #endif
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            _ = await probeMicrophone()
            return .granted
        case .denied, .restricted:
            openMicrophoneSettings()
            return .deniedOpenedSettings
        case .notDetermined:
            let ok: Bool
            if #available(macOS 14.0, *) {
                ok = await AVAudioApplication.requestRecordPermission()
            } else {
                ok = await AVCaptureDevice.requestAccess(for: .audio)
            }
            if ok {
                // Opening the input node registers the app under System Settings → Microphone.
                _ = await probeMicrophone()
                return .granted
            }
            return .promptedButDenied
        @unknown default:
            let ok = await AVCaptureDevice.requestAccess(for: .audio)
            return ok ? .granted : .promptedButDenied
        }
        #else
        return .unavailable
        #endif
    }

    /// Briefly opens the default input device so TCC lists this bundle under Microphone.
    public static func probeMicrophone() async -> Bool {
        #if canImport(AVFoundation)
        do {
            let engine = AVAudioEngine()
            _ = engine.inputNode
            engine.prepare()
            try engine.start()
            try await Task.sleep(nanoseconds: 150_000_000)
            engine.stop()
            return true
        } catch {
            return false
        }
        #else
        return false
        #endif
    }

    public static func requestMicrophoneAccess() async -> Bool {
        switch await requestMicrophoneAccessDetailed() {
        case .granted: return true
        default: return false
        }
    }

    /// Opens System Settings → Privacy → Microphone (required after Deny).
    public static func openMicrophoneSettings() {
        #if canImport(AppKit)
        let candidates = [
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
            "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Microphone",
        ]
        for raw in candidates {
            if let url = URL(string: raw), NSWorkspace.shared.open(url) { return }
        }
        #endif
    }

    /// Prompts the Accessibility TCC dialog when possible.
    public static func promptAccessibility() {
        #if canImport(ApplicationServices)
        let opts = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        _ = AXIsProcessTrustedWithOptions(opts)
        #endif
    }

    public static func openAccessibilitySettings() {
        #if canImport(AppKit)
        let candidates = [
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
            "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Accessibility",
        ]
        for raw in candidates {
            if let url = URL(string: raw), NSWorkspace.shared.open(url) { return }
        }
        #endif
    }
}
