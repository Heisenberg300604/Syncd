pub mod app_state;
pub mod audio;
pub mod commands;
pub mod database;
pub mod library;

use app_state::AppState;
use audio::AudioController;
use commands::*;
use database::Database;
use std::path::PathBuf;
use tauri::Manager;

pub fn resolve_install_anchor() -> PathBuf {
    if let Ok(override_dir) = std::env::var("SYNCD_DIR") {
        return PathBuf::from(override_dir);
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            let s = parent.to_string_lossy();
            // During development (cargo run), anchor to the Desktop root directory
            if s.contains("target\\debug")
                || s.contains("target/debug")
                || s.contains("target\\release")
                || s.contains("target/release")
            {
                return PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .parent()
                    .unwrap_or(parent)
                    .to_path_buf();
            }
            return parent.to_path_buf();
        }
    }

    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

pub fn run() {
    let install_dir = resolve_install_anchor();
    let index_dir = install_dir.join("Index");
    let db_path = index_dir.join("library.db");
    let user_db_path = index_dir.join("user.db");
    let playlist_db_path = index_dir.join("playlists.db");

    let db = match Database::init(&db_path) {
        Ok(d) => d,
        Err(err) => {
            eprintln!(
                "CRITICAL: Failed to initialize SQLite library database: {}",
                err
            );
            std::process::exit(1);
        }
    };

    let user_db = match database::UserDatabase::init(&user_db_path) {
        Ok(d) => d,
        Err(err) => {
            eprintln!(
                "CRITICAL: Failed to initialize SQLite user database: {}",
                err
            );
            std::process::exit(1);
        }
    };

    let playlist_db = match database::PlaylistDatabase::init(&playlist_db_path) {
        Ok(d) => d,
        Err(err) => {
            eprintln!(
                "CRITICAL: Failed to initialize SQLite playlist database: {}",
                err
            );
            std::process::exit(1);
        }
    };

    // Auto-migrate legacy data from library.db if needed
    database::migrate_old_data(&db_path, &user_db, &playlist_db);

    let audio = match AudioController::new() {
        Ok(a) => a,
        Err(err) => {
            eprintln!("CRITICAL: Failed to initialize audio engine: {}", err);
            std::process::exit(1);
        }
    };

    let artwork_dir = install_dir.join("Data").join("artwork");
    let _ = std::fs::create_dir_all(&artwork_dir);

    let app_state = AppState::new(db, user_db, playlist_db, install_dir, db_path, audio);

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(move |app| {
            let scope = app.asset_protocol_scope();
            let _ = scope.allow_directory(&artwork_dir, true);
            Ok(())
        })
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            get_app_version,
            get_system_health,
            get_setting,
            set_setting,
            get_all_settings,
            get_user_account,
            set_user_account,
            get_playlists,
            create_playlist,
            update_playlist,
            save_playlist_cover,
            save_playlist_cover_bytes,
            delete_playlist_cover,
            delete_playlist,
            rename_playlist,
            add_track_to_playlist,
            add_tracks_to_playlist,
            remove_track_from_playlist,
            get_playlist_tracks,
            get_playlist_full_tracks,
            scan_folder_for_playlist,
            get_artwork_dir,
            get_library_stats,
            add_folder,
            get_folders,
            remove_folder,
            get_tracks,
            get_tracks_by_ids,
            search_library,
            get_artwork,
            scan_library,
            cancel_scan,
            read_track_metadata,
            update_track_metadata,
            update_album_metadata,
            create_album_from_tracks,
            audio_play_track,
            audio_pause,
            audio_resume,
            audio_stop,
            audio_seek,
            audio_set_volume,
            audio_toggle_mute,
            audio_get_status,
            audio_list_devices,
            update_track_duration,
            queue_get,
            queue_add_tracks,
            queue_set_current,
            queue_remove_track,
            queue_clear,
            queue_save_all,
            start_auth_listener,
            cancel_auth_listener,
            save_auth_credentials,
            get_auth_credentials,
            clear_auth_credentials,
            open_browser_url,
            reveal_in_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running SyncD Desktop application");
}
