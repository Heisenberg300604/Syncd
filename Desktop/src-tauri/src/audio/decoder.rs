use parking_lot::Mutex;
use rtrb::Producer;
use std::fs::File;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use symphonia::core::audio::{AudioBufferRef, SampleBuffer, Signal};
use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::{FormatOptions, SeekMode, SeekTo};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use symphonia::core::units::Time;

pub enum DecoderCommand {
    Load {
        path: PathBuf,
        start_pos: f64,
        target_sample_rate: u32,
    },
    Seek(f64),
    Stop,
}

pub struct DecoderWorker {
    command_tx: Mutex<std::sync::mpsc::Sender<DecoderCommand>>,
}

impl DecoderWorker {
    pub fn spawn(
        mut producer: Producer<f32>,
        is_playing: Arc<AtomicBool>,
        atomic_duration: Arc<Mutex<f64>>,
        atomic_position: Arc<Mutex<f64>>,
        on_ended: Arc<dyn Fn() + Send + Sync + 'static>,
    ) -> (Self, std::thread::JoinHandle<()>) {
        let (command_tx, command_rx) = std::sync::mpsc::channel::<DecoderCommand>();

        let handle = std::thread::Builder::new()
            .name("syncd-audio-decoder".to_string())
            .spawn(move || {
                let mut _current_file: Option<PathBuf> = None;
                let mut pending_cmd: Option<DecoderCommand> = None;

                loop {
                    let next_cmd = pending_cmd.take().or_else(|| command_rx.try_recv().ok());
                    match next_cmd {
                        Some(DecoderCommand::Load {
                            path,
                            start_pos,
                            target_sample_rate,
                        }) => {
                            _current_file = Some(path.clone());
                            *atomic_position.lock() = start_pos;
                            pending_cmd = run_file_playback(
                                &path,
                                start_pos,
                                target_sample_rate,
                                &mut producer,
                                &is_playing,
                                &atomic_duration,
                                &atomic_position,
                                &command_rx,
                                &on_ended,
                            );
                        }
                        Some(DecoderCommand::Stop) => {
                            _current_file = None;
                            is_playing.store(false, Ordering::SeqCst);
                        }
                        Some(DecoderCommand::Seek(_)) => {
                            // Ignored if no track is running
                        }
                        None => {
                            std::thread::sleep(Duration::from_millis(15));
                        }
                    }
                }
            })
            .expect("failed to spawn audio decoder thread");

        (
            Self {
                command_tx: Mutex::new(command_tx),
            },
            handle,
        )
    }

    pub fn send(&self, cmd: DecoderCommand) {
        let _ = self.command_tx.lock().send(cmd);
    }
}

/// Linear interpolation stereo resampler that matches the decoded audio's sample rate
/// to the hardware output device's native sample rate.
struct StereoResampler {
    source_rate: u32,
    target_rate: u32,
    ratio: f64,
    fraction: f64,
    prev_l: f32,
    prev_r: f32,
    has_prev: bool,
}

impl StereoResampler {
    fn new(source_rate: u32, target_rate: u32) -> Self {
        let s = source_rate.max(1);
        let t = target_rate.max(1);
        Self {
            source_rate: s,
            target_rate: t,
            ratio: s as f64 / t as f64,
            fraction: 0.0,
            prev_l: 0.0,
            prev_r: 0.0,
            has_prev: false,
        }
    }

    fn push_stereo(&mut self, stereo_samples: &[f32], producer: &mut Producer<f32>) {
        if self.source_rate == self.target_rate {
            // Direct pass-through when rates match
            for &s in stereo_samples {
                while producer.is_full() {
                    std::thread::sleep(Duration::from_millis(2));
                }
                let _ = producer.push(s);
            }
            return;
        }

        // Resample frames from source_rate to target_rate
        for chunk in stereo_samples.chunks(2) {
            let curr_l = chunk[0];
            let curr_r = if chunk.len() > 1 { chunk[1] } else { curr_l };

            if !self.has_prev {
                self.prev_l = curr_l;
                self.prev_r = curr_r;
                self.has_prev = true;
                continue;
            }

            while self.fraction < 1.0 {
                let t = self.fraction as f32;
                let out_l = self.prev_l + (curr_l - self.prev_l) * t;
                let out_r = self.prev_r + (curr_r - self.prev_r) * t;

                while producer.slots() < 2 {
                    std::thread::sleep(Duration::from_millis(2));
                }

                let _ = producer.push(out_l);
                let _ = producer.push(out_r);

                self.fraction += self.ratio;
            }

            self.fraction -= 1.0;
            self.prev_l = curr_l;
            self.prev_r = curr_r;
        }
    }
}

fn to_stereo(samples: &[f32], channels: usize) -> Vec<f32> {
    if channels == 2 {
        samples.to_vec()
    } else if channels == 1 {
        let mut out = Vec::with_capacity(samples.len() * 2);
        for &s in samples {
            out.push(s);
            out.push(s);
        }
        out
    } else {
        // Multi-channel downmix: take front-left and front-right
        let mut out = Vec::with_capacity((samples.len() / channels.max(1)) * 2);
        for chunk in samples.chunks(channels) {
            if chunk.len() >= 2 {
                out.push(chunk[0]);
                out.push(chunk[1]);
            } else if !chunk.is_empty() {
                out.push(chunk[0]);
                out.push(chunk[0]);
            }
        }
        out
    }
}

