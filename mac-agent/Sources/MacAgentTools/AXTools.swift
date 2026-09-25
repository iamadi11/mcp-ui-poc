import Foundation
import MacAgentSecurity
#if canImport(ApplicationServices)
import ApplicationServices
#endif
#if canImport(AppKit)
import AppKit
#endif
#if canImport(AXorcist)
import AXorcist
#endif

/// Click / activate a UI element via Accessibility (AXorcist query + AXPress).
public struct ClickElementTool: AgentTool {
    public let definition = ToolDefinition(
        name: "click_element",
        description: "Activate an accessibility element by app + role/title",
        risk: .low,
        requiredPermissions: ["accessibility"],
        auditCategory: "ui"
    )

    public init() {}

    public func validate(arguments: [String: ToolArgumentValue]) throws {
        let hasLocator = arguments["role"]?.stringValue != nil
            || arguments["title"]?.stringValue != nil
            || arguments["element_id"]?.stringValue != nil
            || arguments["focused"]?.boolValue == true
        guard hasLocator else {
            throw SecurityError.schemaInvalid("click_element requires role, title, element_id, or focused=true")
        }
    }

    public func execute(arguments: [String: ToolArgumentValue], context: ToolContext) async throws -> ToolResult {
        #if os(macOS)
        let app = arguments["app"]?.stringValue ?? arguments["bundle_id"]?.stringValue
        let role = arguments["role"]?.stringValue
        let title = arguments["title"]?.stringValue
        let focused = arguments["focused"]?.boolValue == true
        if context.dryRun {
            return ToolResult(
                ok: true,
                output: "(dry-run) click app=\(app ?? "*") role=\(role ?? "-") title=\(title ?? "-") focused=\(focused)",
                data: ["backend": AXBackend.name]
            )
        }
        guard AXPermission.isTrusted() else {
            return ToolResult(ok: false, output: "Accessibility not granted — enable Mac Agent in System Settings")
        }
        if focused || (role == nil && title == nil) {
            return AXBackend.pressFocused()
        }
        return await AXBackend.click(app: app, role: role, title: title)
        #else
        return ToolResult(ok: false, output: "click_element requires macOS")
        #endif
    }
}

/// Type into a focused or located accessibility element.
public struct TypeTextTool: AgentTool {
    public let definition = ToolDefinition(
        name: "type_text",
        description: "Type text into the focused accessibility element (or app+role locator)",
        risk: .low,
        requiredPermissions: ["accessibility"],
        auditCategory: "ui"
    )

    public init() {}

    public func validate(arguments: [String: ToolArgumentValue]) throws {
        guard let text = arguments["text"]?.stringValue, !text.isEmpty else {
            throw SecurityError.schemaInvalid("type_text requires text")
        }
    }

    public func execute(arguments: [String: ToolArgumentValue], context: ToolContext) async throws -> ToolResult {
        #if os(macOS)
        let text = arguments["text"]?.stringValue ?? ""
        let app = arguments["app"]?.stringValue ?? arguments["bundle_id"]?.stringValue
        let role = arguments["role"]?.stringValue
        if context.dryRun {
            return ToolResult(
                ok: true,
                output: "(dry-run) type \(text.count) chars app=\(app ?? "focused") role=\(role ?? "-")",
                data: ["backend": AXBackend.name]
            )
        }
        guard AXPermission.isTrusted() else {
            return ToolResult(ok: false, output: "Accessibility not granted — enable Mac Agent in System Settings")
        }
        if let app, let role {
            return await AXBackend.typeInto(app: app, role: role, text: text)
        }
        return AXBackend.typeFocused(text)
        #else
        return ToolResult(ok: false, output: "type_text requires macOS")
        #endif
    }
}

enum AXPermission {
    static func isTrusted() -> Bool {
        #if canImport(ApplicationServices)
        return AXIsProcessTrusted()
        #else
        return false
        #endif
    }
}

enum AXBackend {
    #if canImport(AXorcist)
    static let name = "axorcist+application_services"
    #else
    static let name = "application_services"
    #endif

