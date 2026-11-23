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
 * Consolidates tracks belonging to the same album into a single Album entity.
 * Tracks with the same Album name are automatically grouped into ONE album,
 * intelligently resolving compilation/collaboration artists and preserving track ordering.
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

    // Grouping key:
    // Tracks with the same Album Title belong to the same album!
    let key: string;
    if (isMissingAlbum) {
      key = '__singles_unknown__';
    } else {
      const normAlbum = albumTitle.toLowerCase().trim();
      const explicitAlbumArtist = track.albumArtist?.trim().toLowerCase();
      if (explicitAlbumArtist) {
        key = `${normAlbum}___${explicitAlbumArtist}`;
      } else {
        // Check if an existing group with this album name already exists
        let matchedKey: string | null = null;
        const trackFolder = track.path
          ? track.path.replace(/\\/g, '/').split('/').slice(0, -1).join('/').toLowerCase()
          : '';
        const trackPrimary = primaryArtist.toLowerCase();

        for (const [existingKey, group] of albumMap.entries()) {
          if (existingKey === '__singles_unknown__') continue;
          if (group.album.toLowerCase().trim() !== normAlbum) continue;

          // Check if tracks share the same parent folder (e.g. D:\THE WALKER LEGACY)
          const groupFolders = new Set(
            group.tracks.map((t) =>
              t.path ? t.path.replace(/\\/g, '/').split('/').slice(0, -1).join('/').toLowerCase() : ''
            )
          );
          if (trackFolder && groupFolders.has(trackFolder)) {
            matchedKey = existingKey;
            break;
          }

          // Check if tracks share artists
          const groupArtists = new Set(
            group.tracks.map((t) => extractPrimaryArtist(t.artist).toLowerCase())
          );
          if (groupArtists.has(trackPrimary)) {
            matchedKey = existingKey;
            break;
          }

          // Same album title in the library -> merge into the existing album group
          matchedKey = existingKey;
          break;
        }

        key = matchedKey || normAlbum;
      }
    }

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

  // Finalize each album group: sort child tracks, resolve unified album artist & dominant format
  for (const group of albumMap.values()) {
    // 1. Sort child tracks by track number, then by file title
    group.tracks.sort((a, b) => {
      if (a.trackNumber != null && b.trackNumber != null && a.trackNumber !== b.trackNumber) {
        return a.trackNumber - b.trackNumber;
      }
      return a.title.localeCompare(b.title);
    });

    // 2. Resolve unified Album Artist
    if (group.isUnknownAlbum) {
      group.artist = 'Various Artists';
    } else {
      const explicitAlbumArtist = group.tracks.find((t) => t.albumArtist?.trim())?.albumArtist?.trim();

      if (explicitAlbumArtist) {
        group.artist = explicitAlbumArtist;
      } else {
        const distinctArtists = Array.from(
          new Set(group.tracks.map((t) => extractPrimaryArtist(t.artist)).filter(Boolean))
        );

        if (distinctArtists.length === 1) {
          group.artist = distinctArtists[0];
        } else {
          // Count frequency of artists in the album
          const counts = new Map<string, number>();
          for (const t of group.tracks) {
            const pa = extractPrimaryArtist(t.artist);
            counts.set(pa, (counts.get(pa) || 0) + 1);
          }
          let topArtist = '';
          let maxCount = 0;
          for (const [art, count] of counts.entries()) {
            if (count > maxCount) {
              maxCount = count;
              topArtist = art;
            }
          }

          // Check if an artist name shares words with the album title (e.g. "The Walkers" in "THE W4LKER LEG4CY")
          const cleanAlbumName = group.album
            .toLowerCase()
            .replace(/4/g, 'a')
            .replace(/3/g, 'e')
            .replace(/1/g, 'i')
            .replace(/0/g, 'o')
            .replace(/[^a-z0-9]/g, ' ');
          const albumKeywords = cleanAlbumName.split(/\s+/).filter((w) => w.length > 2);

          const matchingArtist = distinctArtists.find((art) => {
            const artWords = art.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
            return artWords.some((aw) => albumKeywords.some((kw) => kw.includes(aw) || aw.includes(kw)));
          });

          if (matchingArtist) {
            group.artist = matchingArtist;
          } else if (maxCount > group.tracks.length * 0.5) {
            group.artist = topArtist;
          } else {
            group.artist = 'Various Artists';
          }
        }
      }
    }

    // 3. Dominant format resolution
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
