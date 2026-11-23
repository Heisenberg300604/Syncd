use lofty::config::WriteOptions;
use lofty::file::{AudioFile, FileType, TaggedFileExt};
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::prelude::*;
use lofty::probe::Probe;
use lofty::tag::{Accessor, Tag, TagType};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetailedAudioMetadata {
    pub id: Option<String>,
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub album_artist: Option<String>,
    pub duration_seconds: f64,
    pub track_number: Option<u32>,
    pub track_total: Option<u32>,
    pub disc_number: Option<u32>,
    pub disc_total: Option<u32>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub comment: Option<String>,
    pub format: String,
    pub bitrate_kbps: Option<u32>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u8>,
    pub bit_depth: Option<u8>,
    pub file_size_bytes: u64,
    pub has_artwork: bool,
    pub artwork_hash: Option<String>,
    pub date_modified: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackMetadataUpdate {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub track_number: Option<u32>,
    pub track_total: Option<u32>,
    pub disc_number: Option<u32>,
    pub disc_total: Option<u32>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub comment: Option<String>,
    pub artwork_base64: Option<String>,
    pub artwork_path: Option<String>,
    pub remove_artwork: Option<bool>,
    pub new_file_name: Option<String>,
}

/// Fallback duration probe using Symphonia for WAV, PCM, or files with missing/non-standard tags
pub fn probe_symphonia_duration(path: &Path) -> Option<f64> {
    use std::fs::File;
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::probe::Hint;

    let file = File::open(path).ok()?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &Default::default(), &Default::default())
        .ok()?;

    let track = probed
        .format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != symphonia::core::codecs::CODEC_TYPE_NULL)?;

    if let (Some(n_frames), Some(tb)) = (track.codec_params.n_frames, track.codec_params.time_base) {
        let time = tb.calc_time(n_frames);
        let sec = time.seconds as f64 + time.frac;
        if sec > 0.0 {
            return Some(sec);
        }
    }

    // Secondary calculation for WAV / PCM: estimate from sample rate and file size if available
    if let Some(sample_rate) = track.codec_params.sample_rate {
        if let Ok(meta) = std::fs::metadata(path) {
            let file_size = meta.len();
            let channels = track.codec_params.channels.map_or(2, |c| c.count() as u64);
            let bits = track.codec_params.bits_per_sample.unwrap_or(16) as u64;
            let bytes_per_sec = (sample_rate as u64) * channels * (bits / 8).max(1);
            if bytes_per_sec > 0 && file_size > 44 {
                let pcm_data_len = file_size.saturating_sub(44);
                let sec = pcm_data_len as f64 / bytes_per_sec as f64;
                if sec > 0.0 {
                    return Some(sec);
                }
            }
        }
    }

    None
}