#[allow(clippy::too_many_arguments)]
fn run_file_playback(
    path: &Path,
    start_pos: f64,
    target_sample_rate: u32,
    producer: &mut Producer<f32>,
    is_playing: &Arc<AtomicBool>,
    atomic_duration: &Arc<Mutex<f64>>,
    atomic_position: &Arc<Mutex<f64>>,
    command_rx: &std::sync::mpsc::Receiver<DecoderCommand>,
    on_ended: &Arc<dyn Fn() + Send + Sync + 'static>,
) -> Option<DecoderCommand> {
    let file = match File::open(path) {
        Ok(f) => f,
        Err(err) => {
            log::error!("Failed to open audio file {:?}: {}", path, err);
            return None;
        }
    };

    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let meta_opts: MetadataOptions = Default::default();
    let fmt_opts: FormatOptions = Default::default();

    let probed = match symphonia::default::get_probe().format(&hint, mss, &fmt_opts, &meta_opts) {
        Ok(p) => p,
        Err(err) => {
            log::error!("Failed to probe audio format for {:?}: {}", path, err);
            return None;
        }
    };

    let mut format = probed.format;

    // Find first supported audio track
    let track = match format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
    {
        Some(t) => t.clone(),
        None => {
            log::error!("No supported audio track found in {:?}", path);
            return None;
        }
    };

    let track_id = track.id;
    let time_base = track.codec_params.time_base;
    let source_sample_rate = track.codec_params.sample_rate.unwrap_or(44100);

    // Calculate duration
    let duration_sec = if let (Some(n_frames), Some(tb)) = (track.codec_params.n_frames, time_base)
    {
        let time = tb.calc_time(n_frames);
        time.seconds as f64 + time.frac
    } else {
        0.0
    };
    *atomic_duration.lock() = duration_sec;

    let dec_opts: DecoderOptions = Default::default();
    let mut decoder = match symphonia::default::get_codecs().make(&track.codec_params, &dec_opts) {
        Ok(d) => d,
        Err(err) => {
            log::error!("Failed to create audio decoder: {}", err);
            return None;
        }
    };

    // Initialize the resampler to adapt to the hardware DAC rate
    let effective_target_rate = if target_sample_rate == 0 {
        48000
    } else {
        target_sample_rate
    };
    let mut resampler = StereoResampler::new(source_sample_rate, effective_target_rate);

    // Initial seek if start_pos > 0
    if start_pos > 0.0 {
        let _ = format.seek(
            SeekMode::Coarse,
            SeekTo::Time {
                time: Time::from(start_pos),
                track_id: Some(track_id),
            },
        );
    }

    let mut sample_buf: Option<SampleBuffer<f32>> = None;

    // Decoding Loop
    loop {
        // Handle incoming commands
        if let Ok(cmd) = command_rx.try_recv() {
            match cmd {
                DecoderCommand::Load { .. } => {
                    return Some(cmd);
                }
                DecoderCommand::Stop => {
                    return None;
                }
                DecoderCommand::Seek(target_sec) => {
                    let _ = format.seek(
                        SeekMode::Coarse,
                        SeekTo::Time {
                            time: Time::from(target_sec),
                            track_id: Some(track_id),
                        },
                    );
                    *atomic_position.lock() = target_sec;
                    resampler = StereoResampler::new(source_sample_rate, effective_target_rate);
                }
            }
        }

        // Wait if playback is paused
        if !is_playing.load(Ordering::Relaxed) {
            std::thread::sleep(Duration::from_millis(20));
            continue;
        }

        // Wait if ring buffer is nearly full
        if producer.slots() < 8192 {
            std::thread::sleep(Duration::from_millis(5));
            continue;
        }

        let packet = match format.next_packet() {
            Ok(pkt) => pkt,
            Err(SymphoniaError::IoError(ref err))
                if err.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                on_ended();
                break;
            }
            Err(SymphoniaError::ResetRequired) => {
                decoder.reset();
                continue;
            }
            Err(err) => {
                log::error!("Audio decode packet error: {}", err);
                break;
            }
        };

        if packet.track_id() != track_id {
            continue;
        }

        match decoder.decode(&packet) {
            Ok(AudioBufferRef::F32(buf)) => {
                let channels = buf.spec().channels.count();
                let frames = buf.frames();
                if sample_buf.is_none() {
                    sample_buf = Some(SampleBuffer::new(buf.capacity() as u64, *buf.spec()));
                }
                if let Some(ref mut sbuf) = sample_buf {
                    sbuf.copy_interleaved_ref(AudioBufferRef::F32(buf));
                    let total = frames * channels;
                    let valid_samples = if total <= sbuf.samples().len() {
                        &sbuf.samples()[..total]
                    } else {
                        sbuf.samples()
                    };
                    let stereo = to_stereo(valid_samples, channels);
                    resampler.push_stereo(&stereo, producer);
                }
            }
            Ok(decoded) => {
                let channels = decoded.spec().channels.count();
                let frames = decoded.frames();
                if sample_buf.is_none() {
                    sample_buf = Some(SampleBuffer::new(
                        decoded.capacity() as u64,
                        *decoded.spec(),
                    ));
                }
                if let Some(ref mut sbuf) = sample_buf {
                    sbuf.copy_interleaved_ref(decoded);
                    let total = frames * channels;
                    let valid_samples = if total <= sbuf.samples().len() {
                        &sbuf.samples()[..total]
                    } else {
                        sbuf.samples()
                    };
                    let stereo = to_stereo(valid_samples, channels);
                    resampler.push_stereo(&stereo, producer);
                }
            }
            Err(SymphoniaError::DecodeError(err)) => {
                log::warn!("Decode warning: {}", err);
                continue;
            }
            Err(err) => {
                log::error!("Decoder critical failure: {}", err);
                break;
            }
        }
    }

    None
}
