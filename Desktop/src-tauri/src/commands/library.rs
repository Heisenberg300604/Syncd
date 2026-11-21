use crate::app_state::AppState;
use crate::database::{IndexedFolder, TrackRow};
use crate::library::artwork::extract_and_cache_artwork;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, State};

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
                    let count = db.batch_upsert_tracks(&tracks).unwrap_or(0);
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
