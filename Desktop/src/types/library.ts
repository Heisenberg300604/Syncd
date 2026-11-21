export interface IndexedFolder {
  id: string;
  path: string;
  dateAdded: string;
  lastScanned: string | null;
  trackCount: number;
}

export interface TrackRow {
  id: string;
  path: string;
  title: string;
  artist: string;
  album: string;
  durationSeconds: number;
  trackNumber: number | null;
  year: number | null;
  genre: string | null;
  format: string;
  bitrateKbps: number | null;
  hasArtwork: boolean;
  artworkHash: string | null;
}

export interface ScanProgress {
  indexed: number;
  total: number;
  currentFile: string;
}

export interface ScanCompleteEvent {
  total: number;
  inserted: number;
  cancelled: boolean;
}

export interface LibraryStats {
  trackCount: number;
  albumCount: number;
  artistCount: number;
  folderCount: number;
}

