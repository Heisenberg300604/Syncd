use crate::app_state::AppState;
use crate::audio::{AudioDeviceDescriptor, AudioPlaybackStatus};
use tauri::State;

#[tauri::command]
pub fn audio_play_track(
    state: State<'_, AppState>,
    path: String,
    start_pos: Option<f64>,
) -> Result<(), String> {
    state.audio.play_track(&path, start_pos.unwrap_or(0.0))
}

#[tauri::command]
pub fn audio_pause(state: State<'_, AppState>) -> Result<(), String> {
    state.audio.pause()
}

#[tauri::command]
pub fn audio_resume(state: State<'_, AppState>) -> Result<(), String> {
    state.audio.resume()
}

#[tauri::command]
pub fn audio_stop(state: State<'_, AppState>) -> Result<(), String> {
    state.audio.stop()
}

#[tauri::command]
pub fn audio_seek(state: State<'_, AppState>, position_seconds: f64) -> Result<(), String> {
    state.audio.seek(position_seconds)
}

#[tauri::command]
pub fn audio_set_volume(state: State<'_, AppState>, volume: f32) -> Result<(), String> {
    state.audio.set_volume(volume);
    Ok(())
}

#[tauri::command]
pub fn audio_toggle_mute(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.audio.toggle_mute())
}

#[tauri::command]
pub fn audio_get_status(state: State<'_, AppState>) -> Result<AudioPlaybackStatus, String> {
    Ok(state.audio.get_status())
}

#[tauri::command]
pub fn audio_list_devices(
    state: State<'_, AppState>,
) -> Result<Vec<AudioDeviceDescriptor>, String> {
    Ok(state.audio.list_devices())
}

#[tauri::command]
pub fn update_track_duration(
    state: State<'_, AppState>,
    track_id: String,
    duration_seconds: f64,
) -> Result<(), String> {
    if duration_seconds > 0.0 {
        let mut db = state.db.lock();
        let _ = db.conn().execute(
            "UPDATE tracks SET duration_seconds = ?1 WHERE id = ?2 AND (duration_seconds IS NULL OR duration_seconds <= 0.0);",
            rusqlite::params![duration_seconds, track_id],
        );
    }
    Ok(())
}
