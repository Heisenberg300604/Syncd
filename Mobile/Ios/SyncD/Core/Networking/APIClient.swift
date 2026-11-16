import Foundation

/// Abstracts `URLSession` so the client can be tested with canned responses.
protocol HTTPTransport: Sendable {
    func data(for request: URLRequest) async throws -> (Data, URLResponse)
}

struct URLSessionTransport: HTTPTransport {
    let session: URLSession

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        try await session.data(for: request)
    }
}

/// Returns the current Clerk session token. `forceRefresh` bypasses the
/// SDK's in-memory cache after a 401.
typealias AuthTokenProvider = @Sendable (_ forceRefresh: Bool) async throws -> String?

struct Endpoint<Response: Decodable & Sendable>: Sendable {
    enum Method: String, Sendable {
        case get = "GET"
        case post = "POST"
    }

    let method: Method
    /// Relative to the API base URL, e.g. `rooms/ABC123/join`.
    let path: String
    var queryItems: [URLQueryItem] = []
    var body: Data?
}

/// The single HTTP entry point. Views and view models never build requests.
final class APIClient: Sendable {
    private let baseURL: URL
    private let transport: any HTTPTransport
    private let tokenProvider: AuthTokenProvider
    private let timeout: TimeInterval

    init(
        baseURL: URL,
        transport: any HTTPTransport = URLSessionTransport(session: .shared),
        timeout: TimeInterval = 20,
        tokenProvider: @escaping AuthTokenProvider
    ) {
        self.baseURL = baseURL
        self.transport = transport
        self.timeout = timeout
        self.tokenProvider = tokenProvider
    }

    func send<Response>(_ endpoint: Endpoint<Response>) async throws(APIError) -> Response {
        do {
            return try await perform(endpoint, forceTokenRefresh: false)
        } catch .unauthorized {
            // Clerk tokens live ~60 s. A 401 right after expiry is recovered
            // by one retry with a freshly minted token.
            return try await perform(endpoint, forceTokenRefresh: true)
        }
    }

    private func perform<Response>(_ endpoint: Endpoint<Response>, forceTokenRefresh: Bool) async throws(APIError) -> Response {
        let token: String
        do {
            guard let value = try await tokenProvider(forceTokenRefresh), !value.isEmpty else {
                throw APIError.notSignedIn
            }
            token = value
        } catch let error as APIError {
            throw error
        } catch {
            throw Self.map(transportError: error)
        }

        let request = try makeRequest(endpoint, token: token)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await transport.data(for: request)
        } catch {
            throw Self.map(transportError: error, server: Self.serverDescription(baseURL))
        }

        guard let http = response as? HTTPURLResponse else { throw .invalidResponse }
        return try Self.decode(Response.self, data: data, response: http)
    }

    private func makeRequest<Response>(_ endpoint: Endpoint<Response>, token: String) throws(APIError) -> URLRequest {
        var url = baseURL.appending(path: endpoint.path)
        if !endpoint.queryItems.isEmpty {
            url.append(queryItems: endpoint.queryItems)
        }
        var request = URLRequest(url: url, timeoutInterval: timeout)
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body = endpoint.body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return request
    }

    // MARK: Mapping (internal for tests)

    private struct ErrorBody: Decodable {
        let message: String?
    }

    static func decode<Response: Decodable>(_ type: Response.Type, data: Data, response: HTTPURLResponse) throws(APIError) -> Response {
        let status = response.statusCode
        guard (200..<300).contains(status) else {
            let message = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.message
            throw map(status: status, message: message, retryAfter: response.value(forHTTPHeaderField: "Retry-After"))
        }
        do {
            return try JSONCoding.makeDecoder().decode(Response.self, from: data)
        } catch {
            Log.network.error("Decoding \(String(describing: Response.self), privacy: .public) failed: \(String(describing: error), privacy: .private)")
            throw .decoding(String(describing: Response.self))
        }
    }

    static func map(status: Int, message: String?, retryAfter: String?) -> APIError {
        switch status {
        case 400: .validation(message ?? "The request was invalid.")
        case 401: .unauthorized
        case 403: .forbidden(message ?? "You don't have access to this.")
        case 404: .notFound(message ?? "That couldn't be found.")
        case 409: .conflict(message ?? "That already exists.")
        case 429: .rateLimited(retryAfter: retryAfter.flatMap(TimeInterval.init))
        default: .server(status: status)
        }
    }

    /// `host:port` for user-facing messages — never the path or query.
    static func serverDescription(_ url: URL) -> String {
        let host = url.host() ?? url.absoluteString
        return url.port.map { "\(host):\($0)" } ?? host
    }

    static func map(transportError error: any Error, server: String? = nil) -> APIError {
        if let error = error as? APIError { return error }
        if error is CancellationError { return .cancelled }
        guard let urlError = error as? URLError else { return .transport(String(describing: type(of: error))) }
        switch urlError.code {
        case .notConnectedToInternet, .networkConnectionLost, .dataNotAllowed, .internationalRoamingOff:
            return .offline
        case .timedOut:
            return .timeout
        case .cancelled:
            return .cancelled
        case .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed:
            return .serverUnreachable(server ?? "the SyncD server")
        case .appTransportSecurityRequiresSecureConnection:
            return .transport("iOS blocked an insecure (http) connection. Use https, or a local/LAN address in development.")
        case .secureConnectionFailed, .serverCertificateUntrusted, .serverCertificateHasBadDate,
             .serverCertificateNotYetValid, .serverCertificateHasUnknownRoot, .clientCertificateRejected:
            return .transport("A secure connection to the server couldn't be established.")
        default:
            return .transport("A network error occurred (code \(urlError.code.rawValue)).")
        }
    }
}
