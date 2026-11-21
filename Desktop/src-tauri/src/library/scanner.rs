use crate::library::metadata::{extract_metadata, ExtractedMetadata};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use walkdir::WalkDir;

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "wav", "m4a", "aac", "ogg", "opus", "alac", "aiff",
];

fn normalize_key(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/").to_lowercase()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub indexed: usize,
    pub total: usize,
    pub current_file: String,
}

#[derive(Debug, Clone)]
pub struct ScannedTrack {
    pub path: PathBuf,
    pub metadata: ExtractedMetadata,
}

pub struct LibraryScanner {
    cancel_flag: Arc<AtomicBool>,
}

impl Default for LibraryScanner {
    fn default() -> Self {
        Self::new()
    }
}

impl LibraryScanner {
    pub fn new() -> Self {
        Self {
            cancel_flag: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn cancel(&self) {
        self.cancel_flag.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancel_flag.load(Ordering::SeqCst)
    }

    pub fn scan_directories<F>(
        &self,
        directories: &[PathBuf],
        existing_signatures: &std::collections::HashMap<PathBuf, (String, u64)>,
        mut on_progress: F,
    ) -> Result<Vec<ScannedTrack>, String>
    where
        F: FnMut(ScanProgress),
    {
        self.cancel_flag.store(false, Ordering::SeqCst);

        // Pre-normalize existing signatures for instant O(1) matching on Windows
        let signature_map: std::collections::HashMap<String, &(String, u64)> = existing_signatures
            .iter()
            .map(|(p, sig)| (normalize_key(p), sig))
            .collect();

        // 1. Discover all supported audio files
        let mut audio_paths: Vec<PathBuf> = Vec::new();

        for dir in directories {
            if self.is_cancelled() {
                return Ok(Vec::new());
            }

            if !dir.exists() || !dir.is_dir() {
                continue;
            }

            for entry in WalkDir::new(dir)
                .follow_links(true)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                if self.is_cancelled() {
                    return Ok(Vec::new());
                }

                let path = entry.path();
                if path.is_file() {
                    if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                        if SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                            audio_paths.push(path.to_path_buf());
                        }
                    }
                }
            }
        }

        let total = audio_paths.len();
        let mut results = Vec::with_capacity(total);
        let mut last_emit = Instant::now();

        // 2. Process files incrementally
        for (idx, path) in audio_paths.into_iter().enumerate() {
            if self.is_cancelled() {
                log::info!("Library scan cancelled by user at {}/{}", idx, total);
                break;
            }

            let norm_path = normalize_key(&path);

            // Check if file is already indexed and unmodified
            if let Ok(meta) = std::fs::metadata(&path) {
                let size = meta.len();
                let mtime = meta
                    .modified()
                    .map(|m| {
                        let dt: chrono::DateTime<chrono::Utc> = m.into();
                        dt.to_rfc3339()
                    })
                    .unwrap_or_default();

                if let Some((existing_mtime, existing_size)) = signature_map.get(&norm_path) {
                    if *existing_size == size && existing_mtime.as_str() == mtime {
                        // Unchanged file: skip decoding completely
                        continue;
                    }
                }
            }

            let file_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or_default()
                .to_string();

            // Throttle UI events to at most once every 60ms (or on boundary files) to prevent flooding IPC
            let is_boundary = idx == 0 || idx + 1 == total;
            if is_boundary || last_emit.elapsed().as_millis() >= 60 {
                on_progress(ScanProgress {
                    indexed: idx + 1,
                    total,
                    current_file: file_name,
                });
                last_emit = Instant::now();
            }

            match extract_metadata(&path) {
                Ok(metadata) => {
                    results.push(ScannedTrack { path, metadata });
                }
                Err(err) => {
                    log::warn!("Failed to read metadata for {}: {}", path.display(), err);
                }
            }
        }

        Ok(results)
    }
}
