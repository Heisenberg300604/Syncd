export type PlaybackState =
  | 'stopped'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'seeking'
  | 'ended'
  | 'error';

export interface AudioPlaybackStatus {
  state: PlaybackState;
  currentTrackPath: string | null;
  positionSeconds: number;
  durationSeconds: number;
  volume: number;
  isMuted: boolean;
  sampleRate: number;
  channels: number;
  errorMessage: string | null;
}

export interface AudioDeviceDescriptor {
  id: string;
  name: string;
  isDefault: boolean;
}

