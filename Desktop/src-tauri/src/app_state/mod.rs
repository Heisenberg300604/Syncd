use crate::audio::AudioController;
use crate::database::{Database, PlaylistDatabase, UserDatabase};
use crate::library::scanner::LibraryScanner;
use parking_lot::Mutex;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

pub struct AppState {
    pub db: Arc<Mutex<Database>>,
    pub user_db: Arc<Mutex<UserDatabase>>,
    pub playlist_db: Arc<Mutex<PlaylistDatabase>>,
    pub install_dir: PathBuf,
    pub db_path: PathBuf,
    pub scanner: Arc<LibraryScanner>,
    pub is_scanning: Arc<AtomicBool>,
    pub audio: Arc<AudioController>,
}

unsafe impl Send for AppState {}
unsafe impl Sync for AppState {}

impl AppState {
    pub fn new(
        db: Database,
        user_db: UserDatabase,
        playlist_db: PlaylistDatabase,
        install_dir: PathBuf,
        db_path: PathBuf,
        audio: AudioController,
    ) -> Self {
        Self {
            db: Arc::new(Mutex::new(db)),
            user_db: Arc::new(Mutex::new(user_db)),
            playlist_db: Arc::new(Mutex::new(playlist_db)),
            install_dir,
            db_path,
            scanner: Arc::new(LibraryScanner::new()),
            is_scanning: Arc::new(AtomicBool::new(false)),
            audio: Arc::new(audio),
        }
    }
}
