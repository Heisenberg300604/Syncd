use std::path::{Path, PathBuf};
use std::fs;
use sha2::{Sha256, Digest};
use lofty::file::TaggedFileExt;
use lofty::probe::Probe;
use lofty::picture::MimeType;

pub fn extract_and_cache_artwork(audio_path: &Path, artwork_dir: &Path) -> Result<Option<PathBuf>, String> {
    fs::create_dir_all(artwork_dir).map_err(|e| e.to_string())?;

    let tagged_file = match Probe::open(audio_path).and_then(|p| p.read()) {
        Ok(f) => f,
        Err(_) => return Ok(None),
    };

    let tag = match tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
        Some(t) => t,
        None => return Ok(None),
    };

    let picture = match tag.pictures().first() {
        Some(p) => p,
        None => return Ok(None),
    };

    let data = picture.data();
    if data.is_empty() {
        return Ok(None);
    }

    // Hash picture bytes to ensure deduplicated artwork storage
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
        log::info!("Cached album artwork: {}", artwork_filename);
    }

    Ok(Some(artwork_dest))
}
