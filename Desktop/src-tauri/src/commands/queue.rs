use tauri::State;
use crate::app_state::AppState;
use crate::database::{QueuedTrackRow, QueuedTrackInput};

#[tauri::command]
pub fn queue_get(state: State<'_, AppState>) -> Result<Vec<QueuedTrackRow>, String> {
    let db = state.user_db.lock();
    db.get_playback_queue()
        .map_err(|e| format!("Failed to get playback queue: {}", e))
}

#[tauri::command]
pub fn queue_add_tracks(
    state: State<'_, AppState>,
    tracks: Vec<QueuedTrackInput>,
) -> Result<Vec<QueuedTrackRow>, String> {
    let mut db = state.user_db.lock();
    db.add_to_playback_queue(&tracks)
        .map_err(|e| format!("Failed to add tracks to queue: {}", e))
}

#[tauri::command]
pub fn queue_set_current(
    state: State<'_, AppState>,
    track_id: String,
) -> Result<(), String> {
    let db = state.user_db.lock();
    db.set_current_track_in_queue(&track_id)
        .map_err(|e| format!("Failed to set current queue track: {}", e))
}

#[tauri::command]
pub fn queue_remove_track(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let db = state.user_db.lock();
    db.remove_from_playback_queue(&id)
        .map_err(|e| format!("Failed to remove track from queue: {}", e))
}

#[tauri::command]
pub fn queue_clear(state: State<'_, AppState>) -> Result<(), String> {
    let db = state.user_db.lock();
    db.clear_playback_queue()
        .map_err(|e| format!("Failed to clear playback queue: {}", e))
}

#[tauri::command]
pub fn queue_save_all(
    state: State<'_, AppState>,
    tracks: Vec<QueuedTrackInput>,
    current_track_id: Option<String>,
) -> Result<Vec<QueuedTrackRow>, String> {
    let mut db = state.user_db.lock();
    db.save_playback_queue(&tracks, current_track_id.as_deref())
        .map_err(|e| format!("Failed to save playback queue: {}", e))
}
