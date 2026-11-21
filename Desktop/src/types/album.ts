import type { TrackRow } from './library';

export interface AlbumGroup {
  id: string;
  album: string;
  artist: string;
  year: number | null;
  tracks: TrackRow[];
  trackCount: number;
  totalDuration: number;
  artworkHash: string | null;
  hasArtwork: boolean;
  representativeTrackId: string;
  format?: string;
  isUnknownAlbum: boolean;
}

/**
 * Extracts the primary lead artist from collaborating artist strings.
 * E.g.:
 * - "Alan Walker/Noah Cyrus/Digital Farm Animals" -> "Alan Walker"
 * - "Alan Walker & Au/Ra" -> "Alan Walker"
 * - "Alan Walker feat. Sorana" -> "Alan Walker"
 * - "Yo Yo Honey Singh / Priyanshi" -> "Yo Yo Honey Singh"
 */
export function extractPrimaryArtist(artistStr?: string | null): string {
  if (!artistStr || !artistStr.trim()) return 'Unknown Artist';
  const raw = artistStr.trim();
  const segments = raw.split(/\s*(?:\/|;|\s+feat\.|\s+ft\.|\s+&|\s+with\s+|\s+vs\.?|,)\s*/i);
  if (segments && segments.length > 0 && segments[0].trim()) {
    return segments[0].trim();
  }
  return raw;
}

/**
 * Smart Album Grouping:
 * Consolidates tracks belonging to the same album into a single Album entity,
 * resolving different featuring artists into the unified primary artist.
 */
export function groupTracksByAlbum(
  tracks: TrackRow[],
  searchQuery?: string,
  sortOrder: 'asc' | 'desc' = 'asc'
): AlbumGroup[] {
  const albumMap = new Map<string, AlbumGroup>();

  for (const track of tracks) {
    const isMissingAlbum = !track.album || !track.album.trim();
    const albumTitle = isMissingAlbum ? 'Singles & Unknown Album' : track.album.trim();
    const primaryArtist = isMissingAlbum ? 'Various Artists' : extractPrimaryArtist(track.artist);

    // Grouping key: Normalized album title + primary artist
    // This merges all songs in "Different World" (regardless of feat. artists) into ONE album
    const key = isMissingAlbum
      ? '__singles_unknown__'
      : `${albumTitle.toLowerCase().trim()}___${primaryArtist.toLowerCase().trim()}`;

    let group = albumMap.get(key);
    if (!group) {
      group = {
        id: key,
        album: albumTitle,
        artist: primaryArtist,
        year: track.year || null,
        tracks: [],
        trackCount: 0,
        totalDuration: 0,
        artworkHash: track.artworkHash,
        hasArtwork: track.hasArtwork,
        representativeTrackId: track.id,
        format: track.format,
        isUnknownAlbum: isMissingAlbum,
      };
      albumMap.set(key, group);
    }

    group.tracks.push(track);
    group.trackCount += 1;
    group.totalDuration += track.durationSeconds;

    if (!group.hasArtwork && track.hasArtwork) {
      group.hasArtwork = true;
      group.artworkHash = track.artworkHash;
      group.representativeTrackId = track.id;
    }
    if (!group.year && track.year) {
      group.year = track.year;
    }
  }

  // Finalize each album group: sort child tracks & resolve dominant format
  for (const group of albumMap.values()) {
    group.tracks.sort((a, b) => {
      if (a.trackNumber != null && b.trackNumber != null && a.trackNumber !== b.trackNumber) {
        return a.trackNumber - b.trackNumber;
      }
      return a.title.localeCompare(b.title);
    });

    const formats = Array.from(new Set(group.tracks.map((t) => t.format).filter(Boolean)));
    if (formats.some((f) => f.toLowerCase() === 'flac')) {
      group.format = 'FLAC';
    } else if (formats.some((f) => f.toLowerCase() === 'wav' || f.toLowerCase() === 'wave')) {
      group.format = 'WAV';
    } else if (formats.length > 0) {
      group.format = formats[0].toUpperCase();
    }
  }

  let albumList = Array.from(albumMap.values());

  // Filter if searchQuery is provided (matches album title, artist, or any child track)
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    albumList = albumList.filter((g) => {
      if (g.album.toLowerCase().includes(q)) return true;
      if (g.artist.toLowerCase().includes(q)) return true;
      return g.tracks.some(
        (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
      );
    });
  }

  // Sort album groups by album title, keeping "Singles & Unknown Album" at the end
  albumList.sort((a, b) => {
    if (a.isUnknownAlbum) return 1;
    if (b.isUnknownAlbum) return -1;
    const cmp = a.album.localeCompare(b.album);
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  return albumList;
}
