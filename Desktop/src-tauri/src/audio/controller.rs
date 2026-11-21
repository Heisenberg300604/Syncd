use crate::audio::decoder::{DecoderCommand, DecoderWorker};
use crate::audio::output::{list_output_devices, AudioOutputStream};
use crate::audio::types::{AudioDeviceDescriptor, AudioPlaybackStatus, PlaybackState};
use parking_lot::{Mutex, RwLock};
use rtrb::RingBuffer;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct AudioController {
    worker: DecoderWorker,
    _output_stream: Arc<Mutex<Option<AudioOutputStream>>>,
    state: Arc<Mutex<PlaybackState>>,
    current_track: Arc<Mutex<Option<String>>>,
    position: Arc<Mutex<f64>>,
    duration: Arc<Mutex<f64>>,
    volume: Arc<RwLock<f32>>,
    is_muted: Arc<AtomicBool>,
    is_playing: Arc<AtomicBool>,
    needs_flush: Arc<AtomicBool>,
    sample_rate: Arc<Mutex<u32>>,
    channels: Arc<Mutex<u16>>,
}

unsafe impl Send for AudioController {}
unsafe impl Sync for AudioController {}

impl AudioController {
    pub fn new() -> Result<Self, String> {
        // High-capacity ring buffer for high-resolution sample rates (e.g. 96kHz/192kHz)
        let (producer, consumer) = RingBuffer::<f32>::new(384_000);

        let is_playing = Arc::new(AtomicBool::new(false));
        let is_muted = Arc::new(AtomicBool::new(false));
        let needs_flush = Arc::new(AtomicBool::new(false));
        let volume = Arc::new(RwLock::new(0.8f32));
        let position = Arc::new(Mutex::new(0.0f64));
        let duration = Arc::new(Mutex::new(0.0f64));
        let state = Arc::new(Mutex::new(PlaybackState::Stopped));
        let current_track = Arc::new(Mutex::new(None));

        let state_ended_clone = state.clone();
        let is_playing_ended_clone = is_playing.clone();

        let on_ended = Arc::new(move || {
            *state_ended_clone.lock() = PlaybackState::Ended;
            is_playing_ended_clone.store(false, Ordering::SeqCst);
        });

        let (worker, _worker_thread) = DecoderWorker::spawn(
            producer,
            is_playing.clone(),
            duration.clone(),
            position.clone(),
            on_ended.clone(),
        );

        let output_stream = Arc::new(Mutex::new(None));
        let sample_rate = Arc::new(Mutex::new(48000u32));
        let channels = Arc::new(Mutex::new(2u16));

        let out_clone = output_stream.clone();
        let sr_clone = sample_rate.clone();
        let ch_clone = channels.clone();
        let vol_clone = volume.clone();
        let muted_clone = is_muted.clone();
        let playing_clone = is_playing.clone();
        let pos_clone = position.clone();
        let flush_clone = needs_flush.clone();
        let dur_thread_clone = duration.clone();
        let on_ended_thread_clone = on_ended.clone();

        // Spawn CPAL WASAPI audio device initialization in a background thread
        // so the native desktop app cold start is INSTANT (<100ms) with zero UI freeze!
        let _ = std::thread::Builder::new()
            .name("syncd-audio-init".to_string())
            .spawn(move || {
                match AudioOutputStream::new(
                    consumer,
                    vol_clone,
                    muted_clone,
                    playing_clone,
                    pos_clone,
                    flush_clone,
                    dur_thread_clone,
                    on_ended_thread_clone,
                ) {
                    Ok(stream) => {
                        *sr_clone.lock() = stream.sample_rate;
                        *ch_clone.lock() = stream.channels;
                        *out_clone.lock() = Some(stream);
                        log::info!(
                            "Audio output stream initialized successfully in background thread"
                        );
                    }
                    Err(err) => {
                        log::warn!(
                            "Audio output device could not be initialized in background: {}",
                            err
                        );
                    }
                }
            });

        Ok(Self {
            worker,
            _output_stream: output_stream,
            state,
            current_track,
            position,
            duration,
            volume,
            is_muted,
            is_playing,
            needs_flush,
            sample_rate,
            channels,
        })
    }

    pub fn play_track(&self, path: &str, start_pos: f64) -> Result<(), String> {
        let p = PathBuf::from(path);
        if !p.exists() || !p.is_file() {
            return Err(format!("Audio file does not exist: {}", path));
        }

        // Flush stale audio buffer instantly so new song begins with 0ms delay and no bleed
        self.needs_flush.store(true, Ordering::SeqCst);

        *self.current_track.lock() = Some(path.to_string());
        *self.state.lock() = PlaybackState::Loading;
        *self.position.lock() = start_pos;

        let target_sr = *self.sample_rate.lock();
        self.worker.send(DecoderCommand::Load {
            path: p,
            start_pos,
            target_sample_rate: target_sr,
        });

        self.is_playing.store(true, Ordering::SeqCst);
        *self.state.lock() = PlaybackState::Playing;

        Ok(())
    }

    pub fn pause(&self) -> Result<(), String> {
        self.is_playing.store(false, Ordering::SeqCst);
        *self.state.lock() = PlaybackState::Paused;
        Ok(())
    }

    pub fn resume(&self) -> Result<(), String> {
        if self.current_track.lock().is_none() {
            return Err("No track currently loaded".to_string());
        }
        self.is_playing.store(true, Ordering::SeqCst);
        *self.state.lock() = PlaybackState::Playing;
        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        self.is_playing.store(false, Ordering::SeqCst);
        self.needs_flush.store(true, Ordering::SeqCst);
        self.worker.send(DecoderCommand::Stop);
        *self.current_track.lock() = None;
        *self.position.lock() = 0.0;
        *self.duration.lock() = 0.0;
        *self.state.lock() = PlaybackState::Stopped;
        Ok(())
    }

    pub fn seek(&self, position_seconds: f64) -> Result<(), String> {
        if self.current_track.lock().is_none() {
            return Err("No track currently loaded to seek".to_string());
        }

        let dur = *self.duration.lock();
        let clamped = if dur > 0.0 {
            position_seconds.clamp(0.0, dur)
        } else {
            position_seconds.max(0.0)
        };

        *self.position.lock() = clamped;
        self.needs_flush.store(true, Ordering::SeqCst);
        self.worker.send(DecoderCommand::Seek(clamped));
        Ok(())
    }

    pub fn set_volume(&self, volume: f32) {
        let clamped = volume.clamp(0.0, 1.0);
        *self.volume.write() = clamped;
    }

    pub fn toggle_mute(&self) -> bool {
        let current = self.is_muted.load(Ordering::Relaxed);
        let new_val = !current;
        self.is_muted.store(new_val, Ordering::Relaxed);
        new_val
    }

    pub fn get_status(&self) -> AudioPlaybackStatus {
        AudioPlaybackStatus {
            state: *self.state.lock(),
            current_track_path: self.current_track.lock().clone(),
            position_seconds: *self.position.lock(),
            duration_seconds: *self.duration.lock(),
            volume: *self.volume.read(),
            is_muted: self.is_muted.load(Ordering::Relaxed),
            sample_rate: *self.sample_rate.lock(),
            channels: *self.channels.lock(),
            error_message: None,
        }
    }

    pub fn list_devices(&self) -> Vec<AudioDeviceDescriptor> {
        list_output_devices()
    }
}