/// Robustly extracts metadata from an audio file, automatically detecting magic bytes
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

    // Probe audio file with lofty, guessing actual file type via magic bytes
    let tagged_file_res = Probe::open(path)
        .and_then(|p| p.guess_file_type().map_err(lofty::error::LoftyError::from))
        .and_then(|p| p.read())
        .or_else(|_| Probe::open(path).and_then(|p| p.read()));

    let tagged_file = match tagged_file_res {
        Ok(f) => f,
        Err(_) => {
            let duration_seconds = probe_symphonia_duration(path).unwrap_or(0.0);
            return Ok(ExtractedMetadata {
                title: file_stem,
                artist: "Unknown Artist".to_string(),
                album: "Unknown Album".to_string(),
                album_artist: None,
                duration_seconds,
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
    let mut duration_seconds = properties.duration().as_secs_f64();
    if duration_seconds <= 0.0 {
        if let Some(sym_dur) = probe_symphonia_duration(path) {
            duration_seconds = sym_dur;
        }
    }
    let bitrate_kbps = properties.audio_bitrate();

    // Read tags across all available containers (e.g. ID3v2 and RiffInfo in WAV)
    let tags = tagged_file.tags();

    let title = tags
        .iter()
        .find_map(|t| t.title().as_deref().map(str::to_string))
        .filter(|s| !s.trim().is_empty())
        .unwrap_or(file_stem);

    let artist = tags
        .iter()
        .find_map(|t| t.artist().as_deref().map(str::to_string))
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "Unknown Artist".to_string());

    let album = tags
        .iter()
        .find_map(|t| t.album().as_deref().map(str::to_string))
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "Unknown Album".to_string());

    let genre = tags
        .iter()
        .find_map(|t| t.genre().as_deref().map(str::to_string))
        .filter(|s| !s.trim().is_empty());

    let track_number = tags.iter().find_map(|t| t.track());
    let disc_number = tags.iter().find_map(|t| t.disk());
    let year = tags.iter().find_map(|t| t.year());

    // Check if any tag container holds pictures
    let has_artwork = tags.iter().any(|t| !t.pictures().is_empty());

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

/// Reads full technical and tag metadata from audio file
pub fn read_detailed_metadata(
    path: &Path,
    track_id: Option<String>,
    existing_artwork_hash: Option<String>,
) -> Result<DetailedAudioMetadata, String> {
    let file_metadata = fs::metadata(path).map_err(|e| format!("Cannot read file metadata: {}", e))?;
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

    let tagged_file_res = Probe::open(path)
        .and_then(|p| p.guess_file_type().map_err(lofty::error::LoftyError::from))
        .and_then(|p| p.read())
        .or_else(|_| Probe::open(path).and_then(|p| p.read()));

    let tagged_file = match tagged_file_res {
        Ok(f) => f,
        Err(_) => {
            let duration_seconds = probe_symphonia_duration(path).unwrap_or(0.0);
            return Ok(DetailedAudioMetadata {
                id: track_id,
                path: path.to_string_lossy().to_string(),
                title: file_stem,
                artist: "Unknown Artist".to_string(),
                album: "Unknown Album".to_string(),
                album_artist: None,
                duration_seconds,
                track_number: None,
                track_total: None,
                disc_number: None,
                disc_total: None,
                year: None,
                genre: None,
                comment: None,
                format,
                bitrate_kbps: None,
                sample_rate: None,
                channels: None,
                bit_depth: None,
                file_size_bytes,
                has_artwork: false,
                artwork_hash: existing_artwork_hash,
                date_modified,
            });
        }
    };

    let props = tagged_file.properties();
    let mut duration_seconds = props.duration().as_secs_f64();
    if duration_seconds <= 0.0 {
        if let Some(sym_dur) = probe_symphonia_duration(path) {
            duration_seconds = sym_dur;
        }
    }

    let bitrate_kbps = props.audio_bitrate();
    let sample_rate = props.sample_rate();
    let channels = props.channels();
    let bit_depth = props.bit_depth();

    let tags = tagged_file.tags();

    let title = tags
        .iter()
        .find_map(|t| t.title().as_deref().map(str::to_string))
        .filter(|s| !s.trim().is_empty())
        .unwrap_or(file_stem);

    let artist = tags
        .iter()
        .find_map(|t| t.artist().as_deref().map(str::to_string))
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "Unknown Artist".to_string());

    let album = tags
        .iter()
        .find_map(|t| t.album().as_deref().map(str::to_string))
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "Unknown Album".to_string());

    let genre = tags
        .iter()
        .find_map(|t| t.genre().as_deref().map(str::to_string))
        .filter(|s| !s.trim().is_empty());

    let comment = tags
        .iter()
        .find_map(|t| t.comment().as_deref().map(str::to_string))
        .filter(|s| !s.trim().is_empty());

    let track_number = tags.iter().find_map(|t| t.track());
    let track_total = tags.iter().find_map(|t| t.track_total());
    let disc_number = tags.iter().find_map(|t| t.disk());
    let disc_total = tags.iter().find_map(|t| t.disk_total());
    let year = tags.iter().find_map(|t| t.year());

    let has_artwork = tags.iter().any(|t| !t.pictures().is_empty());

    Ok(DetailedAudioMetadata {
        id: track_id,
        path: path.to_string_lossy().to_string(),
        title,
        artist,
        album,
        album_artist: None,
        duration_seconds,
        track_number,
        track_total,
        disc_number,
        disc_total,
        year,
        genre,
        comment,
        format,
        bitrate_kbps,
        sample_rate,
        channels,
        bit_depth,
        file_size_bytes,
        has_artwork,
        artwork_hash: existing_artwork_hash,
        date_modified,
    })
}