    static func pressFocused() -> ToolResult {
        #if canImport(ApplicationServices)
        guard let element = focusedElement() else {
            return ToolResult(ok: false, output: "No focused UI element")
        }
        let press = AXUIElementPerformAction(element, kAXPressAction as CFString)
        if press == .success {
            return ToolResult(ok: true, output: "Pressed focused element", data: ["backend": name])
        }
        return ToolResult(ok: false, output: "AXPress failed (\(press.rawValue))")
        #else
        return ToolResult(ok: false, output: "No Accessibility backend")
        #endif
    }

    static func click(app: String?, role: String?, title: String?) async -> ToolResult {
        #if canImport(ApplicationServices)
        if let native = pressMatching(app: app, role: role, title: title) {
            return native
        }
        #endif
        #if canImport(AXorcist)
        return await MainActor.run {
            let locator = makeLocator(role: role, title: title)
            let cmd = PerformActionCommand(
                appIdentifier: app,
                locator: locator,
                action: "AXPress",
                maxDepthForSearch: 20
            )
            let response = AXorcist.shared.runCommand(
                AXCommandEnvelope(commandID: "press-\(UUID().uuidString)", command: .performAction(cmd))
            )
            switch response {
            case .success:
                return ToolResult(
                    ok: true,
                    output: "AXPress ok app=\(app ?? "*") role=\(role ?? "-") title=\(title ?? "-")",
                    data: ["backend": name]
                )
            case .error(let message, let code, _):
                return ToolResult(
                    ok: false,
                    output: "AXPress failed \(code.rawValue): \(message)",
                    data: ["backend": name]
                )
            }
        }
        #else
        return pressFocused()
        #endif
    }

    static func typeInto(app: String, role: String, text: String) async -> ToolResult {
        #if canImport(ApplicationServices)
        if let typed = setValueMatching(app: app, role: role, text: text) {
            return typed
        }
        #endif
        #if canImport(AXorcist)
        return await MainActor.run {
            let locator = makeLocator(role: role, title: nil)
            let cmd = SetFocusedValueCommand(
                appIdentifier: app,
                locator: locator,
                value: text,
                maxDepthForSearch: 20
            )
            let response = AXorcist.shared.runCommand(
                AXCommandEnvelope(commandID: "type-\(UUID().uuidString)", command: .setFocusedValue(cmd))
            )
            switch response {
            case .success:
                return ToolResult(
                    ok: true,
                    output: "Set value (\(text.count) chars) in \(app) \(role)",
                    data: ["backend": name]
                )
            case .error(let message, let code, _):
                return ToolResult(
                    ok: false,
                    output: "setFocusedValue failed \(code.rawValue): \(message)",
                    data: ["backend": name]
                )
            }
        }
        #else
        return typeFocused(text)
        #endif
    }

    static func typeFocused(_ text: String) -> ToolResult {
        #if canImport(ApplicationServices)
        guard let element = focusedElement() else {
            return ToolResult(ok: false, output: "No focused UI element")
        }
        // Prefer AXValue; fall back to AXSelectedText insert via set when supported.
        let setErr = AXUIElementSetAttributeValue(element, kAXValueAttribute as CFString, text as CFTypeRef)
        if setErr == .success {
            return ToolResult(ok: true, output: "Set AXValue (\(text.count) chars)", data: ["backend": name])
        }
        return ToolResult(ok: false, output: "AXSetValue failed (\(setErr.rawValue))", data: ["backend": name])
        #else
        return ToolResult(ok: false, output: "No Accessibility backend")
        #endif
    }

    #if canImport(AXorcist)
    @MainActor
    private static func makeLocator(role: String?, title: String?) -> Locator {
        var criteria: [Criterion] = []
        if let role {
            criteria.append(Criterion(attribute: "AXRole", value: role))
        }
        if let title {
            criteria.append(Criterion(attribute: "AXTitle", value: title, matchType: .contains))
        }
        return Locator(criteria: criteria)
    }
    #endif

    #if canImport(ApplicationServices)
    private static func pressMatching(app: String?, role: String?, title: String?) -> ToolResult? {
        guard let root = applicationElement(app: app) else { return nil }
        guard let match = findElement(in: root, role: role, title: title, depth: 0, maxDepth: 24) else {
            return nil
        }
        let press = AXUIElementPerformAction(match, kAXPressAction as CFString)
        if press == .success {
            return ToolResult(
                ok: true,
                output: "AXPress(native) ok app=\(app ?? "*") role=\(role ?? "-") title=\(title ?? "-")",
                data: ["backend": name]
            )
        }
        return ToolResult(ok: false, output: "AXPress(native) failed (\(press.rawValue))", data: ["backend": name])
    }

