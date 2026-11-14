import Foundation

/// Anything the UI can present: a short title, an actionable message, and
/// whether offering "Try again" makes sense.
protocol UserFacingError: Error {
    var title: String { get }
    var message: String { get }
    var isRetryable: Bool { get }
}

/// Every failure from `APIClient` is mapped into this type, so views never see
/// raw `URLError`s or decoding errors.
enum APIError: UserFacingError, Equatable {
    case offline
    case timeout
    case cancelled
    /// The host refused or couldn't be resolved — usually the server isn't
    /// running or the device can't reach that address.
    case serverUnreachable(String)
    case notSignedIn
    case unauthorized
    case forbidden(String)
    case notFound(String)
    case conflict(String)
    case validation(String)
    case rateLimited(retryAfter: TimeInterval?)
    case server(status: Int)
    case invalidResponse
    case decoding(String)
    case transport(String)

    var title: String {
        switch self {
        case .offline: "You're offline"
        case .timeout: "Request timed out"
        case .cancelled: "Cancelled"
        case .serverUnreachable: "Can't reach SyncD"
        case .notSignedIn, .unauthorized: "Session expired"
        case .forbidden: "Not allowed"
        case .notFound: "Not found"
        case .conflict: "Already exists"
        case .validation: "Check your input"
        case .rateLimited: "Slow down"
        case .server, .invalidResponse, .decoding, .transport: "Something went wrong"
        }
    }

    var message: String {
        switch self {
        case .offline: "Check your connection and try again."
        case .timeout: "The server took too long to respond."
        case .cancelled: "The request was cancelled."
        case let .serverUnreachable(server):
            "Couldn't connect to \(server). Check that the server is running and reachable from this device."
        case .notSignedIn, .unauthorized: "Please sign in again."
        case let .forbidden(message), let .notFound(message), let .conflict(message), let .validation(message):
            message
        case let .rateLimited(retryAfter):
            if let retryAfter { "Too many requests. Try again in \(Int(retryAfter.rounded(.up)))s." }
            else { "Too many requests. Try again shortly." }
        case let .server(status): "The server returned an error (\(status))."
        case .invalidResponse: "The server sent an unexpected response."
        case .decoding: "The server sent data this version of SyncD can't read."
        case let .transport(detail): detail
        }
    }

    var isRetryable: Bool {
        switch self {
        case .offline, .timeout, .serverUnreachable, .rateLimited, .server, .transport, .invalidResponse: true
        case .cancelled, .notSignedIn, .unauthorized, .forbidden, .notFound, .conflict, .validation, .decoding: false
        }
    }
}

/// Failures from the realtime layer.
enum SocketError: UserFacingError, Equatable {
    case notConnected
    case ackTimeout(event: String)
    /// The server answered `{ ok: false, message }`. The message is already user-safe
    /// (it comes from `AppError` messages on the server).
    case rejected(String)
    case queueFull(String)
    case malformedPayload(event: String)
    case authenticationFailed(String)

    var title: String {
        switch self {
        case .notConnected: "Not connected"
        case .ackTimeout: "No response"
        case .rejected: "Action not allowed"
        case .queueFull: "Queue is full"
        case .malformedPayload: "Unexpected data"
        case .authenticationFailed: "Couldn't connect"
        }
    }

    var message: String {
        switch self {
        case .notConnected: "Reconnecting to the room. Try again in a moment."
        case .ackTimeout: "The room didn't respond in time."
        case let .rejected(message), let .queueFull(message): message
        case .malformedPayload: "The room sent data this version of SyncD can't read."
        case let .authenticationFailed(message): message
        }
    }

    var isRetryable: Bool {
        switch self {
        case .notConnected, .ackTimeout, .authenticationFailed: true
        case .rejected, .queueFull, .malformedPayload: false
        }
    }
}

/// A generic wrapper so any error can be rendered by the shared error views.
struct PresentableError: UserFacingError, Identifiable {
    let id = UUID()
    let title: String
    let message: String
    let isRetryable: Bool

    init(_ error: any Error) {
        if let error = error as? any UserFacingError {
            title = error.title
            message = error.message
            isRetryable = error.isRetryable
        } else {
            title = "Something went wrong"
            message = error.localizedDescription
            isRetryable = true
        }
    }

    init(title: String, message: String, isRetryable: Bool) {
        self.title = title
        self.message = message
        self.isRetryable = isRetryable
    }
}
