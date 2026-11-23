import React, { useState, useEffect, useRef } from 'react';
import {
  Disc3,
  Upload,
  Trash2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { tauriBridge } from '../../../services/tauriBridge';
import { useLibraryStore } from '../../../stores/useLibraryStore';
import { useToastStore } from '../../../stores/useToastStore';
import type { AlbumGroup } from '../../../types/album';
import type { AlbumMetadataUpdatePayload } from '../../../types/metadata';

interface AlbumMetadataModalProps {
  isOpen: boolean;
  album: AlbumGroup | null;
  onClose: () => void;
  zIndex?: string;
}

export const AlbumMetadataModal: React.FC<AlbumMetadataModalProps> = ({
  isOpen,
  album,
  onClose,
  zIndex = "z-[70]",
}) => {
  const { updateTracksInStore, getArtworkUrl, artworkCache, getArtwork } = useLibraryStore();
  const { addToast } = useToastStore();

  const [albumName, setAlbumName] = useState('');
  const [albumArtist, setAlbumArtist] = useState('');
  const [year, setYear] = useState<string>('');
  const [genre, setGenre] = useState('');

  // Artwork
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null);
  const [artworkBase64, setArtworkBase64] = useState<string | null>(null);
  const [removeArtworkMarked, setRemoveArtworkMarked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !album) {
      setArtworkBase64(null);
      setRemoveArtworkMarked(false);
      return;
    }

    setAlbumName(album.album || '');
    setAlbumArtist(album.artist || '');
    setYear(album.year ? String(album.year) : '');
    setGenre(album.tracks[0]?.genre || '');
    setArtworkBase64(null);
    setRemoveArtworkMarked(false);

    const sync =
      (album.artworkHash ? getArtworkUrl(album.artworkHash) : null) ||
      artworkCache[album.representativeTrackId] ||
      null;

    if (sync) {
      setArtworkPreview(sync);
    } else if (album.hasArtwork) {
      getArtwork(album.representativeTrackId).then((src) => {
        if (src) setArtworkPreview(src);
      });
    } else {
      setArtworkPreview(null);
    }
  }, [isOpen, album]);

  const handleArtworkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast({
        type: 'error',
        title: 'Invalid File',
        message: 'Please choose an image file (JPEG, PNG, WebP).',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setArtworkPreview(result);
      setArtworkBase64(result);
      setRemoveArtworkMarked(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveArtwork = () => {
    setArtworkPreview(null);
    setArtworkBase64(null);
    setRemoveArtworkMarked(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!album || !albumName.trim()) return;

    const trackIds = album.tracks.map((t) => t.id);
    if (trackIds.length === 0) return;

    setIsSaving(true);
    try {
      const payload: AlbumMetadataUpdatePayload = {
        album: albumName.trim(),
        albumArtist: albumArtist.trim() || undefined,
        year: year.trim() ? parseInt(year, 10) : undefined,
        genre: genre.trim() || undefined,
        artworkBase64: artworkBase64 || undefined,
        removeArtwork: removeArtworkMarked ? true : undefined,
      };

      const updatedTracks = await tauriBridge.updateAlbumMetadata(trackIds, payload);

      updateTracksInStore(updatedTracks);

      addToast({
        type: 'success',
        title: 'Album Metadata Saved',
        message: `Updated tags in all ${updatedTracks.length} audio files on disk.`,
      });

      onClose();
    } catch (err: any) {
      console.error('Failed to update album metadata:', err);
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Could not update album audio tags.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!album) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Album Metadata"
      description={`Batch editing ${album.trackCount} tracks in "${album.album}"`}
      maxWidth="md"
      zIndex={zIndex}
      overlayClassName="bg-black/85 backdrop-blur-md"
      className="max-w-lg bg-zinc-900 border-zinc-800 text-zinc-100 shadow-2xl ring-1 ring-white/[0.08]"
    >
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {/* Warning Banner */}
        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <span>
            Saving will batch-write these metadata tags and artwork directly into every audio track
            file in this album on your disk.
          </span>
        </div>

        {/* Artwork & Album Fields */}
        <div className="flex gap-4 items-start">
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-zinc-700 hover:border-amber-500/70 bg-zinc-950 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all group relative shadow-md"
            >
              {artworkPreview && !removeArtworkMarked ? (
                <>
                  <img
                    src={artworkPreview}
                    alt="Album Cover"
                    className="w-full h-full object-cover group-hover:opacity-40 transition-opacity"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-amber-400 text-[10px] font-medium">
                    <Upload className="w-3.5 h-3.5 mb-1" />
                    Replace
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 text-zinc-500 group-hover:text-amber-400 p-2 text-center">
                  <Disc3 className="w-6 h-6 stroke-[1.5]" />
                  <span className="text-[9px] font-medium">Add Cover</span>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleArtworkChange}
              className="hidden"
            />

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] h-6 px-2"
              >
                Upload
              </Button>
              {(artworkPreview || album.hasArtwork) && !removeArtworkMarked && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveArtwork}
                  className="text-[10px] text-red-400 hover:text-red-300 h-6 px-1.5"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-2.5 text-xs">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-zinc-400">
                Album Title <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                value={albumName}
                onChange={(e) => setAlbumName(e.target.value)}
                placeholder="Album title"
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/60"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-zinc-400">Album Artist</label>
              <input
                type="text"
                value={albumArtist}
                onChange={(e) => setAlbumArtist(e.target.value)}
                placeholder="Artist or Various Artists"
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/60"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-zinc-400">Release Year</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="e.g. 2024"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/60"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-zinc-400">Genre</label>
                <input
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="Genre"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/60"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800/80">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSaving || !albumName.trim()}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-4"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Writing to {album.trackCount} Files...
              </>
            ) : (
              `Save to All ${album.trackCount} Tracks`
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
