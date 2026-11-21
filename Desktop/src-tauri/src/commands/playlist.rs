use tauri::State;
use crate::app_state::AppState;
use crate::database::PlaylistRow;

#[tauri::command]
pub fn get_playlists(state: State<'_, AppState>) -> Result<Vec<PlaylistRow>, String> {
    let db = state.playlist_db.lock();
    db.get_playlists()
        .map_err(|e| format!("Failed to get playlists: {}", e))
}

#[tauri::command]
pub fn create_playlist(
    state: State<'_, AppState>,
    name: String,
    description: Option<String>,
) -> Result<PlaylistRow, String> {
    let db = state.playlist_db.lock();
    db.create_playlist(&name, description.as_deref())
        .map_err(|e| format!("Failed to create playlist: {}", e))
}

#[tauri::command]
pub fn delete_playlist(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.playlist_db.lock();
    db.delete_playlist(&id)
        .map_err(|e| format!("Failed to delete playlist: {}", e))
}

#[tauri::command]
pub fn rename_playlist(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<(), String> {
    let db = state.playlist_db.lock();
    db.rename_playlist(&id, &name)
        .map_err(|e| format!("Failed to rename playlist: {}", e))
}

#[tauri::command]
pub fn add_track_to_playlist(
    state: State<'_, AppState>,
    playlist_id: String,
    track_id: String,
) -> Result<bool, String> {
    let db = state.playlist_db.lock();
    db.add_track_to_playlist(&playlist_id, &track_id)
        .map_err(|e| format!("Failed to add track to playlist: {}", e))
}

#[tauri::command]
pub fn remove_track_from_playlist(
    state: State<'_, AppState>,
    playlist_id: String,
    track_id: String,
) -> Result<(), String> {
    let db = state.playlist_db.lock();
    db.remove_track_from_playlist(&playlist_id, &track_id)
        .map_err(|e| format!("Failed to remove track from playlist: {}", e))
}

#[tauri::command]
pub fn get_playlist_tracks(
    state: State<'_, AppState>,
    playlist_id: String,
) -> Result<Vec<String>, String> {
    let db = state.playlist_db.lock();
    db.get_playlist_tracks(&playlist_id)
        .map_err(|e| format!("Failed to get playlist tracks: {}", e))
}
