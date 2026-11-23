use crate::app_state::AppState;
use crate::database::{IndexedFolder, TrackRow};
use crate::library::artwork::extract_and_cache_artwork;
use crate::library::metadata::{
    read_detailed_metadata, write_track_metadata_to_file, DetailedAudioMetadata,
    TrackMetadataUpdate,
};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumMetadataUpdatePayload {
    pub album: String,
    pub album_artist: Option<String>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub artwork_base64: Option<String>,
    pub artwork_path: Option<String>,
    pub remove_artwork: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAlbumTrackItem {
    pub track_id: String,
    pub track_number: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAlbumPayload {
    pub album: String,
    pub album_artist: Option<String>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub artwork_base64: Option<String>,
    pub artwork_path: Option<String>,
    pub tracks: Vec<CreateAlbumTrackItem>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryStats {
    pub track_count: i64,
    pub album_count: i64,
    pub artist_count: i64,
    pub folder_count: i64,
}

#[tauri::command]
pub fn get_library_stats(state: State<'_, AppState>) -> Result<LibraryStats, String> {
    let db = state.db.lock();
    let (track_count, album_count, artist_count, folder_count) = db
        .get_library_counts()
        .map_err(|e| format!("Failed to read counts: {}", e))?;

    Ok(LibraryStats {
        track_count,
        album_count,
        artist_count,
        folder_count,
    })
}

#[tauri::command]
pub fn add_folder(state: State<'_, AppState>, path: String) -> Result<IndexedFolder, String> {
    let p = Path::new(&path);
    if !p.exists() || !p.is_dir() {
        return Err(format!(
            "Path does not exist or is not a directory: {}",
            path
        ));
    }

    let mut db = state.db.lock();
    db.add_indexed_folder(&path)
        .map_err(|e| format!("Failed to add folder: {}", e))
}

#[tauri::command]
pub fn get_folders(state: State<'_, AppState>) -> Result<Vec<IndexedFolder>, String> {
    let db = state.db.lock();
    db.get_indexed_folders()
        .map_err(|e| format!("Failed to get folders: {}", e))
}

#[tauri::command]
pub fn remove_folder(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let hashes = {
        let mut db = state.db.lock();
        db.remove_indexed_folder(&id)
            .map_err(|e| format!("Failed to remove folder: {}", e))?
    };

    let artwork_dir = state.install_dir.join("Data").join("artwork");
    if artwork_dir.exists() {
        for hash in hashes {
            let file_path = artwork_dir.join(format!("{}.jpg", hash));
            if file_path.exists() {
                let _ = std::fs::remove_file(file_path);
            }
        }

        let remaining_folders = {
            let db = state.db.lock();
            db.get_indexed_folders().map(|f| f.len()).unwrap_or(0)
        };
        if remaining_folders == 0 {
            if let Ok(entries) = std::fs::read_dir(&artwork_dir) {
                for entry in entries.flatten() {
                    let _ = std::fs::remove_file(entry.path());
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_tracks(
    state: State<'_, AppState>,
    sort_by: Option<String>,
    order: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<Vec<TrackRow>, String> {
    let db = state.db.lock();
    let sort_col = sort_by.unwrap_or_else(|| "title".to_string());
    let sort_ord = order.unwrap_or_else(|| "asc".to_string());
    let lim = limit.unwrap_or(500);
    let off = offset.unwrap_or(0);

    db.get_tracks(&sort_col, &sort_ord, lim, off)
        .map_err(|e| format!("Failed to query tracks: {}", e))
}

#[tauri::command]
pub fn get_tracks_by_ids(
    state: State<'_, AppState>,
    track_ids: Vec<String>,
) -> Result<Vec<TrackRow>, String> {
    let db = state.db.lock();
    db.get_tracks_by_ids(&track_ids)
        .map_err(|e| format!("Failed to get tracks by IDs: {}", e))
}

#[tauri::command]
pub fn search_library(
    state: State<'_, AppState>,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<TrackRow>, String> {
    let db = state.db.lock();
    let lim = limit.unwrap_or(50);
    db.search_tracks_fts(&query, lim)
        .map_err(|e| format!("Search failed: {}", e))
}

#[tauri::command]
pub fn get_artwork(state: State<'_, AppState>, track_id: String) -> Result<Option<String>, String> {
    let (track_path, has_artwork, artwork_hash): (String, bool, Option<String>) = {
        let mut db = state.db.lock();
        db.conn()
            .query_row(
                "SELECT path, has_artwork, artwork_hash FROM tracks WHERE id = ?1;",
                [&track_id],
                |r| Ok((r.get(0)?, r.get::<_, i64>(1)? == 1, r.get(2)?)),
            )
            .map_err(|e| format!("Track not found: {}", e))?
    };

    if !has_artwork {
        return Ok(None);
    }

    let artwork_dir = state.install_dir.join("Data").join("artwork");

    // Fast path: if artwork is already hashed and cached on disk, return instantly (sub-millisecond)
    if let Some(hash) = &artwork_hash {
        let candidate_jpg = artwork_dir.join(format!("{}.jpg", hash));
        if candidate_jpg.exists() {
            return Ok(Some(candidate_jpg.to_string_lossy().to_string()));
        }
        let candidate_png = artwork_dir.join(format!("{}.png", hash));
        if candidate_png.exists() {
            return Ok(Some(candidate_png.to_string_lossy().to_string()));
        }
    }

    // Extraction path: extract from audio tag once and cache hash in SQLite for future sub-ms lookups
    let cached_path = extract_and_cache_artwork(Path::new(&track_path), &artwork_dir)
        .map_err(|e| format!("Failed to extract artwork: {}", e))?;

    if let Some(path) = cached_path {
        if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
            let mut db = state.db.lock();
            let _ = db.conn().execute(
                "UPDATE tracks SET artwork_hash = ?1 WHERE id = ?2;",
                rusqlite::params![stem, &track_id],
            );
        }
        return Ok(Some(path.to_string_lossy().to_string()));
    }

    Ok(None)
}

#[tauri::command]
pub fn cancel_scan(state: State<'_, AppState>) -> Result<(), String> {
    state.scanner.cancel();
    Ok(())
}

#[tauri::command]
pub fn scan_library(app_handle: AppHandle, state: State<'_, AppState>) -> Result<usize, String> {
    if state
        .is_scanning
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("Library scan is already running".to_string());
    }

    let folders = {
        let db = state.db.lock();
        db.get_indexed_folders().map_err(|e| e.to_string())?
    };

    let dir_paths: Vec<PathBuf> = folders.into_iter().map(|f| PathBuf::from(f.path)).collect();
    let folder_count = dir_paths.len();

    let signatures = {
        let db = state.db.lock();
        db.get_file_signatures().map_err(|e| e.to_string())?
    };

    let db_arc = state.db.clone();
    let scanner_arc = state.scanner.clone();
    let is_scanning_arc = state.is_scanning.clone();

    std::thread::spawn(move || {
        let app = app_handle.clone();
        let scan_result = scanner_arc.scan_directories(&dir_paths, &signatures, |progress| {
            let _ = app.emit("library:scan-progress", progress);
        });

        match scan_result {
            Ok(tracks) => {
                let was_cancelled = scanner_arc.is_cancelled();
                let total_found = tracks.len();
                let inserted = if was_cancelled {
                    log::info!("Scan cancelled by user; skipping DB write");
                    0
                } else {
                    let mut db = db_arc.lock();
                    let count = db.batch_upsert_tracks(&tracks, true).unwrap_or(0);
                    for dir_path in &dir_paths {
                        let path_str = dir_path.to_string_lossy().to_string();
                        let _ = db.update_folder_scan_status(&path_str);
                    }
                    count
                };

                log::info!(
                    "Scan finished. Found: {}, Inserted/Updated: {}, Cancelled: {}",
                    total_found,
                    inserted,
                    was_cancelled
                );

                let _ = app.emit(
                    "library:scan-complete",
                    serde_json::json!({
                        "total": total_found,
                        "inserted": inserted,
                        "cancelled": was_cancelled
                    }),
                );
            }
            Err(err) => {
                log::error!("Scan error: {}", err);
                let _ = app.emit("library:scan-error", err);
            }
        }

        is_scanning_arc.store(false, Ordering::SeqCst);
    });

    Ok(folder_count)
}

#[tauri::command]
pub fn read_track_metadata(
    state: State<'_, AppState>,
    track_id: String,
) -> Result<DetailedAudioMetadata, String> {
    let track = {
        let db = state.db.lock();
        db.get_track_by_id(&track_id)
            .map_err(|e| format!("Database error: {}", e))?
            .ok_or_else(|| format!("Track not found with ID: {}", track_id))?
    };

    let track_path = Path::new(&track.path);
    read_detailed_metadata(track_path, Some(track.id), track.artwork_hash)
}

#[tauri::command]
pub fn update_track_metadata(
    state: State<'_, AppState>,
    track_id: String,
    update: TrackMetadataUpdate,
) -> Result<TrackRow, String> {
    let track = {
        let db = state.db.lock();
        db.get_track_by_id(&track_id)
            .map_err(|e| format!("Database query error: {}", e))?
            .ok_or_else(|| format!("Track not found with ID: {}", track_id))?
    };

    let artwork_dir = state.install_dir.join("Data").join("artwork");
    let (extracted, new_artwork_hash, renamed_path) =
        write_track_metadata_to_file(Path::new(&track.path), &update, &artwork_dir)
            .map_err(|e| format!("Failed to update track file: {}", e))?;

    let mut db = state.db.lock();
    db.update_track_metadata(
        &track_id,
        &extracted,
        new_artwork_hash.as_deref(),
        renamed_path.as_deref().and_then(|p| p.to_str()),
    )
    .map_err(|e| format!("Database update failed: {}", e))
}

#[tauri::command]
pub fn update_album_metadata(
    state: State<'_, AppState>,
    track_ids: Vec<String>,
    payload: AlbumMetadataUpdatePayload,
) -> Result<Vec<TrackRow>, String> {
    if track_ids.is_empty() {
        return Ok(Vec::new());
    }

    let tracks = {
        let db = state.db.lock();
        db.get_tracks_by_ids(&track_ids)
            .map_err(|e| format!("Failed to fetch tracks: {}", e))?
    };

    let artwork_dir = state.install_dir.join("Data").join("artwork");

    // Pre-cache artwork if provided as base64 so we only process it once for the entire album
    let mut resolved_artwork_path: Option<String> = payload.artwork_path.clone();
    if let Some(ref base64_str) = payload.artwork_base64 {
        let clean_base64 = if let Some(comma_pos) = base64_str.find(',') {
            &base64_str[(comma_pos + 1)..]
        } else {
            base64_str.as_str()
        };

        use base64::Engine;
        if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(clean_base64.trim()) {
            if !bytes.is_empty() {
                use sha2::{Digest, Sha256};
                let mut hasher = Sha256::new();
                hasher.update(&bytes);
                let hash = format!("{:x}", hasher.finalize());
                let ext = if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
                    "png"
                } else {
                    "jpg"
                };
                let _ = std::fs::create_dir_all(&artwork_dir);
                let cached_file = artwork_dir.join(format!("{}.{}", hash, ext));
                let _ = std::fs::write(&cached_file, &bytes);
                resolved_artwork_path = Some(cached_file.to_string_lossy().to_string());
            }
        }
    }

    let update_template = TrackMetadataUpdate {
        title: None,
        artist: None,
        album: Some(payload.album.clone()),
        album_artist: payload.album_artist.clone(),
        track_number: None,
        track_total: None,
        disc_number: None,
        disc_total: None,
        year: payload.year,
        genre: payload.genre.clone(),
        comment: None,
        artwork_base64: None,
        artwork_path: resolved_artwork_path,
        remove_artwork: payload.remove_artwork,
        new_file_name: None,
    };

    let mut updated_tracks = Vec::new();
    let mut errors = Vec::new();

    for track in tracks {
        let (extracted, new_artwork_hash, _renamed) = match write_track_metadata_to_file(
            Path::new(&track.path),
            &update_template,
            &artwork_dir,
        ) {
            Ok(res) => res,
            Err(err) => {
                log::warn!("Failed to write metadata for track {}: {}", track.id, err);
                errors.push(format!("{}: {}", track.title, err));
                continue;
            }
        };

        let mut db = state.db.lock();
        match db.update_track_metadata(&track.id, &extracted, new_artwork_hash.as_deref(), None) {
            Ok(updated_row) => updated_tracks.push(updated_row),
            Err(err) => {
                log::error!("Database update error for track {}: {}", track.id, err);
                errors.push(format!("DB {}: {}", track.title, err));
            }
        }
    }

    if updated_tracks.is_empty() && !errors.is_empty() {
        return Err(format!(
            "Failed to update album tracks: {}",
            errors.join("; ")
        ));
    }

    Ok(updated_tracks)
}

#[tauri::command]
pub fn create_album_from_tracks(
    state: State<'_, AppState>,
    payload: CreateAlbumPayload,
) -> Result<Vec<TrackRow>, String> {
    if payload.tracks.is_empty() {
        return Err("No tracks specified for new album".to_string());
    }

    let track_ids: Vec<String> = payload.tracks.iter().map(|t| t.track_id.clone()).collect();
    let tracks = {
        let db = state.db.lock();
        db.get_tracks_by_ids(&track_ids)
            .map_err(|e| format!("Failed to fetch tracks: {}", e))?
    };

    let artwork_dir = state.install_dir.join("Data").join("artwork");

    // Pre-cache artwork once if provided as base64
    let mut resolved_artwork_path: Option<String> = payload.artwork_path.clone();
    if let Some(ref base64_str) = payload.artwork_base64 {
        let clean_base64 = if let Some(comma_pos) = base64_str.find(',') {
            &base64_str[(comma_pos + 1)..]
        } else {
            base64_str.as_str()
        };

        use base64::Engine;
        if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(clean_base64.trim()) {
            if !bytes.is_empty() {
                use sha2::{Digest, Sha256};
                let mut hasher = Sha256::new();
                hasher.update(&bytes);
                let hash = format!("{:x}", hasher.finalize());
                let ext = if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
                    "png"
                } else {
                    "jpg"
                };
                let _ = std::fs::create_dir_all(&artwork_dir);
                let cached_file = artwork_dir.join(format!("{}.{}", hash, ext));
                let _ = std::fs::write(&cached_file, &bytes);
                resolved_artwork_path = Some(cached_file.to_string_lossy().to_string());
            }
        }
    }

    let track_num_map: std::collections::HashMap<String, Option<u32>> = payload
        .tracks
        .into_iter()
        .map(|t| (t.track_id, t.track_number))
        .collect();

    let total_tracks = tracks.len() as u32;
    let mut updated_tracks = Vec::new();
    let mut errors = Vec::new();

    for track in tracks {
        let track_number = track_num_map.get(&track.id).copied().flatten();
        let update = TrackMetadataUpdate {
            title: None,
            artist: None,
            album: Some(payload.album.clone()),
            album_artist: payload.album_artist.clone(),
            track_number,
            track_total: Some(total_tracks),
            disc_number: None,
            disc_total: None,
            year: payload.year,
            genre: payload.genre.clone(),
            comment: None,
            artwork_base64: None,
            artwork_path: resolved_artwork_path.clone(),
            remove_artwork: None,
            new_file_name: None,
        };

        let (extracted, new_artwork_hash, _renamed) =
            match write_track_metadata_to_file(Path::new(&track.path), &update, &artwork_dir) {
                Ok(res) => res,
                Err(err) => {
                    log::warn!("Failed to rewrite track file for {}: {}", track.id, err);
                    errors.push(format!("{}: {}", track.title, err));
                    continue;
                }
            };

        let mut db = state.db.lock();
        match db.update_track_metadata(&track.id, &extracted, new_artwork_hash.as_deref(), None) {
            Ok(updated_row) => updated_tracks.push(updated_row),
            Err(err) => {
                log::error!("Database update error for track {}: {}", track.id, err);
                errors.push(format!("DB {}: {}", track.title, err));
            }
        }
    }

    if updated_tracks.is_empty() && !errors.is_empty() {
        return Err(format!("Failed to create album: {}", errors.join("; ")));
    }

    Ok(updated_tracks)
}

#[tauri::command]
pub fn reveal_in_folder(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let clean_path = path.replace('/', "\\");
        let _ = Command::new("explorer")
            .arg(format!("/select,{}", clean_path))
            .status();
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let _ = Command::new("open").arg("-R").arg(&path).status();
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        if let Some(parent) = p.parent() {
            let _ = Command::new("xdg-open").arg(parent).status();
        }
    }

    Ok(())
}
