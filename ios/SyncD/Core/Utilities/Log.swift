import OSLog

/// Unified-logging categories. Interpolated values are private by default in
/// `os.Logger`; never mark tokens, stream URLs or message content `.public`.
enum Log {
    private static let subsystem = Bundle.main.bundleIdentifier ?? "com.syncd.ios"

    static let app = Logger(subsystem: subsystem, category: "app")
    static let auth = Logger(subsystem: subsystem, category: "auth")
    static let network = Logger(subsystem: subsystem, category: "network")
    static let socket = Logger(subsystem: subsystem, category: "socket")
    static let playback = Logger(subsystem: subsystem, category: "playback")
    static let sync = Logger(subsystem: subsystem, category: "sync")
    static let audioSession = Logger(subsystem: subsystem, category: "audio-session")
}