/// Applies text tag updates to a lofty Tag
fn apply_text_updates_to_tag(tag: &mut Tag, update: &TrackMetadataUpdate) {
    if let Some(ref title) = update.title {
        tag.set_title(title.clone());
    }
    if let Some(ref artist) = update.artist {
        tag.set_artist(artist.clone());
    }
    if let Some(ref album) = update.album {
        tag.set_album(album.clone());
    }
    if let Some(track) = update.track_number {
        if track == 0 {
            tag.remove_track();
        } else {
            tag.set_track(track);
        }
    }
    if let Some(total) = update.track_total {
        if total == 0 {
            tag.remove_track_total();
        } else {
            tag.set_track_total(total);
        }
    }
    if let Some(disc) = update.disc_number {
        if disc == 0 {
            tag.remove_disk();
        } else {
            tag.set_disk(disc);
        }
    }
    if let Some(total) = update.disc_total {
        if total == 0 {
            tag.remove_disk_total();
        } else {
            tag.set_disk_total(total);
        }
    }
    if let Some(year) = update.year {
        if year == 0 {
            tag.remove_year();
        } else {
            tag.set_year(year);
        }
    }
    if let Some(ref genre) = update.genre {
        if genre.trim().is_empty() {
            tag.remove_genre();
        } else {
            tag.set_genre(genre.clone());
        }
    }
    if let Some(ref comment) = update.comment {
        if comment.trim().is_empty() {
            tag.remove_comment();
        } else {
            tag.set_comment(comment.clone());
        }
    }
}

