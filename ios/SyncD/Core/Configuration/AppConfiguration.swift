import Foundation

/// Environment-specific configuration, read from Info.plist keys that are
/// populated by `Config/*.xcconfig`. Nothing here is secret: the Clerk
/// publishable key is designed to ship in clients.
struct AppConfiguration: Sendable, Equatable {
    enum Environment: String, Sendable {
        case development, staging, production
    }

    let environment: Environment
    /// Includes the `/api` prefix, matching the web client's `VITE_API_BASE_URL`.
    let apiBaseURL: URL
    /// The API origin without `/api` — identical to `clientConfig.socketUrl` on web.
    let socketURL: URL
    let clerkPublishableKey: String

    init(environment: Environment, apiBaseURL rawURL: String, clerkPublishableKey rawKey: String) throws(ConfigurationError) {
        let urlString = rawURL.trimmingCharacters(in: .whitespacesAndNewlines)
        let key = rawKey.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !urlString.isEmpty else { throw .missing("SYNCD_API_BASE_URL") }
        guard !key.isEmpty, key != "pk_test_replace_me" else { throw .missing("SYNCD_CLERK_PUBLISHABLE_KEY") }
        guard !key.hasPrefix("sk_") else { throw .secretKeyInClient }
        guard key.hasPrefix("pk_") else { throw .invalidPublishableKey }

        guard
            let url = URL(string: urlString),
            let scheme = url.scheme?.lowercased(),
            ["http", "https"].contains(scheme),
            url.host() != nil
        else { throw .invalidURL(urlString) }

        if environment == .production, scheme != "https" {
            throw .insecureURL(urlString)
        }

        self.environment = environment
        self.apiBaseURL = url
        self.socketURL = Self.socketURL(fromAPIBase: url)
        self.clerkPublishableKey = key
    }

    static func load(from bundle: Bundle = .main) throws(ConfigurationError) -> AppConfiguration {
        let info = bundle.infoDictionary ?? [:]
        let environment = (info["SYNCDEnvironment"] as? String).flatMap(Environment.init(rawValue:)) ?? .development
        return try AppConfiguration(
            environment: environment,
            apiBaseURL: info["SYNCDApiBaseURL"] as? String ?? "",
            clerkPublishableKey: info["SYNCDClerkPublishableKey"] as? String ?? ""
        )
    }

    /// `apiBaseUrl.replace(/\/api\/?$/, "")` from `client/src/config`.
    static func socketURL(fromAPIBase url: URL) -> URL {
        var string = url.absoluteString
        while string.hasSuffix("/") { string.removeLast() }
        if string.hasSuffix("/api") { string.removeLast(4) }
        return URL(string: string) ?? url
    }
}

enum ConfigurationError: UserFacingError, Equatable {
    case missing(String)
    case invalidURL(String)
    case insecureURL(String)
    case invalidPublishableKey
    case secretKeyInClient

    var title: String { "SyncD isn't configured" }

    var message: String {
        switch self {
        case let .missing(key):
            "\(key) is not set. Copy Config/Local.example.xcconfig to Config/Local.xcconfig and fill it in."
        case let .invalidURL(value):
            "The API base URL \"\(value)\" is not a valid http(s) URL. In xcconfig files write https:/$()/host/api."
        case let .insecureURL(value):
            "Production builds must use HTTPS. \"\(value)\" is not secure."
        case .invalidPublishableKey:
            "The Clerk publishable key must start with pk_."
        case .secretKeyInClient:
            "A Clerk secret key was found in the app configuration. Remove it — only the publishable key belongs in the app."
        }
    }

    var isRetryable: Bool { false }
}
