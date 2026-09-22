import Foundation

/// Filesystem sandbox: deny always wins; allow roots are explicit.
public struct PathSandbox: Sendable {
    public var allowRoots: [URL]
    public var denyRoots: [URL]
    public var denyGlobs: [String]

    public init(home: URL = PathSandbox.defaultHome(), allowRoots: [URL]? = nil, denyRoots: [URL]? = nil) {
        let homeURL = home
        self.allowRoots = allowRoots ?? [
            homeURL.appendingPathComponent("Downloads"),
            homeURL.appendingPathComponent("Documents/MacAgent"),
        ]
        self.denyRoots = denyRoots ?? PathSandbox.defaultDenyRoots(home: homeURL)
        self.denyGlobs = [
            "**/.env",
            "**/.env.*",
            "**/*.pem",
            "**/id_rsa",
            "**/id_ed25519",
            "**/credentials.json",
            "**/Cookies.binarycookies",
        ]
    }

    public static func defaultHome() -> URL {
        if let env = ProcessInfo.processInfo.environment["HOME"], !env.isEmpty {
            return URL(fileURLWithPath: env, isDirectory: true)
        }
        return URL(fileURLWithPath: NSHomeDirectory(), isDirectory: true)
    }

    public static func defaultDenyRoots(home: URL) -> [URL] {
        [
            home.appendingPathComponent("Library/Keychains"),
            home.appendingPathComponent(".ssh"),
            home.appendingPathComponent(".gnupg"),
            home.appendingPathComponent("Library/Messages"),
            URL(fileURLWithPath: "/System", isDirectory: true),
            URL(fileURLWithPath: "/usr", isDirectory: true),
            URL(fileURLWithPath: "/bin", isDirectory: true),
            URL(fileURLWithPath: "/sbin", isDirectory: true),
            URL(fileURLWithPath: "/etc", isDirectory: true),
            URL(fileURLWithPath: "/var", isDirectory: true),
            URL(fileURLWithPath: "/private", isDirectory: true),
        ]
    }

    /// Resolve and classify. Symlinks are resolved before policy.
    public func evaluate(_ rawPath: String) -> PathEvaluation {
        let expanded = (rawPath as NSString).expandingTildeInPath
        var url = URL(fileURLWithPath: expanded)
        url = url.standardizedFileURL
        // resolvingSymlinksInPath is a no-op if missing; still standardize.
        url = url.resolvingSymlinksInPath()
        let path = url.path

        if isDenied(path: path, url: url) {
            return PathEvaluation(allowed: false, resolvedPath: path, reason: "Path is in a denied/restricted location")
        }
        if matchesDenyGlob(path: path) {
            return PathEvaluation(allowed: false, resolvedPath: path, reason: "Path matches secret/credential deny pattern")
        }
        if isAllowed(path: path) {
            return PathEvaluation(allowed: true, resolvedPath: path, reason: "Path within allow roots")
        }
        return PathEvaluation(allowed: false, resolvedPath: path, reason: "Path outside allow roots")
    }

    private func isDenied(path: String, url: URL) -> Bool {
        for root in denyRoots {
            let rootPath = root.resolvingSymlinksInPath().standardizedFileURL.path
            if path == rootPath || path.hasPrefix(rootPath.hasSuffix("/") ? rootPath : rootPath + "/") {
                return true
            }
        }
        // Block other users' homes roughly: /Users/SomeoneElse
        if path.hasPrefix("/Users/") {
            let homePath = PathSandbox.defaultHome().path
            if !path.hasPrefix(homePath) && path != homePath {
                // Allow only if somehow under allowRoots that were customized
                if !isAllowed(path: path) { return true }
            }
        }
        _ = url
        return false
    }

    private func isAllowed(path: String) -> Bool {
        for root in allowRoots {
            let rootPath = root.resolvingSymlinksInPath().standardizedFileURL.path
            if path == rootPath || path.hasPrefix(rootPath.hasSuffix("/") ? rootPath : rootPath + "/") {
                return true
            }
        }
        return false
    }

    private func matchesDenyGlob(path: String) -> Bool {
        let name = URL(fileURLWithPath: path).lastPathComponent
        let lower = path.lowercased()
        if name == ".env" || name.hasPrefix(".env.") { return true }
        if name.hasSuffix(".pem") { return true }
        if name == "id_rsa" || name == "id_ed25519" || name == "id_ecdsa" { return true }
        if name == "credentials.json" { return true }
        if lower.contains("/.ssh/") { return true }
        if lower.contains("/keychains/") { return true }
        return false
    }
}

public struct PathEvaluation: Sendable, Equatable {
    public var allowed: Bool
    public var resolvedPath: String
    public var reason: String
}
