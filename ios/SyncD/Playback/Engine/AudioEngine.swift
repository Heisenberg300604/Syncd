import Foundation

/// Owns actual audio output. Contains no room logic: it plays what it is told
/// and reports what really happened.
@MainActor
protocol AudioEngine: AnyObject {
    var state: EngineState { get }
    var currentItem: PlaybackItem? { get }
    /// Seconds. Reflects the player's real position.
    var currentTime: TimeInterval { get }
    /// From the asset once loaded; may differ from the room's metadata.
    var duration: TimeInterval? { get }
    var rate: Double { get }
    var supportsRateAdjustment: Bool { get }

    /// Called on every state change, including ones iOS initiates
    /// (interruptions, stalls, end of item).
    var onStateChange: ((EngineState) -> Void)? { get set }

    func load(_ item: PlaybackItem) async throws(PlaybackError)
    func play()
    func pause()
    /// Returns `false` if a newer seek superseded this one.
    @discardableResult
    func seek(to position: TimeInterval) async -> Bool
    /// Playback rate used while playing (gradual drift correction).
    func setRate(_ rate: Double)
    func setVolume(_ volume: Float)
    func stop()
}
