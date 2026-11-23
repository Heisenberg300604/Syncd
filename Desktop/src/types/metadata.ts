export interface DetailedAudioMetadata {
  id?: string;
  path: string;
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  durationSeconds: number;
  trackNumber?: number;
  trackTotal?: number;
  discNumber?: number;
  discTotal?: number;
  year?: number;
  genre?: string;
  comment?: string;
  format: string;
  bitrateKbps?: number;
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
  fileSizeBytes: number;
  hasArtwork: boolean;
  artworkHash?: string;
  dateModified: string;
}

export interface TrackMetadataUpdate {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  trackNumber?: number;
  trackTotal?: number;
  discNumber?: number;
  discTotal?: number;
  year?: number;
  genre?: string;
  comment?: string;
  artworkBase64?: string;
  artworkPath?: string;
  removeArtwork?: boolean;
  newFileName?: string;
}

export interface AlbumMetadataUpdatePayload {
  album: string;
  albumArtist?: string;
  year?: number;
  genre?: string;
  artworkBase64?: string;
  artworkPath?: string;
  removeArtwork?: boolean;
}

export interface CreateAlbumTrackItem {
  trackId: string;
  trackNumber?: number;
}

export interface CreateAlbumPayload {
  album: string;
  albumArtist?: string;
  year?: number;
  genre?: string;
  artworkBase64?: string;
  artworkPath?: string;
  tracks: CreateAlbumTrackItem[];
}
