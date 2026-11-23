use crate::app_state::AppState;
use crate::database::PlaylistRow;
use base64::Engine;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tauri::State;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistFolderScanResult {
    pub folder_name: String,
    pub folder_path: String,
    pub track_ids: Vec<String>,
    pub track_count: usize,
    pub detected_cover_url: Option<String>,
}

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
    cover_url: Option<String>,
    import_folder_path: Option<String>,
    add_to_library: Option<bool>,
) -> Result<PlaylistRow, String> {
    let should_add_to_library = add_to_library.unwrap_or(false);

    // If an import folder is specified:
    if let Some(ref folder_path) = import_folder_path {
        let mut db = state.db.lock();
        let prefix_slash = folder_path.replace('\\', "/");
        let prefix_backslash = folder_path.replace('/', "\\");

        if should_add_to_library {
            let _ = db.add_indexed_folder(folder_path);
            let _ = db.conn().execute(
                "UPDATE tracks SET is_library = 1 WHERE path LIKE ?1 || '%' OR path LIKE ?2 || '%';",
                rusqlite::params![&prefix_slash, &prefix_backslash],
            );
            let _ = db.update_folder_scan_status(folder_path);
        } else {
            // Remove from indexed_folders and ensure tracks are is_library = 0
            let _ = db.remove_indexed_folder(folder_path);
            let _ = db.conn().execute(
                "UPDATE tracks SET is_library = 0 WHERE path LIKE ?1 || '%' OR path LIKE ?2 || '%';",
                rusqlite::params![&prefix_slash, &prefix_backslash],
            );
        }
    }

    let db = state.playlist_db.lock();
    db.create_playlist(
        &name,
        description.as_deref(),
        cover_url.as_deref(),
        import_folder_path.as_deref(),
    )
    .map_err(|e| format!("Failed to create playlist: {}", e))
}

#[tauri::command]
pub fn update_playlist(
    state: State<'_, AppState>,
    id: String,
    name: String,
    description: Option<String>,
    cover_url: Option<String>,
) -> Result<(), String> {
    let db = state.playlist_db.lock();
    db.update_playlist(&id, &name, description.as_deref(), cover_url.as_deref())
        .map_err(|e| format!("Failed to update playlist: {}", e))
}

fn get_playlist_artwork_dir(state: &AppState) -> PathBuf {
    let dir = state.install_dir.join("Data").join("artwork").join("playlists");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

fn cleanup_old_covers(artwork_dir: &Path, playlist_id: &str) {
    if let Ok(entries) = std::fs::read_dir(artwork_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                if stem == playlist_id {
                    let _ = std::fs::remove_file(path);
                }
            }
        }
    }
}

#[tauri::command]
pub fn save_playlist_cover(
    state: State<'_, AppState>,
    playlist_id: String,
    source_path: String,
) -> Result<String, String> {
    let src = Path::new(&source_path);
    if !src.exists() || !src.is_file() {
        return Err(format!("Source image does not exist: {}", source_path));
    }

    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();

    let artwork_dir = get_playlist_artwork_dir(&state);
    cleanup_old_covers(&artwork_dir, &playlist_id);

    let target_file = artwork_dir.join(format!("{}.{}", playlist_id, ext));
    std::fs::copy(src, &target_file)
        .map_err(|e| format!("Failed to copy cover image: {}", e))?;

    let target_path_str = target_file.to_string_lossy().to_string();

    let db = state.playlist_db.lock();
    db.update_playlist_cover(&playlist_id, Some(&target_path_str))
        .map_err(|e| format!("Failed to update playlist cover in database: {}", e))?;

    Ok(target_path_str)
}

