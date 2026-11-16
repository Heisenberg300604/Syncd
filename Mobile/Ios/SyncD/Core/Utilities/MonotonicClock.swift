import Foundation

/// A source of "now" that synchronisation code can depend on.
///
/// Production uses `SystemMonotonicClock`, which is anchored to the wall clock
/// once at launch and then advanced by the monotonic uptime clock. If the user
/// changes the device time mid-session, elapsed-time calculations stay correct.
protocol MonotonicClock: Sendable {
    func now() -> Date
}

struct SystemMonotonicClock: MonotonicClock {
    private let anchorDate: Date
    private let anchorUptime: TimeInterval

    init() {
        anchorDate = Date()
        anchorUptime = ProcessInfo.processInfo.systemUptime
    }

    func now() -> Date {
        anchorDate.addingTimeInterval(ProcessInfo.processInfo.systemUptime - anchorUptime)
    }
}
