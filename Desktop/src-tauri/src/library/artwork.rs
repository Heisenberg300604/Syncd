use lofty::file::TaggedFileExt;
use lofty::picture::MimeType;
use lofty::probe::Probe;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

/// Extracts artwork from audio tags, or falls back to folder-level artwork (cover.jpg, folder.jpg, etc.)
pub fn extract_and_cache_artwork(
    audio_path: &Path,
    artwork_dir: &Path,
) -> Result<Option<PathBuf>, String> {
    fs::create_dir_all(artwork_dir).map_err(|e| e.to_string())?;

    // Try probing with magic byte sniffing first, then fallback to normal probe
    let tagged_file_opt = Probe::open(audio_path)
        .and_then(|p| p.guess_file_type().map_err(lofty::error::LoftyError::from))
        .and_then(|p| p.read())
        .ok()
        .or_else(|| Probe::open(audio_path).and_then(|p| p.read()).ok());

    if let Some(tagged_file) = tagged_file_opt {
        // Search across ALL tags (ID3v2, Vorbis, etc.) for an embedded picture
        let picture = tagged_file.tags().iter().find_map(|t| t.pictures().first());

        if let Some(picture) = picture {
            let data = picture.data();
            if !data.is_empty() {
                let mut hasher = Sha256::new();
                hasher.update(data);
                let hash = format!("{:x}", hasher.finalize());

                let extension = match picture.mime_type() {
                    Some(MimeType::Png) => "png",
                    _ => "jpg",
                };

                let artwork_filename = format!("{}.{}", hash, extension);
                let artwork_dest = artwork_dir.join(&artwork_filename);

                if !artwork_dest.exists() {
                    fs::write(&artwork_dest, data).map_err(|e| e.to_string())?;
                    log::info!("Cached embedded audio artwork: {}", artwork_filename);
                }

                return Ok(Some(artwork_dest));
            }
        }
    }

    // Fallback: check folder-level artwork (e.g. cover.jpg, folder.jpg, <Album>.jpg)
    find_folder_artwork(audio_path, artwork_dir)
}

/// Discovers folder-level artwork images in the audio file's parent directory
fn find_folder_artwork(audio_path: &Path, artwork_dir: &Path) -> Result<Option<PathBuf>, String> {
    let parent = match audio_path.parent() {
        Some(p) => p,
        None => return Ok(None),
    };

    // 1. Check common standard cover art filenames
    let standard_names = [
        "cover.jpg",
        "cover.jpeg",
        "cover.png",
        "folder.jpg",
        "folder.jpeg",
        "folder.png",
        "album.jpg",
        "album.jpeg",
        "album.png",
        "albumart.jpg",
        "albumart.png",
        "front.jpg",
        "front.png",
    ];

    for name in &standard_names {
        let candidate = parent.join(name);
        if candidate.exists() && candidate.is_file() {
            if let Ok(dest) = cache_image_file(&candidate, artwork_dir) {
                return Ok(Some(dest));
            }
        }
    }

    // 2. Scan directory for any image file (e.g. "THΞ W4LKΞR LΞG4CY.JPG")
    if let Ok(entries) = fs::read_dir(parent) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    if ext_lower == "jpg"
                        || ext_lower == "jpeg"
                        || ext_lower == "png"
                        || ext_lower == "webp"
                    {
                        if let Ok(dest) = cache_image_file(&path, artwork_dir) {
                            return Ok(Some(dest));
                        }
                    }
                }
            }
        }
    }

    Ok(None)
}

/// Hashes and copies an image into the deduplicated artwork cache directory
fn cache_image_file(image_path: &Path, artwork_dir: &Path) -> Result<PathBuf, String> {
    let data = fs::read(image_path).map_err(|e| e.to_string())?;
    if data.is_empty() {
        return Err("Empty image file".to_string());
    }

    let mut hasher = Sha256::new();
    hasher.update(&data);
    let hash = format!("{:x}", hasher.finalize());

    let ext = image_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_else(|| "jpg".to_string());

    let dest = artwork_dir.join(format!("{}.{}", hash, ext));
    if !dest.exists() {
        fs::write(&dest, &data).map_err(|e| e.to_string())?;
        log::info!(
            "Cached folder artwork from {:?}: {}",
            image_path.file_name(),
            dest.display()
        );
    }

    Ok(dest)
}
