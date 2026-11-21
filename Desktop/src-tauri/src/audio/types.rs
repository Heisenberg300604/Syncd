use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PlaybackState {
    Stopped,
    Loading,
    Playing,
    Paused,
    Seeking,
    Ended,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioPlaybackStatus {
    pub state: PlaybackState,
    pub current_track_path: Option<String>,
    pub position_seconds: f64,
    pub duration_seconds: f64,
    pub volume: f32,
    pub is_muted: bool,
    pub sample_rate: u32,
    pub channels: u16,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDeviceDescriptor {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}
