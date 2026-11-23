use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use sha2::Digest;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistRow {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub cover_url: Option<String>,
    pub import_folder_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub track_count: i64,
}

pub struct PlaylistDatabase {
    pub(crate) conn: Connection,
    pub path: PathBuf,
}

impl PlaylistDatabase {
    pub fn init(db_path: &Path) -> Result<Self, rusqlite::Error> {
        if let Some(parent) = db_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let conn = Connection::open(db_path)?;
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA foreign_keys = ON;

             CREATE TABLE IF NOT EXISTS playlists (
                 id TEXT PRIMARY KEY,
                 name TEXT NOT NULL,
                 description TEXT,
                 created_at TEXT NOT NULL DEFAULT (datetime('now')),
                 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
             );

             CREATE TABLE IF NOT EXISTS playlist_tracks (
                 playlist_id TEXT NOT NULL,
                 track_id TEXT NOT NULL,
                 position INTEGER NOT NULL,
                 added_at TEXT NOT NULL DEFAULT (datetime('now')),
                 PRIMARY KEY (playlist_id, track_id),
                 FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
             );

             CREATE INDEX IF NOT EXISTS idx_playlist_tracks_pos ON playlist_tracks(playlist_id, position);"
        )?;

        // Ensure cover_url and import_folder_path columns exist
        let _ = conn.execute("ALTER TABLE playlists ADD COLUMN cover_url TEXT;", []);
        let _ = conn.execute("ALTER TABLE playlists ADD COLUMN import_folder_path TEXT;", []);

        Ok(Self {
            conn,
            path: db_path.to_path_buf(),
        })
    }

    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    pub fn get_playlists(&self) -> Result<Vec<PlaylistRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT p.id, p.name, p.description, p.cover_url, p.import_folder_path, p.created_at, p.updated_at, COUNT(pt.track_id) as cnt
             FROM playlists p
             LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
             GROUP BY p.id
             ORDER BY p.updated_at DESC;"
        )?;

        let rows = stmt.query_map([], |r| {
            Ok(PlaylistRow {
                id: r.get(0)?,
                name: r.get(1)?,
                description: r.get(2)?,
                cover_url: r.get(3)?,
                import_folder_path: r.get(4)?,
                created_at: r.get(5)?,
                updated_at: r.get(6)?,
                track_count: r.get(7)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows.flatten() {
            list.push(r);
        }
        Ok(list)
    }

    pub fn create_playlist(
        &self,
        name: &str,
        description: Option<&str>,
        cover_url: Option<&str>,
        import_folder_path: Option<&str>,
    ) -> Result<PlaylistRow> {
        let id = format!(
            "pl_{}",
            sha2::Sha256::digest(
                format!(
                    "{}{}",
                    name,
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis()
                )
                .as_bytes()
            )[..8]
                .iter()
                .map(|b| format!("{:02x}", b))
                .collect::<String>()
        );

        self.conn.execute(
            "INSERT INTO playlists (id, name, description, cover_url, import_folder_path, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'), datetime('now'));",
            rusqlite::params![&id, name, description, cover_url, import_folder_path],
        )?;

        let row = self.conn.query_row(
            "SELECT id, name, description, cover_url, import_folder_path, created_at, updated_at FROM playlists WHERE id = ?1;",
            [&id],
            |r| {
                Ok(PlaylistRow {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    description: r.get(2)?,
                    cover_url: r.get(3)?,
                    import_folder_path: r.get(4)?,
                    created_at: r.get(5)?,
                    updated_at: r.get(6)?,
                    track_count: 0,
                })
            },
        )?;

        Ok(row)
    }

    pub fn update_playlist(&self, id: &str, name: &str, description: Option<&str>, cover_url: Option<&str>) -> Result<()> {
        self.conn.execute(
            "UPDATE playlists SET name = ?1, description = ?2, cover_url = ?3, updated_at = datetime('now') WHERE id = ?4;",
            rusqlite::params![name, description, cover_url, id],
        )?;
        Ok(())
    }

    pub fn update_playlist_cover(&self, id: &str, cover_url: Option<&str>) -> Result<()> {
        self.conn.execute(
            "UPDATE playlists SET cover_url = ?1, updated_at = datetime('now') WHERE id = ?2;",
            rusqlite::params![cover_url, id],
        )?;
        Ok(())
    }

    pub fn delete_playlist(&self, id: &str) -> Result<()> {
        self.conn
            .execute("DELETE FROM playlist_tracks WHERE playlist_id = ?1;", [id])?;
        self.conn
            .execute("DELETE FROM playlists WHERE id = ?1;", [id])?;
        Ok(())
    }

    pub fn rename_playlist(&self, id: &str, name: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE playlists SET name = ?1, updated_at = datetime('now') WHERE id = ?2;",
            [name, id],
        )?;
        Ok(())
    }

    pub fn add_track_to_playlist(&self, playlist_id: &str, track_id: &str) -> Result<bool> {
        let max_pos: i64 = self
            .conn
            .query_row(
                "SELECT COALESCE(MAX(position), 0) FROM playlist_tracks WHERE playlist_id = ?1;",
                [playlist_id],
                |r| r.get(0),
            )
            .unwrap_or(0);

        let rows_affected = self.conn.execute(
            "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position, added_at)
             VALUES (?1, ?2, ?3, datetime('now'));",
            rusqlite::params![playlist_id, track_id, max_pos + 1],
        )?;

        if rows_affected > 0 {
            let _ = self.conn.execute(
                "UPDATE playlists SET updated_at = datetime('now') WHERE id = ?1;",
                [playlist_id],
            );
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub fn add_tracks_to_playlist(&mut self, playlist_id: &str, track_ids: &[String]) -> Result<usize> {
        if track_ids.is_empty() {
            return Ok(0);
        }

        let max_pos: i64 = self
            .conn
            .query_row(
                "SELECT COALESCE(MAX(position), 0) FROM playlist_tracks WHERE playlist_id = ?1;",
                [playlist_id],
                |r| r.get(0),
            )
            .unwrap_or(0);

        let tx = self.conn.transaction()?;
        let mut added = 0;
        {
            let mut stmt = tx.prepare(
                "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position, added_at)
                 VALUES (?1, ?2, ?3, datetime('now'));",
            )?;

            for (i, tid) in track_ids.iter().enumerate() {
                let affected = stmt.execute(rusqlite::params![playlist_id, tid, max_pos + 1 + i as i64])?;
                if affected > 0 {
                    added += 1;
                }
            }
        }

        if added > 0 {
            let _ = tx.execute(
                "UPDATE playlists SET updated_at = datetime('now') WHERE id = ?1;",
                [playlist_id],
            );
        }

        tx.commit()?;
        Ok(added)
    }

    pub fn remove_track_from_playlist(&self, playlist_id: &str, track_id: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2;",
            [playlist_id, track_id],
        )?;
        let _ = self.conn.execute(
            "UPDATE playlists SET updated_at = datetime('now') WHERE id = ?1;",
            [playlist_id],
        );
        Ok(())
    }

    pub fn get_playlist_tracks(&self, playlist_id: &str) -> Result<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT track_id FROM playlist_tracks WHERE playlist_id = ?1 ORDER BY position ASC;",
        )?;
        let rows = stmt.query_map([playlist_id], |r| r.get::<_, String>(0))?;
        let mut tracks = Vec::new();
        for t in rows.flatten() {
            tracks.push(t);
        }
        Ok(tracks)
    }
}