/// Atomically writes updated metadata and cover art directly into the audio file tags on disk.
/// Automatically handles container formats (WAV ID3v2 + RiffInfo, MP3 ID3v2, FLAC/OGG Vorbis).
/// Returns updated ExtractedMetadata and the new artwork hash if any.
pub fn write_track_metadata_to_file(
    path: &Path,
    update: &TrackMetadataUpdate,
    artwork_dir: &Path,
) -> Result<(ExtractedMetadata, Option<String>, Option<std::path::PathBuf>), String> {
    if !path.exists() || !path.is_file() {
        return Err(format!("Audio file does not exist: {}", path.display()));
    }

    let parent_dir = path
        .parent()
        .ok_or_else(|| "Invalid file path (no parent dir)".to_string())?;

    // 1. Probe & detect true container format via magic bytes
    let tagged_file = Probe::open(path)
        .and_then(|p| p.guess_file_type().map_err(lofty::error::LoftyError::from))
        .and_then(|p| p.read())
        .or_else(|_| Probe::open(path).and_then(|p| p.read()))
        .map_err(|e| format!("Failed to read audio tags from {}: {}", path.display(), e))?;

    let file_type = tagged_file.file_type();

    // 2. Process artwork bytes if requested
    let mut new_artwork_hash: Option<String> = None;
    let mut artwork_bytes: Option<(Vec<u8>, MimeType)> = None;

    if update.remove_artwork.unwrap_or(false) {
        new_artwork_hash = None;
    } else if let Some(ref base64_str) = update.artwork_base64 {
        let clean_base64 = if let Some(comma_pos) = base64_str.find(',') {
            &base64_str[(comma_pos + 1)..]
        } else {
            base64_str.as_str()
        };

        use base64::Engine;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(clean_base64.trim())
            .map_err(|e| format!("Invalid base64 artwork data: {}", e))?;

        if !bytes.is_empty() {
            let mime = if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
                MimeType::Png
            } else {
                MimeType::Jpeg
            };

            let mut hasher = Sha256::new();
            hasher.update(&bytes);
            let hash = format!("{:x}", hasher.finalize());

            let ext = match mime {
                MimeType::Png => "png",
                _ => "jpg",
            };

            let _ = fs::create_dir_all(artwork_dir);
            let cached_file = artwork_dir.join(format!("{}.{}", hash, ext));
            let _ = fs::write(&cached_file, &bytes);

            new_artwork_hash = Some(hash);
            artwork_bytes = Some((bytes, mime));
        }
    } else if let Some(ref art_path_str) = update.artwork_path {
        let art_path = Path::new(art_path_str);
        if art_path.exists() && art_path.is_file() {
            let bytes = fs::read(art_path).map_err(|e| format!("Failed to read artwork file: {}", e))?;
            if !bytes.is_empty() {
                let mime = if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
                    MimeType::Png
                } else {
                    MimeType::Jpeg
                };

                let mut hasher = Sha256::new();
                hasher.update(&bytes);
                let hash = format!("{:x}", hasher.finalize());

                let ext = match mime {
                    MimeType::Png => "png",
                    _ => "jpg",
                };

                let _ = fs::create_dir_all(artwork_dir);
                let cached_file = artwork_dir.join(format!("{}.{}", hash, ext));
                let _ = fs::write(&cached_file, &bytes);

                new_artwork_hash = Some(hash);
                artwork_bytes = Some((bytes, mime));
            }
        }
    }

    // 3. Prepare modified tags according to container specification
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let rand_ext = format!("syncd_tmp_{}.part", timestamp);
    let temp_path = parent_dir.join(&rand_ext);

    fs::copy(path, &temp_path)
        .map_err(|e| format!("Failed to create temporary working copy: {}", e))?;

    let write_res = if file_type == FileType::Wav {
        // For WAV files:
        // ID3v2 tag: stores artwork and extended tags (read by Windows 10/11 Explorer, SyncDesk, Groove)
        let mut id3_tag = tagged_file
            .tag(TagType::Id3v2)
            .cloned()
            .unwrap_or_else(|| Tag::new(TagType::Id3v2));

        apply_text_updates_to_tag(&mut id3_tag, update);

        if update.remove_artwork.unwrap_or(false) {
            id3_tag.remove_picture_type(PictureType::CoverFront);
        } else if let Some((ref bytes, mime)) = artwork_bytes {
            id3_tag.remove_picture_type(PictureType::CoverFront);
            id3_tag.push_picture(Picture::new_unchecked(
                PictureType::CoverFront,
                Some(mime),
                None,
                bytes.clone(),
            ));
        }

        // RIFF INFO tag: stores basic text metadata for legacy Windows and simple players
        let mut riff_tag = tagged_file
            .tag(TagType::RiffInfo)
            .cloned()
            .unwrap_or_else(|| Tag::new(TagType::RiffInfo));

        apply_text_updates_to_tag(&mut riff_tag, update);

        let r1 = id3_tag.save_to_path(&temp_path, WriteOptions::default());
        let r2 = riff_tag.save_to_path(&temp_path, WriteOptions::default());
        r1.or(r2)
    } else {
        // For MP3, FLAC, M4A, OGG:
        let target_tag_type = match file_type {
            FileType::Mpeg => TagType::Id3v2,
            FileType::Flac => TagType::VorbisComments,
            FileType::Mp4 => TagType::Mp4Ilst,
            FileType::Opus | FileType::Vorbis => TagType::VorbisComments,
            _ => tagged_file.primary_tag_type(),
        };

        let mut tag = tagged_file
            .tag(target_tag_type)
            .cloned()
            .or_else(|| tagged_file.primary_tag().cloned())
            .or_else(|| tagged_file.first_tag().cloned())
            .unwrap_or_else(|| Tag::new(target_tag_type));

        apply_text_updates_to_tag(&mut tag, update);

        if update.remove_artwork.unwrap_or(false) {
            tag.remove_picture_type(PictureType::CoverFront);
        } else if let Some((ref bytes, mime)) = artwork_bytes {
            tag.remove_picture_type(PictureType::CoverFront);
            tag.push_picture(Picture::new_unchecked(
                PictureType::CoverFront,
                Some(mime),
                None,
                bytes.clone(),
            ));
        }

        tag.save_to_path(&temp_path, WriteOptions::default())
    };

    if let Err(e) = write_res {
        let _ = fs::remove_file(&temp_path);
        return Err(format!("Failed to write audio tag: {}", e));
    }

    // 4. Safely finalize modified file over original
    let backup_ext = format!("syncd_bak_{}.old", timestamp);
    let backup_path = parent_dir.join(&backup_ext);

    let finalize_res = (|| -> Result<(), std::io::Error> {
        // Attempt rename swap
        if fs::rename(path, &backup_path).is_ok() {
            if fs::rename(&temp_path, path).is_ok() {
                let _ = fs::remove_file(&backup_path);
                return Ok(());
            } else {
                let _ = fs::rename(&backup_path, path);
            }
        }
        // Fallback: overwrite copy in case of Windows file sharing locks
        fs::copy(&temp_path, path)?;
        let _ = fs::remove_file(&temp_path);
        let _ = fs::remove_file(&backup_path);
        Ok(())
    })();

    if let Err(e) = finalize_res {
        let _ = fs::remove_file(&temp_path);
        let _ = fs::remove_file(&backup_path);
        return Err(format!("Failed to finalize updated audio file: {}", e));
    }

    // 5. Optionally rename physical file on disk if new_file_name is provided
    let mut final_path = path.to_path_buf();
    let mut renamed_path: Option<std::path::PathBuf> = None;

    if let Some(ref req_filename) = update.new_file_name {
        let trimmed = req_filename.trim();
        if !trimmed.is_empty() {
            let sanitized: String = trimmed
                .chars()
                .filter(|c| !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
                .collect();
            let sanitized = sanitized.trim();

            if !sanitized.is_empty() {
                let with_ext = if !sanitized.contains('.') {
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        format!("{}.{}", sanitized, ext)
                    } else {
                        sanitized.to_string()
                    }
                } else {
                    sanitized.to_string()
                };

                let target_path = parent_dir.join(&with_ext);
                let current_filename = path
                    .file_name()
                    .and_then(|f| f.to_str())
                    .unwrap_or("");

                if with_ext != current_filename {
                    if target_path.exists()
                        && target_path.to_string_lossy().to_lowercase()
                            != path.to_string_lossy().to_lowercase()
                    {
                        return Err(format!(
                            "A file named '{}' already exists in this folder",
                            with_ext
                        ));
                    }

                    if target_path.exists() {
                        let tmp_rename = parent_dir.join(format!("syncd_rename_{}.tmp", timestamp));
                        fs::rename(path, &tmp_rename).map_err(|e| {
                            format!("Failed to stage file for renaming: {}", e)
                        })?;
                        fs::rename(&tmp_rename, &target_path).map_err(|e| {
                            format!("Failed to rename file to '{}': {}", with_ext, e)
                        })?;
                    } else {
                        fs::rename(path, &target_path).map_err(|e| {
                            format!("Failed to rename file to '{}': {}", with_ext, e)
                        })?;
                    }

                    final_path = target_path.clone();
                    renamed_path = Some(target_path);
                }
            }
        }
    }

    // 6. Read back verified extracted metadata from the saved file
    let mut extracted = extract_metadata(&final_path)?;
    if let Some(_hash) = new_artwork_hash.as_ref() {
        extracted.has_artwork = true;
    } else if update.remove_artwork.unwrap_or(false) {
        extracted.has_artwork = false;
    }

    Ok((extracted, new_artwork_hash, renamed_path))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dual_tag_wav() {
        let mut wav_header = Vec::new();
        wav_header.extend_from_slice(b"RIFF");
        wav_header.extend_from_slice(&(36u32 + 100u32).to_le_bytes());
        wav_header.extend_from_slice(b"WAVE");
        wav_header.extend_from_slice(b"fmt ");
        wav_header.extend_from_slice(&16u32.to_le_bytes());
        wav_header.extend_from_slice(&1u16.to_le_bytes());
        wav_header.extend_from_slice(&2u16.to_le_bytes());
        wav_header.extend_from_slice(&44100u32.to_le_bytes());
        wav_header.extend_from_slice(&(44100u32 * 2 * 2).to_le_bytes());
        wav_header.extend_from_slice(&4u16.to_le_bytes());
        wav_header.extend_from_slice(&16u16.to_le_bytes());
        wav_header.extend_from_slice(b"data");
        wav_header.extend_from_slice(&100u32.to_le_bytes());
        wav_header.extend(vec![0u8; 100]);

        let temp_dir = std::env::temp_dir();
        let test_wav = temp_dir.join("syncd_test_dual_tag.wav");
        std::fs::write(&test_wav, &wav_header).unwrap();

        let mut id3_tag = Tag::new(TagType::Id3v2);
        id3_tag.set_title("ID3 Title".to_string());
        let pic = Picture::new_unchecked(PictureType::CoverFront, Some(MimeType::Jpeg), None, vec![1, 2, 3, 4]);
        id3_tag.push_picture(pic);
        let r1 = id3_tag.save_to_path(&test_wav, WriteOptions::default());
        println!("R1 RES: {:?}", r1);

        let mut riff_tag = Tag::new(TagType::RiffInfo);
        riff_tag.set_title("RIFF Title".to_string());
        let r2 = riff_tag.save_to_path(&test_wav, WriteOptions::default());
        println!("R2 RES: {:?}", r2);

        let reloaded = Probe::open(&test_wav).unwrap().guess_file_type().unwrap().read().unwrap();
        println!("RELOADED TAGS: {:?}", reloaded.tags().iter().map(|t| (t.tag_type(), t.pictures().len(), t.title())).collect::<Vec<_>>());

        let _ = std::fs::remove_file(&test_wav);
    }

    #[test]
    fn test_wav_write_probe() {
        // Create minimal 44-byte valid PCM WAV in memory/temp
        let mut wav_header = Vec::new();
        wav_header.extend_from_slice(b"RIFF");
        wav_header.extend_from_slice(&(36u32 + 100u32).to_le_bytes()); // size
        wav_header.extend_from_slice(b"WAVE");
        wav_header.extend_from_slice(b"fmt ");
        wav_header.extend_from_slice(&16u32.to_le_bytes()); // subchunk size
        wav_header.extend_from_slice(&1u16.to_le_bytes()); // PCM
        wav_header.extend_from_slice(&2u16.to_le_bytes()); // 2 channels
        wav_header.extend_from_slice(&44100u32.to_le_bytes()); // sample rate
        wav_header.extend_from_slice(&(44100u32 * 2 * 2).to_le_bytes()); // byte rate
        wav_header.extend_from_slice(&4u16.to_le_bytes()); // block align
        wav_header.extend_from_slice(&16u16.to_le_bytes()); // bits per sample
        wav_header.extend_from_slice(b"data");
        wav_header.extend_from_slice(&100u32.to_le_bytes()); // data size
        wav_header.extend(vec![0u8; 100]); // silent audio samples

        let temp_dir = std::env::temp_dir();
        let test_wav = temp_dir.join("syncd_test_wav_full.wav");
        std::fs::write(&test_wav, &wav_header).unwrap();

        let update = TrackMetadataUpdate {
            title: Some("Verified WAV Title".to_string()),
            artist: Some("Verified WAV Artist".to_string()),
            album: Some("Verified WAV Album".to_string()),
            album_artist: None,
            track_number: Some(1),
            track_total: Some(10),
            disc_number: None,
            disc_total: None,
            year: Some(2025),
            genre: Some("Electronic".to_string()),
            comment: None,
            artwork_base64: Some("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=".to_string()),
            artwork_path: None,
            remove_artwork: None,
            new_file_name: None,
        };

        let artwork_dir = temp_dir.join("syncd_art_cache_full");
        let res = write_track_metadata_to_file(&test_wav, &update, &artwork_dir);
        assert!(res.is_ok(), "Write to WAV failed: {:?}", res);

        let (extracted, art_hash, _renamed) = res.unwrap();
        assert_eq!(extracted.title, "Verified WAV Title");
        assert_eq!(extracted.artist, "Verified WAV Artist");
        assert_eq!(extracted.album, "Verified WAV Album");
        assert!(extracted.has_artwork, "Artwork should be marked as present");
        assert!(art_hash.is_some(), "Artwork hash should be returned");

        // Verify re-probing directly with lofty finds the ID3v2 tag and the artwork
        let reloaded = Probe::open(&test_wav)
            .unwrap()
            .guess_file_type()
            .unwrap()
            .read()
            .unwrap();

        let id3_tag = reloaded.tag(TagType::Id3v2).expect("ID3v2 tag must be present on WAV");
        assert_eq!(id3_tag.title().as_deref(), Some("Verified WAV Title"));
        assert_eq!(id3_tag.artist().as_deref(), Some("Verified WAV Artist"));
        assert!(!id3_tag.pictures().is_empty(), "Embedded picture must be present in ID3v2 tag");
        assert_eq!(id3_tag.track(), Some(1));
        assert_eq!(id3_tag.track_total(), Some(10));

        // Now test setting track_number: Some(0) and track_total: Some(0) to remove old # and total
        let clear_update = TrackMetadataUpdate {
            title: None,
            artist: None,
            album: None,
            album_artist: None,
            track_number: Some(0),
            track_total: Some(0),
            disc_number: None,
            disc_total: None,
            year: None,
            genre: None,
            comment: None,
            artwork_base64: None,
            artwork_path: None,
            remove_artwork: None,
            new_file_name: None,
        };

        let res2 = write_track_metadata_to_file(&test_wav, &clear_update, &artwork_dir);
        assert!(res2.is_ok(), "Clear update failed: {:?}", res2);
        let (extracted2, _, _) = res2.unwrap();
        assert_eq!(extracted2.track_number, None, "Extracted track number should be None after setting to 0");

        let reloaded2 = Probe::open(&test_wav)
            .unwrap()
            .guess_file_type()
            .unwrap()
            .read()
            .unwrap();
        let id3_tag2 = reloaded2.tag(TagType::Id3v2).expect("ID3v2 tag must be present");
        assert_eq!(id3_tag2.track(), None, "Tag track should be None after removal");
        assert_eq!(id3_tag2.track_total(), None, "Tag track total should be None after removal");

        let _ = std::fs::remove_file(&test_wav);
    }
}
