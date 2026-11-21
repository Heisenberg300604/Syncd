use std::collections::HashMap;
use std::path::{Path, PathBuf};
use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserAccount {
    pub id: String,
    pub username: String,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
    pub is_logged_in: bool,
    pub auth_token: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueuedTrackRow {
    pub id: String,
    pub track_id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_seconds: f64,
    pub artwork_url: Option<String>,
    pub source: String,
    pub path: Option<String>,
    pub format: Option<String>,
    pub bitrate_kbps: Option<u32>,
    pub queue_order: i64,
    pub is_current: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueuedTrackInput {
    pub id: Option<String>,
    pub track_id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_seconds: f64,
    pub artwork_url: Option<String>,
    pub source: Option<String>,
    pub path: Option<String>,
    pub format: Option<String>,
    pub bitrate_kbps: Option<u32>,
}

pub struct UserDatabase {
    pub(crate) conn: Connection,
    pub path: PathBuf,
}

impl UserDatabase {
    pub fn init(db_path: &Path) -> Result<Self, rusqlite::Error> {
        if let Some(parent) = db_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let conn = Connection::open(db_path)?;
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA foreign_keys = ON;
             
             CREATE TABLE IF NOT EXISTS settings (
                 key TEXT PRIMARY KEY,
                 value TEXT NOT NULL,
                 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
             );

             CREATE TABLE IF NOT EXISTS user_account (
                 id TEXT PRIMARY KEY,
                 username TEXT NOT NULL,
                 email TEXT,
                 avatar_url TEXT,
                 is_logged_in INTEGER NOT NULL DEFAULT 0,
                 auth_token TEXT,
                 created_at TEXT NOT NULL DEFAULT (datetime('now')),
                 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
             );

             CREATE TABLE IF NOT EXISTS playback_queue (
                 id TEXT PRIMARY KEY,
                 track_id TEXT NOT NULL,
                 title TEXT NOT NULL,
                 artist TEXT NOT NULL,
                 album TEXT NOT NULL,
                 duration_seconds REAL NOT NULL,
                 artwork_url TEXT,
                 source TEXT NOT NULL DEFAULT 'local',
                 path TEXT,
                 format TEXT,
                 bitrate_kbps INTEGER,
                 queue_order INTEGER NOT NULL,
                 is_current INTEGER NOT NULL DEFAULT 0,
                 created_at TEXT NOT NULL DEFAULT (datetime('now'))
             );

             CREATE INDEX IF NOT EXISTS idx_playback_queue_order ON playback_queue(queue_order);"
        )?;

        Ok(Self {
            conn,
            path: db_path.to_path_buf(),
        })
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        self.conn
            .query_row("SELECT value FROM settings WHERE key = ?1;", [key], |r| r.get(0))
            .map(Some)
            .or_else(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Ok(None),
                _ => Err(e),
            })
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;",
            [key, value],
        )?;
        Ok(())
    }

    pub fn get_all_settings(&self) -> Result<HashMap<String, String>> {
        let mut stmt = self.conn.prepare("SELECT key, value FROM settings;")?;
        let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?;
        let mut map = HashMap::new();
        for r in rows.flatten() {
            map.insert(r.0, r.1);
        }
        Ok(map)
    }

    pub fn get_user_account(&self) -> Result<UserAccount> {
        self.conn.query_row(
            "SELECT id, username, email, avatar_url, is_logged_in, auth_token, created_at, updated_at 
             FROM user_account ORDER BY updated_at DESC LIMIT 1;",
            [],
            |r| {
                Ok(UserAccount {
                    id: r.get(0)?,
                    username: r.get(1)?,
                    email: r.get(2)?,
                    avatar_url: r.get(3)?,
                    is_logged_in: r.get::<_, i64>(4)? == 1,
                    auth_token: r.get(5)?,
                    created_at: r.get(6)?,
                    updated_at: r.get(7)?,
                })
            },
        ).or_else(|_| {
            Ok(UserAccount {
                id: "guest".to_string(),
                username: "Guest User".to_string(),
                email: None,
                avatar_url: None,
                is_logged_in: false,
                auth_token: None,
                created_at: "".to_string(),
                updated_at: "".to_string(),
            })
        })
    }

    pub fn set_user_account(&self, account: &UserAccount) -> Result<()> {
        self.conn.execute(
            "INSERT INTO user_account (id, username, email, avatar_url, is_logged_in, auth_token, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
                username = excluded.username,
                email = excluded.email,
                avatar_url = excluded.avatar_url,
                is_logged_in = excluded.is_logged_in,
                auth_token = excluded.auth_token,
                updated_at = excluded.updated_at;",
            rusqlite::params![
                &account.id,
                &account.username,
                &account.email,
                &account.avatar_url,
                if account.is_logged_in { 1 } else { 0 },
                &account.auth_token,
            ],
        )?;
        Ok(())
    }

    pub fn get_playback_queue(&self) -> Result<Vec<QueuedTrackRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, track_id, title, artist, album, duration_seconds, 
                    artwork_url, source, path, format, bitrate_kbps, 
                    queue_order, is_current, created_at 
             FROM playback_queue 
             ORDER BY queue_order ASC, created_at ASC;"
        )?;

        let rows = stmt.query_map([], |r| {
            Ok(QueuedTrackRow {
                id: r.get(0)?,
                track_id: r.get(1)?,
                title: r.get(2)?,
                artist: r.get(3)?,
                album: r.get(4)?,
                duration_seconds: r.get(5)?,
                artwork_url: r.get(6)?,
                source: r.get(7)?,
                path: r.get(8)?,
                format: r.get(9)?,
                bitrate_kbps: r.get(10)?,
                queue_order: r.get(11)?,
                is_current: r.get::<_, i64>(12)? == 1,
                created_at: r.get(13)?,
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }

    pub fn add_to_playback_queue(&mut self, tracks: &[QueuedTrackInput]) -> Result<Vec<QueuedTrackRow>> {
        let tx = self.conn.transaction()?;

        let max_order: i64 = tx
            .query_row("SELECT COALESCE(MAX(queue_order), -1) FROM playback_queue;", [], |r| r.get(0))
            .unwrap_or(-1);

        let mut current_order = max_order + 1;

        for (idx, t) in tracks.iter().enumerate() {
            let entry_id = t.id.clone().unwrap_or_else(|| {
                let now_ms = chrono::Utc::now().timestamp_millis();
                format!("q_{}_{}_{}", t.track_id, now_ms, idx)
            });
            let src = t.source.as_deref().unwrap_or("local");

            tx.execute(
                "INSERT INTO playback_queue (
                    id, track_id, title, artist, album, duration_seconds,
                    artwork_url, source, path, format, bitrate_kbps,
                    queue_order, is_current
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 0);",
                rusqlite::params![
                    &entry_id,
                    &t.track_id,
                    &t.title,
                    &t.artist,
                    &t.album,
                    t.duration_seconds,
                    &t.artwork_url,
                    src,
                    &t.path,
                    &t.format,
                    t.bitrate_kbps,
                    current_order,
                ],
            )?;

            current_order += 1;
        }

        tx.commit()?;
        self.get_playback_queue()
    }

    pub fn set_current_track_in_queue(&self, track_id_or_entry_id: &str) -> Result<()> {
        self.conn.execute("UPDATE playback_queue SET is_current = 0;", [])?;
        self.conn.execute(
            "UPDATE playback_queue SET is_current = 1 WHERE id = ?1 OR track_id = ?1;",
            [track_id_or_entry_id],
        )?;
        Ok(())
    }

    pub fn remove_from_playback_queue(&self, id_or_track_id: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM playback_queue WHERE id = ?1 OR track_id = ?1;",
            [id_or_track_id],
        )?;
        Ok(())
    }

    pub fn clear_playback_queue(&self) -> Result<()> {
        self.conn.execute("DELETE FROM playback_queue;", [])?;
        Ok(())
    }

    pub fn save_playback_queue(
        &mut self,
        tracks: &[QueuedTrackInput],
        current_track_id: Option<&str>,
    ) -> Result<Vec<QueuedTrackRow>> {
        let tx = self.conn.transaction()?;
        tx.execute("DELETE FROM playback_queue;", [])?;

        for (idx, t) in tracks.iter().enumerate() {
            let entry_id = t.id.clone().unwrap_or_else(|| {
                let now_ms = chrono::Utc::now().timestamp_millis();
                format!("q_{}_{}_{}", t.track_id, now_ms, idx)
            });
            let src = t.source.as_deref().unwrap_or("local");
            let is_curr = current_track_id.map_or(0, |cid| {
                if cid == t.track_id || cid == entry_id { 1 } else { 0 }
            });

            tx.execute(
                "INSERT INTO playback_queue (
                    id, track_id, title, artist, album, duration_seconds,
                    artwork_url, source, path, format, bitrate_kbps,
                    queue_order, is_current
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13);",
                rusqlite::params![
                    &entry_id,
                    &t.track_id,
                    &t.title,
                    &t.artist,
                    &t.album,
                    t.duration_seconds,
                    &t.artwork_url,
                    src,
                    &t.path,
                    &t.format,
                    t.bitrate_kbps,
                    idx as i64,
                    is_curr,
                ],
            )?;
        }

        tx.commit()?;
        self.get_playback_queue()
    }
}
