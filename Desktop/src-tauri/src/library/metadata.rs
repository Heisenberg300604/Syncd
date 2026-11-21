use std::path::Path;
use std::fs;
use serde::{Deserialize, Serialize};
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::probe::Probe;
use lofty::tag::Accessor;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractedMetadata {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub album_artist: Option<String>,
    pub duration_seconds: f64,
    pub track_number: Option<u32>,
    pub disc_number: Option<u32>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub format: String,
    pub bitrate_kbps: Option<u32>,
    pub file_size_bytes: u64,
    pub has_artwork: bool,
    pub date_modified: String,
}

pub fn extract_metadata(path: &Path) -> Result<ExtractedMetadata, String> {
    let file_metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    let file_size_bytes = file_metadata.len();
    let date_modified = file_metadata
        .modified()
        .map(|m| {
            let dt: chrono::DateTime<chrono::Utc> = m.into();
            dt.to_rfc3339()
        })
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string());

    let file_stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown Title")
        .to_string();

    let format = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("unknown")
        .to_lowercase();

    // Probe audio file with lofty
    let tagged_file = match Probe::open(path).and_then(|p| p.read()) {
        Ok(f) => f,
        Err(_) => {
            // Graceful fallback for files with corrupt or stripped ID3 tags
            return Ok(ExtractedMetadata {
                title: file_stem,
                artist: "Unknown Artist".to_string(),
                album: "Unknown Album".to_string(),
                album_artist: None,
                duration_seconds: 0.0,
                track_number: None,
                disc_number: None,
                year: None,
                genre: None,
                format,
                bitrate_kbps: None,
                file_size_bytes,
                has_artwork: false,
                date_modified,
            });
        }
    };

    let properties = tagged_file.properties();
    let duration_seconds = properties.duration().as_secs_f64();
    let bitrate_kbps = properties.audio_bitrate();

    let primary_tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());

    let title = primary_tag
        .and_then(|t| t.title().as_deref().map(str::to_string))
        .filter(|s| !s.trim().is_empty())
        .unwrap_or(file_stem);

    let artist = primary_tag
        .and_then(|t| t.artist().as_deref().map(str::to_string))
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "Unknown Artist".to_string());

    let album = primary_tag
        .and_then(|t| t.album().as_deref().map(str::to_string))
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "Unknown Album".to_string());

    let genre = primary_tag
        .and_then(|t| t.genre().as_deref().map(str::to_string))
        .filter(|s| !s.trim().is_empty());

    let track_number = primary_tag.and_then(|t| t.track());
    let disc_number = primary_tag.and_then(|t| t.disk());
    let year = primary_tag.and_then(|t| t.year());

    let has_artwork = primary_tag
        .map(|t| !t.pictures().is_empty())
        .unwrap_or(false);

    Ok(ExtractedMetadata {
        title,
        artist,
        album,
        album_artist: None,
        duration_seconds,
        track_number,
        disc_number,
        year,
        genre,
        format,
        bitrate_kbps,
        file_size_bytes,
        has_artwork,
        date_modified,
    })
}
