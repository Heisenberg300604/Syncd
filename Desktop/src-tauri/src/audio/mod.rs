pub mod controller;
pub mod decoder;
pub mod output;
pub mod types;

pub use controller::AudioController;
pub use types::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_playback_state_transitions() {
        let state = PlaybackState::Stopped;
        assert_eq!(state, PlaybackState::Stopped);

        let json = serde_json::to_string(&state).expect("serialize state");
        assert_eq!(json, "\"stopped\"");

        let deserialized: PlaybackState = serde_json::from_str(&json).expect("deserialize state");
        assert_eq!(deserialized, PlaybackState::Stopped);
    }

    #[test]
    fn test_audio_playback_status_serialization() {
        let status = AudioPlaybackStatus {
            state: PlaybackState::Playing,
            current_track_path: Some("C:\\Music\\Song.flac".to_string()),
            position_seconds: 42.5,
            duration_seconds: 240.0,
            volume: 0.85,
            is_muted: false,
            sample_rate: 48000,
            channels: 2,
            error_message: None,
        };

        let json = serde_json::to_string(&status).expect("serialize status");
        assert!(json.contains("\"positionSeconds\":42.5"));
        assert!(json.contains("\"durationSeconds\":240.0"));
        assert!(json.contains("\"state\":\"playing\""));
    }
}
