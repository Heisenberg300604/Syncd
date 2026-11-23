pub mod migrations;
pub mod playlist_db;
pub mod user_db;

pub use playlist_db::*;
pub use user_db::*;

use crate::library::scanner::ScannedTrack;
use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use sha2::Digest;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexedFolder {
    pub id: String,
    pub path: String,
    pub date_added: String,
    pub last_scanned: Option<String>,
    pub track_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackRow {
    pub id: String,
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub album_artist: Option<String>,
    pub duration_seconds: f64,
    pub track_number: Option<u32>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub format: String,
    pub bitrate_kbps: Option<u32>,
    pub has_artwork: bool,
    pub artwork_hash: Option<String>,
}

#[derive(Error, Debug)]
pub enum DatabaseError {
    #[error("SQLite Error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("IO Error: {0}")]
    Io(#[from] std::io::Error),
}

pub struct Database {
    conn: Connection,
    path: PathBuf,
}

impl Database {
    pub fn init(db_path: &Path) -> std::result::Result<Self, DatabaseError> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut conn = Connection::open(db_path)?;

        // Configure high-performance SQLite PRAGMAs with zero-copy memory-mapped I/O
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA busy_timeout = 5000;
            PRAGMA foreign_keys = ON;
            PRAGMA temp_store = MEMORY;
            PRAGMA mmap_size = 268435456;
            PRAGMA cache_size = -64000;
            ",
        )?;

        // Run migrations
        migrations::run_migrations(&mut conn)?;

        // Self-heal: ensure existing folders that already have indexed tracks don't stay with NULL last_scanned
        let _ = conn.execute(
            "UPDATE indexed_folders 
             SET last_scanned = datetime('now')
             WHERE last_scanned IS NULL AND (SELECT COUNT(*) FROM tracks) > 0;",
            [],
        );

        // Self-heal: ensure tracks not inside indexed folders are marked as playlist-only (is_library = 0)
        let _ = conn.execute_batch(
            "UPDATE tracks SET is_library = 0
             WHERE id NOT IN (
                 SELECT t.id FROM tracks t
                 JOIN indexed_folders f ON (
                     t.path LIKE f.path || '%' 
                     OR t.path LIKE REPLACE(f.path, '/', '\\') || '%'
                     OR t.path LIKE REPLACE(f.path, '\\', '/') || '%'
                 )
             );",
        );

        log::info!("SQLite database initialized at: {}", db_path.display());

        Ok(Self {
            conn,
            path: db_path.to_path_buf(),
        })
    }

    pub fn conn(&mut self) -> &mut Connection {
        &mut self.conn
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn get_library_counts(&self) -> Result<(i64, i64, i64, i64)> {
        let track_count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM tracks WHERE is_library = 1;",
            [],
            |r| r.get(0),
        )?;
        let album_count: i64 = self.conn.query_row(
            "SELECT COUNT(DISTINCT album) FROM tracks WHERE is_library = 1 AND album != '';",
            [],
            |r| r.get(0),
        )?;
        let artist_count: i64 = self.conn.query_row(
            "SELECT COUNT(DISTINCT artist) FROM tracks WHERE is_library = 1 AND artist != '';",
            [],
            |r| r.get(0),
        )?;
        let folder_count: i64 =
            self.conn
                .query_row("SELECT COUNT(*) FROM indexed_folders;", [], |r| r.get(0))?;

        Ok((track_count, album_count, artist_count, folder_count))
    }

    pub fn add_indexed_folder(&mut self, path: &str) -> Result<IndexedFolder> {
        let id = format!(
            "folder_{}",
            sha2::Sha256::digest(path.as_bytes())[..8]
                .iter()
                .map(|b| format!("{:02x}", b))
                .collect::<String>()
        );

        self.conn.execute(
            "INSERT INTO indexed_folders (id, path) VALUES (?1, ?2)
             ON CONFLICT(path) DO UPDATE SET date_added = datetime('now');",
            [&id, path],
        )?;

        let folder = self.conn.query_row(
            "SELECT id, path, date_added, last_scanned, track_count FROM indexed_folders WHERE path = ?1;",
            [path],
            |r| {
                Ok(IndexedFolder {
                    id: r.get(0)?,
                    path: r.get(1)?,
                    date_added: r.get(2)?,
                    last_scanned: r.get(3)?,
                    track_count: r.get(4)?,
                })
            },
        )?;

        Ok(folder)
    }

    pub fn get_indexed_folders(&self) -> Result<Vec<IndexedFolder>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, date_added, last_scanned, track_count FROM indexed_folders ORDER BY date_added DESC;"
        )?;

        let folders = stmt
            .query_map([], |r| {
                Ok(IndexedFolder {
                    id: r.get(0)?,
                    path: r.get(1)?,
                    date_added: r.get(2)?,
                    last_scanned: r.get(3)?,
                    track_count: r.get(4)?,
                })
            })?
            .filter_map(Result::ok)
            .collect();

        Ok(folders)
    }

    pub fn update_folder_scan_status(&mut self, path: &str) -> Result<()> {
        let path_slash = path.replace('\\', "/");
        let path_backslash = path.replace('/', "\\");

        let count: i64 = self
            .conn
            .query_row(
                "SELECT COUNT(*) FROM tracks WHERE path LIKE ?1 || '%' OR path LIKE ?2 || '%';",
                [&path_slash, &path_backslash],
                |r| r.get(0),
            )
            .unwrap_or(0);

        self.conn.execute(
            "UPDATE indexed_folders SET last_scanned = datetime('now'), track_count = ?1 WHERE path = ?2;",
            rusqlite::params![count, path],
        )?;

        Ok(())
    }

    pub fn remove_indexed_folder(&mut self, id: &str) -> Result<Vec<String>> {
        let folder_path: Option<String> = self
            .conn
            .query_row(
                "SELECT path FROM indexed_folders WHERE id = ?1 OR path = ?1;",
                [id],
                |r| r.get(0),
            )
            .ok();

        let mut deleted_artwork_hashes = Vec::new();

        if let Some(prefix) = folder_path {
            let tx = self.conn.transaction()?;

            let prefix_slash = prefix.replace('\\', "/");
            let prefix_backslash = prefix.replace('/', "\\");

            // Collect artwork hashes for tracks belonging to this folder
            {
                let mut stmt = tx.prepare(
                    "SELECT DISTINCT artwork_hash FROM tracks 
                     WHERE (path LIKE ?1 || '%' OR path LIKE ?2 || '%') 
                     AND artwork_hash IS NOT NULL;",
                )?;
                let rows = stmt.query_map([&prefix_slash, &prefix_backslash], |r| {
                    r.get::<_, String>(0)
                })?;
                for hash in rows.flatten() {
                    deleted_artwork_hashes.push(hash);
                }
            }

            // Delete associated tracks
            tx.execute(
                "DELETE FROM tracks WHERE path LIKE ?1 || '%' OR path LIKE ?2 || '%';",
                [&prefix_slash, &prefix_backslash],
            )?;
            // Delete from FTS
            tx.execute(
                "DELETE FROM tracks_fts WHERE track_id NOT IN (SELECT id FROM tracks);",
                [],
            )?;
            // Delete folder record
            tx.execute(
                "DELETE FROM indexed_folders WHERE id = ?1 OR path = ?1;",
                [id],
            )?;

            // If no indexed folders remain, purge any leftover tracks
            let remaining_folders: i64 = tx
                .query_row("SELECT COUNT(*) FROM indexed_folders;", [], |r| r.get(0))
                .unwrap_or(0);

            if remaining_folders == 0 {
                tx.execute("DELETE FROM tracks;", [])?;
                tx.execute("DELETE FROM tracks_fts;", [])?;
            }

            tx.commit()?;
        } else {
            self.conn.execute(
                "DELETE FROM indexed_folders WHERE id = ?1 OR path = ?1;",
                [id],
            )?;
        }

        Ok(deleted_artwork_hashes)
    }

    pub fn get_file_signatures(&self) -> Result<HashMap<PathBuf, (String, u64)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT path, date_modified, file_size_bytes FROM tracks;")?;
        let mut map = HashMap::new();

        let rows = stmt.query_map([], |r| {
            let path_str: String = r.get(0)?;
            let mtime: String = r.get(1)?;
            let size: i64 = r.get(2)?;
            Ok((PathBuf::from(path_str), (mtime, size as u64)))
        })?;

        for item in rows.flatten() {
            map.insert(item.0, item.1);
        }

        Ok(map)
    }

    pub fn batch_upsert_tracks(
        &mut self,
        tracks: &[ScannedTrack],
        is_library: bool,
    ) -> Result<usize> {
        if tracks.is_empty() {
            return Ok(0);
        }

        let tx = self.conn.transaction()?;
        let mut count = 0;

        {
            let mut insert_track = tx.prepare(
                "INSERT INTO tracks (
                    id, path, title, artist, album, album_artist, duration_seconds,
                    track_number, disc_number, year, genre, format, bitrate_kbps,
                    file_size_bytes, has_artwork, date_modified, is_library
                ) VALUES (
                    ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17
                )
                ON CONFLICT(path) DO UPDATE SET
                    title = excluded.title,
                    artist = excluded.artist,
                    album = excluded.album,
                    album_artist = excluded.album_artist,
                    duration_seconds = CASE 
                        WHEN tracks.duration_seconds > 0.0 THEN tracks.duration_seconds 
                        ELSE excluded.duration_seconds 
                    END,
                    track_number = excluded.track_number,
                    disc_number = excluded.disc_number,
                    year = excluded.year,
                    genre = excluded.genre,
                    format = excluded.format,
                    bitrate_kbps = excluded.bitrate_kbps,
                    file_size_bytes = excluded.file_size_bytes,
                    has_artwork = excluded.has_artwork,
                    date_modified = excluded.date_modified,
                    is_library = MAX(tracks.is_library, excluded.is_library);",
            )?;

            let mut insert_fts = tx.prepare(
                "INSERT INTO tracks_fts (track_id, title, artist, album, genre)
                 VALUES (?1, ?2, ?3, ?4, ?5);",
            )?;

            for scanned in tracks {
                let path_str = scanned.path.to_string_lossy().to_string();
                let track_id = format!(
                    "trk_{}",
                    sha2::Sha256::digest(path_str.as_bytes())[..8]
                        .iter()
                        .map(|b| format!("{:02x}", b))
                        .collect::<String>()
                );

                let meta = &scanned.metadata;
                insert_track.execute(rusqlite::params![
                    &track_id,
                    &path_str,
                    &meta.title,
                    &meta.artist,
                    &meta.album,
                    &meta.album_artist,
                    meta.duration_seconds,
                    meta.track_number,
                    meta.disc_number,
                    meta.year,
                    &meta.genre,
                    &meta.format,
                    meta.bitrate_kbps,
                    meta.file_size_bytes as i64,
                    if meta.has_artwork { 1 } else { 0 },
                    &meta.date_modified,
                    if is_library { 1 } else { 0 },
                ])?;

                // Update FTS
                insert_fts.execute(rusqlite::params![
                    &track_id,
                    &meta.title,
                    &meta.artist,
                    &meta.album,
                    meta.genre.as_deref().unwrap_or(""),
                ])?;

                count += 1;
            }
        }

        tx.commit()?;
        Ok(count)
    }

    pub fn get_tracks(
        &self,
        sort_by: &str,
        order: &str,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<TrackRow>> {
        let sort_column = match sort_by {
            "title" => "title",
            "artist" => "artist",
            "album" => "album",
            "duration" => "duration_seconds",
            "year" => "year",
            _ => "title",
        };

        let sort_order = if order.eq_ignore_ascii_case("desc") {
            "DESC"
        } else {
            "ASC"
        };

        let query = format!(
            "SELECT id, path, title, artist, album, album_artist, duration_seconds, track_number, year, genre, format, bitrate_kbps, has_artwork, artwork_hash
             FROM tracks
             WHERE is_library = 1
             ORDER BY {} {}
             LIMIT ?1 OFFSET ?2;",
            sort_column, sort_order
        );

        let mut stmt = self.conn.prepare(&query)?;
        let tracks = stmt
            .query_map([limit, offset], |r| {
                Ok(TrackRow {
                    id: r.get(0)?,
                    path: r.get(1)?,
                    title: r.get(2)?,
                    artist: r.get(3)?,
                    album: r.get(4)?,
                    album_artist: r.get(5)?,
                    duration_seconds: r.get(6)?,
                    track_number: r.get(7)?,
                    year: r.get(8)?,
                    genre: r.get(9)?,
                    format: r.get(10)?,
                    bitrate_kbps: r.get(11)?,
                    has_artwork: r.get::<_, i64>(12)? == 1,
                    artwork_hash: r.get(13)?,
                })
            })?
            .filter_map(Result::ok)
            .collect();

        Ok(tracks)
    }

    pub fn search_tracks_fts(&self, query: &str, limit: u32) -> Result<Vec<TrackRow>> {
        if query.trim().is_empty() {
            return self.get_tracks("title", "asc", limit, 0);
        }

        // Tokenize search query with prefix matching
        let clean_query = query.replace(['"', '\''], "");
        let formatted = clean_query
            .split_whitespace()
            .map(|w| format!("{}*", w))
            .collect::<Vec<_>>()
            .join(" ");

        let sql = "
            SELECT t.id, t.path, t.title, t.artist, t.album, t.album_artist, t.duration_seconds,
                   t.track_number, t.year, t.genre, t.format, t.bitrate_kbps,
                   t.has_artwork, t.artwork_hash
            FROM tracks_fts f
            JOIN tracks t ON t.id = f.track_id
            WHERE tracks_fts MATCH ?1 AND t.is_library = 1
            LIMIT ?2;
        ";

        let mut stmt = self.conn.prepare(sql)?;
        let tracks = stmt
            .query_map(rusqlite::params![&formatted, limit], |r| {
                Ok(TrackRow {
                    id: r.get(0)?,
                    path: r.get(1)?,
                    title: r.get(2)?,
                    artist: r.get(3)?,
                    album: r.get(4)?,
                    album_artist: r.get(5)?,
                    duration_seconds: r.get(6)?,
                    track_number: r.get(7)?,
                    year: r.get(8)?,
                    genre: r.get(9)?,
                    format: r.get(10)?,
                    bitrate_kbps: r.get(11)?,
                    has_artwork: r.get::<_, i64>(12)? == 1,
                    artwork_hash: r.get(13)?,
                })
            })?
            .filter_map(Result::ok)
            .collect();

        Ok(tracks)
    }

    pub fn get_tracks_by_ids(&self, track_ids: &[String]) -> Result<Vec<TrackRow>> {
        if track_ids.is_empty() {
            return Ok(Vec::new());
        }

        let placeholders = track_ids
            .iter()
            .enumerate()
            .map(|(i, _)| format!("?{}", i + 1))
            .collect::<Vec<_>>()
            .join(",");

        let query = format!(
            "SELECT id, path, title, artist, album, album_artist, duration_seconds, track_number, year, genre, format, bitrate_kbps, has_artwork, artwork_hash
             FROM tracks
             WHERE id IN ({});",
            placeholders
        );

        let mut stmt = self.conn.prepare(&query)?;
        let params: Vec<&dyn rusqlite::ToSql> = track_ids
            .iter()
            .map(|id| id as &dyn rusqlite::ToSql)
            .collect();
        let rows = stmt.query_map(params.as_slice(), |r| {
            Ok(TrackRow {
                id: r.get(0)?,
                path: r.get(1)?,
                title: r.get(2)?,
                artist: r.get(3)?,
                album: r.get(4)?,
                album_artist: r.get(5)?,
                duration_seconds: r.get(6)?,
                track_number: r.get(7)?,
                year: r.get(8)?,
                genre: r.get(9)?,
                format: r.get(10)?,
                bitrate_kbps: r.get(11)?,
                has_artwork: r.get::<_, i64>(12)? == 1,
                artwork_hash: r.get(13)?,
            })
        })?;

        let mut map = std::collections::HashMap::new();
        for row in rows.flatten() {
            let mut track = row;
            // Self-heal 0-duration if missing
            if track.duration_seconds <= 0.0 {
                let track_path = std::path::PathBuf::from(&track.path);
                if let Some(dur) = crate::library::metadata::probe_symphonia_duration(&track_path) {
                    if dur > 0.0 {
                        let _ = self.conn.execute(
                            "UPDATE tracks SET duration_seconds = ?1 WHERE id = ?2;",
                            rusqlite::params![dur, &track.id],
                        );
                        track.duration_seconds = dur;
                    }
                }
            }
            map.insert(track.id.clone(), track);
        }

        let mut ordered = Vec::new();
        for id in track_ids {
            if let Some(track) = map.remove(id) {
                ordered.push(track);
            }
        }

        Ok(ordered)
    }

    pub fn get_track_by_id(&self, track_id: &str) -> Result<Option<TrackRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, title, artist, album, album_artist, duration_seconds,
                    track_number, year, genre, format, bitrate_kbps,
                    has_artwork, artwork_hash
             FROM tracks WHERE id = ?1 LIMIT 1;",
        )?;

        let mut rows = stmt.query_map([track_id], |r| {
            Ok(TrackRow {
                id: r.get(0)?,
                path: r.get(1)?,
                title: r.get(2)?,
                artist: r.get(3)?,
                album: r.get(4)?,
                album_artist: r.get(5)?,
                duration_seconds: r.get(6)?,
                track_number: r.get(7)?,
                year: r.get(8)?,
                genre: r.get(9)?,
                format: r.get(10)?,
                bitrate_kbps: r.get(11)?,
                has_artwork: r.get::<_, i64>(12)? == 1,
                artwork_hash: r.get(13)?,
            })
        })?;

        if let Some(res) = rows.next() {
            Ok(Some(res?))
        } else {
            Ok(None)
        }
    }

    pub fn update_track_metadata(
        &mut self,
        track_id: &str,
        meta: &crate::library::metadata::ExtractedMetadata,
        artwork_hash: Option<&str>,
        new_path: Option<&str>,
    ) -> Result<TrackRow> {
        let tx = self.conn.transaction()?;

        if let Some(path) = new_path {
            tx.execute(
                "UPDATE tracks SET path = ?1 WHERE id = ?2;",
                rusqlite::params![path, track_id],
            )?;
        }

        if !meta.has_artwork {
            tx.execute(
                "UPDATE tracks SET
                    title = ?1,
                    artist = ?2,
                    album = ?3,
                    album_artist = ?4,
                    duration_seconds = ?5,
                    track_number = ?6,
                    disc_number = ?7,
                    year = ?8,
                    genre = ?9,
                    format = ?10,
                    bitrate_kbps = ?11,
                    file_size_bytes = ?12,
                    has_artwork = 0,
                    artwork_hash = NULL,
                    date_modified = ?13
                 WHERE id = ?14;",
                rusqlite::params![
                    &meta.title,
                    &meta.artist,
                    &meta.album,
                    &meta.album_artist,
                    meta.duration_seconds,
                    meta.track_number,
                    meta.disc_number,
                    meta.year,
                    &meta.genre,
                    &meta.format,
                    meta.bitrate_kbps,
                    meta.file_size_bytes as i64,
                    &meta.date_modified,
                    track_id,
                ],
            )?;
        } else if let Some(hash) = artwork_hash {
            tx.execute(
                "UPDATE tracks SET
                    title = ?1,
                    artist = ?2,
                    album = ?3,
                    album_artist = ?4,
                    duration_seconds = ?5,
                    track_number = ?6,
                    disc_number = ?7,
                    year = ?8,
                    genre = ?9,
                    format = ?10,
                    bitrate_kbps = ?11,
                    file_size_bytes = ?12,
                    has_artwork = 1,
                    artwork_hash = ?13,
                    date_modified = ?14
                 WHERE id = ?15;",
                rusqlite::params![
                    &meta.title,
                    &meta.artist,
                    &meta.album,
                    &meta.album_artist,
                    meta.duration_seconds,
                    meta.track_number,
                    meta.disc_number,
                    meta.year,
                    &meta.genre,
                    &meta.format,
                    meta.bitrate_kbps,
                    meta.file_size_bytes as i64,
                    hash,
                    &meta.date_modified,
                    track_id,
                ],
            )?;
        } else {
            tx.execute(
                "UPDATE tracks SET
                    title = ?1,
                    artist = ?2,
                    album = ?3,
                    album_artist = ?4,
                    duration_seconds = ?5,
                    track_number = ?6,
                    disc_number = ?7,
                    year = ?8,
                    genre = ?9,
                    format = ?10,
                    bitrate_kbps = ?11,
                    file_size_bytes = ?12,
                    has_artwork = ?13,
                    date_modified = ?14
                 WHERE id = ?15;",
                rusqlite::params![
                    &meta.title,
                    &meta.artist,
                    &meta.album,
                    &meta.album_artist,
                    meta.duration_seconds,
                    meta.track_number,
                    meta.disc_number,
                    meta.year,
                    &meta.genre,
                    &meta.format,
                    meta.bitrate_kbps,
                    meta.file_size_bytes as i64,
                    if meta.has_artwork { 1 } else { 0 },
                    &meta.date_modified,
                    track_id,
                ],
            )?;
        }

        // Sync FTS5 index
        let _ = tx.execute("DELETE FROM tracks_fts WHERE track_id = ?1;", [track_id]);
        tx.execute(
            "INSERT INTO tracks_fts (track_id, title, artist, album, genre)
             VALUES (?1, ?2, ?3, ?4, ?5);",
            rusqlite::params![
                track_id,
                &meta.title,
                &meta.artist,
                &meta.album,
                meta.genre.as_deref().unwrap_or(""),
            ],
        )?;

        let updated_row: TrackRow = tx.query_row(
            "SELECT id, path, title, artist, album, album_artist, duration_seconds,
                    track_number, year, genre, format, bitrate_kbps,
                    has_artwork, artwork_hash
             FROM tracks WHERE id = ?1;",
            [track_id],
            |r| {
                Ok(TrackRow {
                    id: r.get(0)?,
                    path: r.get(1)?,
                    title: r.get(2)?,
                    artist: r.get(3)?,
                    album: r.get(4)?,
                    album_artist: r.get(5)?,
                    duration_seconds: r.get(6)?,
                    track_number: r.get(7)?,
                    year: r.get(8)?,
                    genre: r.get(9)?,
                    format: r.get(10)?,
                    bitrate_kbps: r.get(11)?,
                    has_artwork: r.get::<_, i64>(12)? == 1,
                    artwork_hash: r.get(13)?,
                })
            },
        )?;

        tx.commit()?;
        Ok(updated_row)
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT value FROM settings WHERE key = ?1;")?;
        let mut rows = stmt.query([key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now');",
            [key, value],
        )?;
        Ok(())
    }

    pub fn get_all_settings(&self) -> Result<std::collections::HashMap<String, String>> {
        let mut stmt = self.conn.prepare("SELECT key, value FROM settings;")?;
        let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?;
        let mut map = std::collections::HashMap::new();
        for row in rows {
            let (k, v): (String, String) = row?;
            map.insert(k, v);
        }
        Ok(map)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_initialization_and_migrations() {
        let mut conn = Connection::open_in_memory().expect("open in-memory db");
        migrations::run_migrations(&mut conn).expect("run migrations");

        // Verify schema_migrations table
        let version: i64 = conn
            .query_row(
                "SELECT version FROM schema_migrations WHERE version = 1;",
                [],
                |r| r.get(0),
            )
            .expect("query version");
        assert_eq!(version, 1);

        // Verify tracks and FTS5 tables exist
        conn.execute(
            "INSERT INTO tracks (id, path, title, artist, album, duration_seconds, format, file_size_bytes, date_modified)
             VALUES ('track_1', 'C:\\Music\\song.flac', 'Echoes', 'Pink Floyd', 'Meddle', 1410.0, 'flac', 104857600, '2026-11-13T00:00:00Z');",
            [],
        ).expect("insert track");

        conn.execute(
            "INSERT INTO tracks_fts (track_id, title, artist, album, genre)
             VALUES ('track_1', 'Echoes', 'Pink Floyd', 'Meddle', 'Progressive Rock');",
            [],
        )
        .expect("insert fts");

        // Test FTS search
        let match_id: String = conn
            .query_row(
                "SELECT track_id FROM tracks_fts WHERE tracks_fts MATCH 'Echoes*';",
                [],
                |r| r.get(0),
            )
            .expect("fts query");

        assert_eq!(match_id, "track_1");
    }

    #[test]
    fn test_indexed_folder_crud() {
        let conn = Connection::open_in_memory().expect("open db");
        let mut db = Database {
            conn,
            path: PathBuf::from("test.db"),
        };
        migrations::run_migrations(&mut db.conn).expect("migrations");

        // 1. Add folder
        let folder = db
            .add_indexed_folder("C:\\Music\\Jazz")
            .expect("add folder");
        assert_eq!(folder.path, "C:\\Music\\Jazz");
        assert_eq!(folder.track_count, 0);

        // 2. Get folders
        let folders = db.get_indexed_folders().expect("get folders");
        assert_eq!(folders.len(), 1);
        assert_eq!(folders[0].path, "C:\\Music\\Jazz");

        // 3. Remove folder
        db.remove_indexed_folder(&folder.id).expect("remove folder");
        let folders_after = db.get_indexed_folders().expect("get folders after delete");
        assert_eq!(folders_after.len(), 0);
    }

    #[test]
    fn test_batch_upsert_and_search() {
        let conn = Connection::open_in_memory().expect("open db");
        let mut db = Database {
            conn,
            path: PathBuf::from("test.db"),
        };
        migrations::run_migrations(&mut db.conn).expect("migrations");

        use crate::library::metadata::ExtractedMetadata;

        let scanned = vec![
            ScannedTrack {
                path: PathBuf::from("C:\\Music\\Track1.mp3"),
                metadata: ExtractedMetadata {
                    title: "Time".to_string(),
                    artist: "Pink Floyd".to_string(),
                    album: "The Dark Side of the Moon".to_string(),
                    album_artist: Some("Pink Floyd".to_string()),
                    duration_seconds: 425.0,
                    track_number: Some(4),
                    disc_number: Some(1),
                    year: Some(1973),
                    genre: Some("Progressive Rock".to_string()),
                    format: "mp3".to_string(),
                    bitrate_kbps: Some(320),
                    file_size_bytes: 10485760,
                    has_artwork: true,
                    date_modified: "2026-11-13T00:00:00Z".to_string(),
                },
            },
            ScannedTrack {
                path: PathBuf::from("C:\\Music\\Track2.flac"),
                metadata: ExtractedMetadata {
                    title: "Money".to_string(),
                    artist: "Pink Floyd".to_string(),
                    album: "The Dark Side of the Moon".to_string(),
                    album_artist: Some("Pink Floyd".to_string()),
                    duration_seconds: 382.0,
                    track_number: Some(6),
                    disc_number: Some(1),
                    year: Some(1973),
                    genre: Some("Progressive Rock".to_string()),
                    format: "flac".to_string(),
                    bitrate_kbps: Some(950),
                    file_size_bytes: 45000000,
                    has_artwork: true,
                    date_modified: "2026-11-13T00:00:00Z".to_string(),
                },
            },
        ];

        let count = db
            .batch_upsert_tracks(&scanned, true)
            .expect("batch upsert");
        assert_eq!(count, 2);

        // Verify counts
        let (tracks, albums, artists, _) = db.get_library_counts().expect("library counts");
        assert_eq!(tracks, 2);
        assert_eq!(albums, 1);
        assert_eq!(artists, 1);

        // Verify track query
        let rows = db.get_tracks("title", "asc", 10, 0).expect("get tracks");
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].title, "Money");
        assert_eq!(rows[1].title, "Time");

        // Verify FTS search query
        let search_results = db.search_tracks_fts("money", 10).expect("search fts");
        assert_eq!(search_results.len(), 1);
        assert_eq!(search_results[0].title, "Money");
    }
}