#[tauri::command]
pub fn save_playlist_cover_bytes(
    state: State<'_, AppState>,
    playlist_id: String,
    base64_data: String,
    extension: Option<String>,
) -> Result<String, String> {
    let ext = extension.unwrap_or_else(|| {
        if base64_data.starts_with("data:image/png") {
            "png".to_string()
        } else if base64_data.starts_with("data:image/webp") {
            "webp".to_string()
        } else {
            "jpg".to_string()
        }
    });

    let raw_b64 = if let Some(comma_pos) = base64_data.find(',') {
        &base64_data[comma_pos + 1..]
    } else {
        &base64_data
    };

    let decoded = base64::engine::general_purpose::STANDARD
        .decode(raw_b64.trim())
        .map_err(|e| format!("Invalid base64 image data: {}", e))?;

    let artwork_dir = get_playlist_artwork_dir(&state);
    cleanup_old_covers(&artwork_dir, &playlist_id);

    let target_file = artwork_dir.join(format!("{}.{}", playlist_id, ext));
    std::fs::write(&target_file, &decoded)
        .map_err(|e| format!("Failed to write cover image: {}", e))?;

    let target_path_str = target_file.to_string_lossy().to_string();

    let db = state.playlist_db.lock();
    db.update_playlist_cover(&playlist_id, Some(&target_path_str))
        .map_err(|e| format!("Failed to update playlist cover in database: {}", e))?;

    Ok(target_path_str)
}