    private static func setValueMatching(app: String?, role: String?, text: String) -> ToolResult? {
        guard let root = applicationElement(app: app) else { return nil }
        guard let match = findElement(in: root, role: role, title: nil, depth: 0, maxDepth: 24) else {
            return nil
        }
        let setErr = AXUIElementSetAttributeValue(match, kAXValueAttribute as CFString, text as CFTypeRef)
        if setErr == .success {
            return ToolResult(ok: true, output: "Set AXValue(native) \(text.count) chars", data: ["backend": name])
        }
        return nil
    }

    private static func applicationElement(app: String?) -> AXUIElement? {
        #if canImport(AppKit)
        let running = NSWorkspace.shared.runningApplications
        let match: NSRunningApplication?
        if let app, app.contains(".") {
            match = running.first { $0.bundleIdentifier == app }
        } else if let app {
            match = running.first {
                $0.localizedName?.caseInsensitiveCompare(app) == .orderedSame
                    || $0.bundleIdentifier?.localizedCaseInsensitiveContains(app) == true
            }
        } else {
            match = NSWorkspace.shared.frontmostApplication
        }
        guard let match else { return nil }
        return AXUIElementCreateApplication(match.processIdentifier)
        #else
        return nil
        #endif
    }

    private static func findElement(
        in element: AXUIElement,
        role: String?,
        title: String?,
        depth: Int,
        maxDepth: Int
    ) -> AXUIElement? {
        guard depth <= maxDepth else { return nil }
        let elRole = copyString(element, kAXRoleAttribute as String)
        let elTitle = copyString(element, kAXTitleAttribute as String)
        let elDesc = copyString(element, kAXDescriptionAttribute as String)
        let roleOK = role == nil || elRole == role
        let titleOK: Bool = {
            guard let title, !title.isEmpty else { return role != nil && title == nil || title == nil }
            return elTitle.localizedCaseInsensitiveContains(title)
                || elDesc.localizedCaseInsensitiveContains(title)
        }()
        // When title is required, both must match; when only role, role alone.
        if roleOK {
            if title == nil || title?.isEmpty == true {
                if role != nil { return element }
            } else if titleOK {
                return element
            }
        }

        var attrNames = [kAXChildrenAttribute as String, kAXWindowsAttribute as String]
        if depth == 0 {
            attrNames.append(contentsOf: [
                kAXMenuBarAttribute as String,
                kAXMainWindowAttribute as String,
                kAXFocusedWindowAttribute as String,
            ])
        }
        for name in attrNames {
            var ref: CFTypeRef?
            guard AXUIElementCopyAttributeValue(element, name as CFString, &ref) == .success, let ref else {
                continue
            }
            let children: [AXUIElement]
            if let arr = ref as? [AXUIElement] {
                children = arr
            } else {
                children = [ref as! AXUIElement]
            }
            for child in children {
                if let found = findElement(in: child, role: role, title: title, depth: depth + 1, maxDepth: maxDepth) {
                    return found
                }
            }
        }
        return nil
    }

    private static func copyString(_ element: AXUIElement, _ attribute: String) -> String {
        var ref: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, attribute as CFString, &ref) == .success else {
            return ""
        }
        return (ref as? String) ?? ""
    }
    #endif

    #if canImport(ApplicationServices)
    private static func focusedElement() -> AXUIElement? {
        let systemWide = AXUIElementCreateSystemWide()
        var focused: CFTypeRef?
        let err = AXUIElementCopyAttributeValue(systemWide, kAXFocusedUIElementAttribute as CFString, &focused)
        guard err == .success, let focusedEl = focused else { return nil }
        return (focusedEl as! AXUIElement)
    }
    #endif
}

extension ToolArgumentValue {
    var boolValue: Bool? {
        if case .bool(let v) = self { return v }
        if case .string(let s) = self {
            return ["true", "1", "yes"].contains(s.lowercased())
        }
        return nil
    }
}
