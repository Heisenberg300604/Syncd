use crate::audio::types::AudioDeviceDescriptor;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Stream, StreamConfig};
use parking_lot::Mutex;
use rtrb::Consumer;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct AudioOutputStream {
    _stream: Stream,
    pub sample_rate: u32,
    pub channels: u16,
}

unsafe impl Send for AudioOutputStream {}
unsafe impl Sync for AudioOutputStream {}

impl AudioOutputStream {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        mut consumer: Consumer<f32>,
        volume: Arc<parking_lot::RwLock<f32>>,
        is_muted: Arc<AtomicBool>,
        is_playing: Arc<AtomicBool>,
        position: Arc<Mutex<f64>>,
        needs_flush: Arc<AtomicBool>,
        duration: Arc<Mutex<f64>>,
        on_ended: Arc<dyn Fn() + Send + Sync + 'static>,
    ) -> Result<Self, String> {
        let host = cpal::default_host();
        let device = host
            .default_output_device()
            .ok_or_else(|| "No default audio output device available".to_string())?;

        let default_config = match device.default_output_config() {
            Ok(c) => c,
            Err(_) => {
                let mut supported = device
                    .supported_output_configs()
                    .map_err(|e| format!("No supported output configs on default device: {}", e))?;
                supported
                    .next()
                    .ok_or_else(|| "No output configs supported on device".to_string())?
                    .with_max_sample_rate()
            }
        };

        let sample_rate = default_config.sample_rate().0;
        let channels = default_config.channels();
        let sample_format = default_config.sample_format();

        let stream_config: StreamConfig = default_config.into();

        let vol_clone = volume.clone();
        let muted_clone = is_muted.clone();
        let playing_clone = is_playing.clone();
        let pos_clone = position.clone();
        let dur_clone = duration.clone();
        let on_ended_clone = on_ended.clone();

        let err_fn = |err| {
            log::error!("CPAL audio stream error: {}", err);
        };

        let ch_count = channels as usize;

        let stream = match sample_format {
            cpal::SampleFormat::F32 => {
                let v = vol_clone.clone();
                let m = muted_clone.clone();
                let p = playing_clone.clone();
                let pos = pos_clone.clone();
                let dur = dur_clone.clone();
                let cb_ended = on_ended_clone.clone();
                let fl = needs_flush.clone();
                let ramp_step = 1.0 / (sample_rate as f32 * 0.005).max(1.0); // 5ms micro-ramp step
                let mut current_gain = 0.0f32;

                device.build_output_stream(
                    &stream_config,
                    move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                        if fl.swap(false, Ordering::SeqCst) {
                            while consumer.pop().is_ok() {}
                            current_gain = 0.0;
                        }

                        let is_active = p.load(Ordering::Relaxed);
                        let muted = m.load(Ordering::Relaxed);
                        let target_vol = if muted || !is_active { 0.0 } else { *v.read() };

                        let mut frames_read = 0;
                        let mut had_samples = false;
                        for frame in data.chunks_mut(ch_count) {
                            // 5ms smooth gain ramping eliminates digital clicks and pops
                            if (current_gain - target_vol).abs() <= ramp_step {
                                current_gain = target_vol;
                            } else if current_gain < target_vol {
                                current_gain += ramp_step;
                            } else {
                                current_gain -= ramp_step;
                            }

                            if current_gain > 0.00001 || is_active {
                                // Paired L+R popping guarantees stereo channels never desynchronize
                                let (left_raw, right_raw) = match consumer.pop() {
                                    Ok(l) => match consumer.pop() {
                                        Ok(r) => {
                                            had_samples = true;
                                            (l, r)
                                        }
                                        Err(_) => {
                                            had_samples = true;
                                            (l, l)
                                        }
                                    },
                                    Err(_) => (0.0, 0.0),
                                };

                                let left = left_raw * current_gain;
                                let right = right_raw * current_gain;

                                if frame.len() >= 2 {
                                    frame[0] = left;
                                    frame[1] = right;
                                    for ch in &mut frame[2..] {
                                        *ch = 0.0;
                                    }
                                } else if frame.len() == 1 {
                                    frame[0] = (left + right) * 0.5;
                                }
                                frames_read += 1;
                            } else {
                                for s in frame.iter_mut() {
                                    *s = 0.0;
                                }
                            }
                        }

                        if is_active && frames_read > 0 {
                            let sec = frames_read as f64 / sample_rate as f64;
                            let mut p_val = pos.lock();
                            let d = *dur.lock();
                            if d > 0.0 && (*p_val + sec) >= d {
                                *p_val = d;
                                drop(p_val);
                                cb_ended();
                            } else if had_samples {
                                *p_val += sec;
                            } else if d > 0.0 && *p_val >= (d - 0.25) {
                                *p_val = d;
                                drop(p_val);
                                cb_ended();
                            }
                        }
                    },
                    err_fn,
                    None,
                )
            }
            cpal::SampleFormat::I16 => {
                let v = vol_clone.clone();
                let m = muted_clone.clone();
                let p = playing_clone.clone();
                let pos = pos_clone.clone();
                let dur = dur_clone.clone();
                let cb_ended = on_ended_clone.clone();
                let fl = needs_flush.clone();
                let ramp_step = 1.0 / (sample_rate as f32 * 0.005).max(1.0);
                let mut current_gain = 0.0f32;

                device.build_output_stream(
                    &stream_config,
                    move |data: &mut [i16], _: &cpal::OutputCallbackInfo| {
                        if fl.swap(false, Ordering::SeqCst) {
                            while consumer.pop().is_ok() {}
                            current_gain = 0.0;
                        }

                        let is_active = p.load(Ordering::Relaxed);
                        let muted = m.load(Ordering::Relaxed);
                        let target_vol = if muted || !is_active { 0.0 } else { *v.read() };

                        let mut frames_read = 0;
                        let mut had_samples = false;
                        for frame in data.chunks_mut(ch_count) {
                            if (current_gain - target_vol).abs() <= ramp_step {
                                current_gain = target_vol;
                            } else if current_gain < target_vol {
                                current_gain += ramp_step;
                            } else {
                                current_gain -= ramp_step;
                            }

                            if current_gain > 0.00001 || is_active {
                                let (left_raw, right_raw) = match consumer.pop() {
                                    Ok(l) => match consumer.pop() {
                                        Ok(r) => {
                                            had_samples = true;
                                            (l, r)
                                        }
                                        Err(_) => {
                                            had_samples = true;
                                            (l, l)
                                        }
                                    },
                                    Err(_) => (0.0, 0.0),
                                };

                                let left = (left_raw * current_gain).clamp(-1.0, 1.0);
                                let right = (right_raw * current_gain).clamp(-1.0, 1.0);

                                let l_i16 = (left * 32767.0) as i16;
                                let r_i16 = (right * 32767.0) as i16;

                                if frame.len() >= 2 {
                                    frame[0] = l_i16;
                                    frame[1] = r_i16;
                                    for ch in &mut frame[2..] {
                                        *ch = 0;
                                    }
                                } else if frame.len() == 1 {
                                    frame[0] = (((left + right) * 0.5) * 32767.0) as i16;
                                }
                                frames_read += 1;
                            } else {
                                for s in frame.iter_mut() {
                                    *s = 0;
                                }
                            }
                        }

                        if is_active && frames_read > 0 {
                            let sec = frames_read as f64 / sample_rate as f64;
                            let mut p_val = pos.lock();
                            let d = *dur.lock();
                            if d > 0.0 && (*p_val + sec) >= d {
                                *p_val = d;
                                drop(p_val);
                                cb_ended();
                            } else if had_samples {
                                *p_val += sec;
                            } else if d > 0.0 && *p_val >= (d - 0.25) {
                                *p_val = d;
                                drop(p_val);
                                cb_ended();
                            }
                        }
                    },
                    err_fn,
                    None,
                )
            }
            cpal::SampleFormat::U16 => {
                let v = vol_clone.clone();
                let m = muted_clone.clone();
                let p = playing_clone.clone();
                let pos = pos_clone.clone();
                let fl = needs_flush.clone();
                device.build_output_stream(
                    &stream_config,
                    move |data: &mut [u16], _: &cpal::OutputCallbackInfo| {
                        if fl.swap(false, Ordering::SeqCst) {
                            while consumer.pop().is_ok() {}
                        }

                        let is_active = p.load(Ordering::Relaxed);
                        let muted = m.load(Ordering::Relaxed);
                        let vol = if muted || !is_active { 0.0 } else { *v.read() };

                        let mut frames_read = 0;
                        for frame in data.chunks_mut(ch_count) {
                            if is_active {
                                let left = (consumer.pop().unwrap_or(0.0) * vol).clamp(-1.0, 1.0);
                                let right = (consumer.pop().unwrap_or(0.0) * vol).clamp(-1.0, 1.0);

                                let l_u16 = ((left * 0.5 + 0.5) * 65535.0) as u16;
                                let r_u16 = ((right * 0.5 + 0.5) * 65535.0) as u16;

                                if frame.len() >= 2 {
                                    frame[0] = l_u16;
                                    frame[1] = r_u16;
                                    for ch in &mut frame[2..] {
                                        *ch = 32768;
                                    }
                                } else if frame.len() == 1 {
                                    frame[0] =
                                        ((((left + right) * 0.5) * 0.5 + 0.5) * 65535.0) as u16;
                                }
                                frames_read += 1;
                            } else {
                                for s in frame.iter_mut() {
                                    *s = 32768;
                                }
                            }
                        }

                        if is_active && frames_read > 0 {
                            let sec = frames_read as f64 / sample_rate as f64;
                            *pos.lock() += sec;
                        }
                    },
                    err_fn,
                    None,
                )
            }
            cpal::SampleFormat::I32 => {
                let v = vol_clone.clone();
                let m = muted_clone.clone();
                let p = playing_clone.clone();
                let pos = pos_clone.clone();
                let fl = needs_flush.clone();
                device.build_output_stream(
                    &stream_config,
                    move |data: &mut [i32], _: &cpal::OutputCallbackInfo| {
                        if fl.swap(false, Ordering::SeqCst) {
                            while consumer.pop().is_ok() {}
                        }

                        let is_active = p.load(Ordering::Relaxed);
                        let muted = m.load(Ordering::Relaxed);
                        let vol = if muted || !is_active { 0.0 } else { *v.read() };

                        let mut frames_read = 0;
                        for frame in data.chunks_mut(ch_count) {
                            if is_active {
                                let left = (consumer.pop().unwrap_or(0.0) * vol).clamp(-1.0, 1.0);
                                let right = (consumer.pop().unwrap_or(0.0) * vol).clamp(-1.0, 1.0);

                                let l_i32 = (left * 2147483647.0) as i32;
                                let r_i32 = (right * 2147483647.0) as i32;

                                if frame.len() >= 2 {
                                    frame[0] = l_i32;
                                    frame[1] = r_i32;
                                    for ch in &mut frame[2..] {
                                        *ch = 0;
                                    }
                                } else if frame.len() == 1 {
                                    frame[0] = (((left + right) * 0.5) * 2147483647.0) as i32;
                                }
                                frames_read += 1;
                            } else {
                                for s in frame.iter_mut() {
                                    *s = 0;
                                }
                            }
                        }

                        if is_active && frames_read > 0 {
                            let sec = frames_read as f64 / sample_rate as f64;
                            *pos.lock() += sec;
                        }
                    },
                    err_fn,
                    None,
                )
            }
            fmt => {
                return Err(format!("Unsupported audio sample format: {:?}", fmt));
            }
        }
        .map_err(|e| format!("Failed to build audio output stream: {}", e))?;

        stream
            .play()
            .map_err(|e| format!("Failed to start audio stream: {}", e))?;

        Ok(Self {
            _stream: stream,
            sample_rate,
            channels,
        })
    }
}

pub fn list_output_devices() -> Vec<AudioDeviceDescriptor> {
    let host = cpal::default_host();
    let mut descriptors = Vec::new();

    let default_device_name = host
        .default_output_device()
        .and_then(|d| d.name().ok())
        .unwrap_or_default();

    if let Ok(devices) = host.output_devices() {
        for (idx, dev) in devices.enumerate() {
            if let Ok(name) = dev.name() {
                let is_default = name == default_device_name;
                descriptors.push(AudioDeviceDescriptor {
                    id: format!("device_{}", idx),
                    name,
                    is_default,
                });
            }
        }
    }

    descriptors
}