pub fn migrate_old_data(
    old_db_path: &Path,
    user_db: &UserDatabase,
    playlist_db: &PlaylistDatabase,
) {
    if !old_db_path.exists() {
        return;
    }

    if let Ok(old_conn) = Connection::open(old_db_path) {
        // Migrate settings from old database
        if let Ok(mut stmt) = old_conn.prepare("SELECT key, value FROM settings;") {
            if let Ok(rows) =
                stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
            {
                for pair in rows.flatten() {
                    let _ = user_db.set_setting(&pair.0, &pair.1);
                }
            }
        }

        // Migrate playlists from old database
        if let Ok(mut stmt) =
            old_conn.prepare("SELECT id, name, description, created_at, updated_at FROM playlists;")
        {
            if let Ok(rows) = stmt.query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, Option<String>>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, String>(4)?,
                ))
            }) {
                for p in rows.flatten() {
                    let _ = playlist_db.conn.execute(
                        "INSERT OR IGNORE INTO playlists (id, name, description, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5);",
                        rusqlite::params![&p.0, &p.1, &p.2, &p.3, &p.4],
                    );
                }
            }
        }

        // Migrate playlist_tracks from old database
        if let Ok(mut stmt) = old_conn
            .prepare("SELECT playlist_id, track_id, position, added_at FROM playlist_tracks;")
        {
            if let Ok(rows) = stmt.query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, i64>(2)?,
                    r.get::<_, String>(3)?,
                ))
            }) {
                for pt in rows.flatten() {
                    let _ = playlist_db.conn.execute(
                        "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?1, ?2, ?3, ?4);",
                        rusqlite::params![&pt.0, &pt.1, pt.2, &pt.3],
                    );
                }
            }
        }
    }
}
