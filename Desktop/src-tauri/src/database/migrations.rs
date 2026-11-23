use rusqlite::{Connection, Result};

pub fn run_migrations(conn: &mut Connection) -> Result<()> {
    // 1. Create schema_migrations table if not exists
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    )?;

    let current_version: i64 = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations;",
        [],
        |row| row.get(0),
    )?;

    // Migration 1: Initial Core Schema
    if current_version < 1 {
        log::info!("Applying database migration 001_initial_schema...");
        let tx = conn.transaction()?;

        tx.execute_batch(
            "
            -- Indexed directories
            CREATE TABLE IF NOT EXISTS indexed_folders (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL UNIQUE,
                date_added TEXT NOT NULL DEFAULT (datetime('now')),
                last_scanned TEXT,
                track_count INTEGER NOT NULL DEFAULT 0
            );

            -- Audio tracks metadata
            CREATE TABLE IF NOT EXISTS tracks (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                artist TEXT NOT NULL,
                album TEXT NOT NULL,
                album_artist TEXT,
                duration_seconds REAL NOT NULL DEFAULT 0.0,
                track_number INTEGER,
                disc_number INTEGER,
                year INTEGER,
                genre TEXT,
                format TEXT NOT NULL,
                bitrate_kbps INTEGER,
                file_size_bytes INTEGER NOT NULL,
                has_artwork INTEGER NOT NULL DEFAULT 0,
                artwork_hash TEXT,
                date_modified TEXT NOT NULL,
                date_indexed TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
            CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
            CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);

            -- Playlists
            CREATE TABLE IF NOT EXISTS playlists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS playlist_tracks (
                playlist_id TEXT NOT NULL,
                track_id TEXT NOT NULL,
                position INTEGER NOT NULL,
                added_at TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (playlist_id, track_id),
                FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
                FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
            );

            -- Link local tracks to social room video IDs
            CREATE TABLE IF NOT EXISTS social_track_mappings (
                video_id TEXT NOT NULL,
                track_id TEXT NOT NULL,
                linked_at TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (video_id, track_id),
                FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
            );

            -- Key-Value settings persistence
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            -- FTS5 Full Text Search index for fast instantaneous searching
            CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
                track_id UNINDEXED,
                title,
                artist,
                album,
                genre,
                tokenize = 'unicode61 remove_diacritics 2'
            );

            -- Record migration 1
            INSERT INTO schema_migrations (version) VALUES (1);
            ",
        )?;

        tx.commit()?;
        log::info!("Database migration 001 applied successfully.");
    }

    // Migration 2: Track library flag to isolate playlist-only imports from permanent library
    if current_version < 2 {
        log::info!("Applying database migration 002_track_library_flag...");
        let tx = conn.transaction()?;

        tx.execute_batch(
            "
            ALTER TABLE tracks ADD COLUMN is_library INTEGER NOT NULL DEFAULT 1;
            CREATE INDEX IF NOT EXISTS idx_tracks_is_library ON tracks(is_library);
            INSERT INTO schema_migrations (version) VALUES (2);
            ",
        )?;

        tx.commit()?;
        log::info!("Database migration 002 applied successfully.");
    }

    Ok(())
}
