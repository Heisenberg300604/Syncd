import Foundation

/// Decides how to correct the gap between the local player and the room.
///
/// Thresholds are the PRD's *starting* values and must be tuned on real
/// devices and networks:
///
/// | |drift|        | action                    |
/// |----------------|---------------------------|
/// | < 250 ms       | none                      |
/// | 250–750 ms     | monitor                   |
/// | 750 ms – 2 s   | gradual rate correction (monitor if the player can't change rate) |
/// | > 2 s          | authoritative seek        |
struct DriftPolicy: Sendable, Equatable {
    var ignoreBelow: TimeInterval = 0.25
    var monitorBelow: TimeInterval = 0.75
    var seekAbove: TimeInterval = 2.0
    /// Maximum rate deviation for gradual correction (±5% is inaudible for most music).
    var maxRateAdjustment: Double = 0.05
    /// Seconds over which a gradual correction aims to close the gap.
    var convergenceWindow: TimeInterval = 20

    enum Correction: Equatable {
        case none
        case monitor
        /// Play at this rate until drift falls under `ignoreBelow`.
        case adjustRate(Double)
        case seek
    }

    /// - Parameter drift: `localPosition − expectedPosition`. Positive means
    ///   the local player is ahead of the room.
    func correction(forDrift drift: TimeInterval, supportsRateAdjustment: Bool = true) -> Correction {
        let magnitude = abs(drift)
        guard drift.isFinite else { return .seek }
        if magnitude < ignoreBelow { return .none }
        if magnitude < monitorBelow { return .monitor }
        if magnitude > seekAbove { return .seek }
        // Without rate control the only fix is a seek, and seeking a streamed
        // player re-buffers (leaving it behind again). Tolerate drift up to
        // `seekAbove` rather than seeking in a loop.
        if !supportsRateAdjustment { return .monitor }
        let adjustment = min(maxRateAdjustment, magnitude / convergenceWindow)
        // Ahead → slow down; behind → speed up.
        return .adjustRate(drift > 0 ? 1 - adjustment : 1 + adjustment)
    }
}