#[tauri::command]
pub fn delete_playlist_cover(
    state: State<'_, AppState>,
    playlist_id: String,
) -> Result<(), String> {
    let artwork_dir = get_playlist_artwork_dir(&state);
    cleanup_old_covers(&artwork_dir, &playlist_id);

    let db = state.playlist_db.lock();
    db.update_playlist_cover(&playlist_id, Some("none"))
        .map_err(|e| format!("Failed to clear playlist cover: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn delete_playlist(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let artwork_dir = get_playlist_artwork_dir(&state);
    cleanup_old_covers(&artwork_dir, &id);

    // 1. Retrieve playlist import folder and track IDs before deleting
    let (import_folder, track_ids) = {
        let db = state.playlist_db.lock();
        let folder: Option<String> = db
            .conn()
            .query_row(
                "SELECT import_folder_path FROM playlists WHERE id = ?1;",
                [&id],
                |r| r.get(0),
            )
            .ok()
            .flatten();
        let tracks = db.get_playlist_tracks(&id).unwrap_or_default();
        (folder, tracks)
    };

    // 2. Delete playlist from playlist_db (cascades to playlist_tracks)
    {
        let db = state.playlist_db.lock();
        db.delete_playlist(&id)
            .map_err(|e| format!("Failed to delete playlist: {}", e))?;
    }

    // 3. Track and folder deletion ONLY occurs when the playlist was created by scanning a folder.
    // If the playlist was created manually and tracks were added later, tracks and library index locations are untouched.
    if let Some(folder_path) = import_folder {
        let mut db = state.db.lock();
        // Remove the scan location from indexed_folders so future rescans don't re-add it
        let _ = db.remove_indexed_folder(&folder_path);

        // Purge playlist-only tracks (is_library = 0) that are not used in any other playlist
        let p_db = state.playlist_db.lock();
        for track_id in track_ids {
            let in_other_playlist: bool = p_db
                .conn()
                .query_row(
                    "SELECT COUNT(*) FROM playlist_tracks WHERE track_id = ?1;",
                    [&track_id],
                    |r| r.get::<_, i64>(0),
                )
                .unwrap_or(0)
                > 0;

            if !in_other_playlist {
                let _ = db.conn().execute(
                    "DELETE FROM tracks WHERE id = ?1 AND is_library = 0;",
                    [&track_id],
                );
                let _ = db.conn().execute(
                    "DELETE FROM tracks_fts WHERE track_id = ?1 AND track_id NOT IN (SELECT id FROM tracks);",
                    [&track_id],
                );
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn rename_playlist(state: State<'_, AppState>, id: String, name: String) -> Result<(), String> {
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
pub fn add_tracks_to_playlist(
    state: State<'_, AppState>,
    playlist_id: String,
    track_ids: Vec<String>,
) -> Result<usize, String> {
    let mut db = state.playlist_db.lock();
    db.add_tracks_to_playlist(&playlist_id, &track_ids)
        .map_err(|e| format!("Failed to add tracks to playlist: {}", e))
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

#[tauri::command]
pub fn scan_folder_for_playlist(
    state: State<'_, AppState>,
    folder_path: String,
    _add_to_library: bool,
) -> Result<PlaylistFolderScanResult, String> {
    let folder = Path::new(&folder_path);
    if !folder.exists() || !folder.is_dir() {
        return Err(format!(
            "Folder does not exist or is not a directory: {}",
            folder_path
        ));
    }

    let folder_name = folder
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("New Playlist")
        .to_string();

    // 1. Lazy Commit: do not register in indexed_folders during folder scan
    // Folder is only committed to indexed_folders if the user creates the playlist with the library toggle on.

    // 2. Discover supported audio files in this directory
    const SUPPORTED_EXTS: &[&str] = &[
        "mp3", "flac", "wav", "m4a", "aac", "ogg", "opus", "alac", "aiff",
    ];
    let mut audio_paths: Vec<PathBuf> = Vec::new();
    for entry in walkdir::WalkDir::new(folder)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let p = entry.path();
        if p.is_file() {
            if let Some(ext) = p.extension().and_then(|s| s.to_str()) {
                if SUPPORTED_EXTS.contains(&ext.to_lowercase().as_str()) {
                    audio_paths.push(p.to_path_buf());
                }
            }
        }
    }

    if audio_paths.is_empty() {
        return Err(format!(
            "No supported audio tracks found in \"{}\"",
            folder_name
        ));
    }

    // 3. Scan metadata & extract artwork if present
    let artwork_dir = state.install_dir.join("Data").join("artwork");
    let mut detected_cover_url: Option<String> = None;

    // Check for folder cover image file
    let candidate_covers = [
        "cover.jpg",
        "cover.png",
        "folder.jpg",
        "folder.png",
        "front.jpg",
        "front.png",
        "albumart.jpg",
    ];
    for cand in &candidate_covers {
        let p = folder.join(cand);
        if p.exists() && p.is_file() {
            detected_cover_url = Some(p.to_string_lossy().to_string());
            break;
        }
    }

    let mut scanned_tracks = Vec::new();
    let mut track_ids = Vec::new();

    for path in &audio_paths {
        let path_str = path.to_string_lossy().to_string();
        let track_id = format!(
            "trk_{}",
            Sha256::digest(path_str.as_bytes())[..8]
                .iter()
                .map(|b| format!("{:02x}", b))
                .collect::<String>()
        );
        track_ids.push(track_id);

        match crate::library::metadata::extract_metadata(path) {
            Ok(metadata) => {
                if detected_cover_url.is_none() && metadata.has_artwork {
                    if let Ok(Some(cached_art)) =
                        crate::library::artwork::extract_and_cache_artwork(path, &artwork_dir)
                    {
                        detected_cover_url = Some(cached_art.to_string_lossy().to_string());
                    }
                }
                scanned_tracks.push(crate::library::scanner::ScannedTrack {
                    path: path.clone(),
                    metadata,
                });
            }
            Err(e) => {
                log::warn!("Failed to read metadata for {}: {}", path.display(), e);
            }
        }
    }

    // 4. Batch upsert into database with is_library = false
    // Tracks can be loaded/played in the playlist, but DO NOT leak into library counts
    if !scanned_tracks.is_empty() {
        let mut db = state.db.lock();
        let _ = db.batch_upsert_tracks(&scanned_tracks, false);
    }

    let track_count = track_ids.len();

    Ok(PlaylistFolderScanResult {
        folder_name,
        folder_path,
        track_ids,
        track_count,
        detected_cover_url,
    })
}

#[tauri::command]
pub fn get_playlist_full_tracks(
    state: State<'_, AppState>,
    playlist_id: String,
) -> Result<Vec<crate::database::TrackRow>, String> {
    let track_ids = {
        let db = state.playlist_db.lock();
        db.get_playlist_tracks(&playlist_id)
            .map_err(|e| format!("Failed to get playlist tracks: {}", e))?
    };

    if track_ids.is_empty() {
        return Ok(Vec::new());
    }

    let db = state.db.lock();
    db.get_tracks_by_ids(&track_ids)
        .map_err(|e| format!("Failed to get track details: {}", e))
}
