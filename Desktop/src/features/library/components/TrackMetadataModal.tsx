import React, { useState, useEffect, useRef } from 'react';
import {
  Music,
  Upload,
  Trash2,
  Info,
  Loader2,
  FileText,
} from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { CodecBadge } from '../../../components/ui/CodecBadge';
import { tauriBridge } from '../../../services/tauriBridge';
import { useLibraryStore } from '../../../stores/useLibraryStore';
import { useToastStore } from '../../../stores/useToastStore';
import { usePlayerStore } from '../../../stores/usePlayerStore';
import type { TrackRow } from '../../../types/library';
import type { DetailedAudioMetadata, TrackMetadataUpdate } from '../../../types/metadata';

interface TrackMetadataModalProps {
  isOpen: boolean;
  track: TrackRow | null;
  onClose: () => void;
  zIndex?: string;
}

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const TrackMetadataModal: React.FC<TrackMetadataModalProps> = ({
  isOpen,
  track,
  onClose,
  zIndex = "z-[70]",
}) => {
  const { updateTrackInStore, getArtworkUrl, artworkCache, getArtwork } = useLibraryStore();
  const { addToast } = useToastStore();
  const { currentTrack } = usePlayerStore();

  const [activeTab, setActiveTab] = useState<'tags' | 'properties'>('tags');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [detailedMeta, setDetailedMeta] = useState<DetailedAudioMetadata | null>(null);

  // Form states
  const [fileName, setFileName] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [albumArtist, setAlbumArtist] = useState('');
  const [trackNumber, setTrackNumber] = useState<string>('');
  const [trackTotal, setTrackTotal] = useState<string>('');
  const [discNumber, setDiscNumber] = useState<string>('');
  const [discTotal, setDiscTotal] = useState<string>('');
  const [year, setYear] = useState<string>('');
  const [genre, setGenre] = useState('');
  const [comment, setComment] = useState('');

  // Artwork state
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null);
  const [newArtworkBase64, setNewArtworkBase64] = useState<string | null>(null);
  const [removeArtworkMarked, setRemoveArtworkMarked] = useState(false);
  const [embedArtwork, setEmbedArtwork] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || !track) {
      setDetailedMeta(null);
      setNewArtworkBase64(null);
      setRemoveArtworkMarked(false);
      return;
    }

    // Initialize with quick track data
    const initialName = (track.path || '').split(/[/\\]/).pop() || '';
    setFileName(initialName);
    setTitle(track.title || '');
    setArtist(track.artist || '');
    setAlbum(track.album || '');
    setAlbumArtist('');
    setTrackNumber(track.trackNumber ? String(track.trackNumber) : '');
    setTrackTotal('');
    setDiscNumber('');
    setDiscTotal('');
    setYear(track.year ? String(track.year) : '');
    setGenre(track.genre || '');
    setComment('');
    setNewArtworkBase64(null);
    setRemoveArtworkMarked(false);
    setEmbedArtwork(true);

    // Initial artwork resolution
    const syncArt = getArtworkUrl(track.artworkHash) || artworkCache[track.id] || null;
    if (syncArt) {
      setArtworkPreview(syncArt);
    } else if (track.hasArtwork) {
      getArtwork(track.id).then((src) => {
        if (src) setArtworkPreview(src);
      });
    } else {
      setArtworkPreview(null);
    }

    // Load full detailed metadata from native engine
    setIsLoading(true);
    tauriBridge
      .readTrackMetadata(track.id)
      .then((meta) => {
        setDetailedMeta(meta);
        setTitle(meta.title || '');
        setArtist(meta.artist || '');
        setAlbum(meta.album || '');
        setAlbumArtist(meta.albumArtist || '');
        setTrackNumber(meta.trackNumber ? String(meta.trackNumber) : '');
        setTrackTotal(meta.trackTotal ? String(meta.trackTotal) : '');
        setDiscNumber(meta.discNumber ? String(meta.discNumber) : '');
        setDiscTotal(meta.discTotal ? String(meta.discTotal) : '');
        setYear(meta.year ? String(meta.year) : '');
        setGenre(meta.genre || '');
        setComment(meta.comment || '');
      })
      .catch((err) => {
        console.warn('Could not read detailed audio stream props:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, track]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setNewArtworkBase64(result);
      setRemoveArtworkMarked(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveArtwork = () => {
    setArtworkPreview(null);
    setNewArtworkBase64(null);
    setRemoveArtworkMarked(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!track) return;

    setIsSaving(true);
    try {
      const initialFileName = (track.path || '').split(/[/\\]/).pop() || '';
      const newFileNameToSend =
        fileName.trim() && fileName.trim() !== initialFileName ? fileName.trim() : undefined;

      // Ensure artwork shown in preview is converted to base64 so it is embedded directly into the file
      let finalArtworkBase64: string | undefined = undefined;
      if (!removeArtworkMarked && embedArtwork) {
        if (newArtworkBase64) {
          finalArtworkBase64 = newArtworkBase64;
        } else if (artworkPreview) {
          if (artworkPreview.startsWith('data:')) {
            finalArtworkBase64 = artworkPreview;
          } else {
            try {
              const res = await fetch(artworkPreview);
              const blob = await res.blob();
              finalArtworkBase64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(blob);
              });
              if (!finalArtworkBase64) finalArtworkBase64 = undefined;
            } catch (err) {
              console.warn('Could not read existing artwork for embedding:', err);
            }
          }
        }
      }

      // Helper: converts value to integer. If "0" or cleared from an existing value, sends 0 to remove tag
      const parseNumberWithZeroClearing = (val: string, hadExisting: boolean): number | undefined => {
        const trimmed = val.trim();
        if (trimmed === '0') return 0;
        if (trimmed === '') return hadExisting ? 0 : undefined;
        const n = parseInt(trimmed, 10);
        return isNaN(n) ? undefined : n;
      };

      const payload: TrackMetadataUpdate = {
        title: title.trim() || undefined,
        artist: artist.trim() || undefined,
        album: album.trim() || undefined,
        albumArtist: albumArtist.trim() || undefined,
        trackNumber: parseNumberWithZeroClearing(trackNumber, Boolean(detailedMeta?.trackNumber ?? track.trackNumber)),
        trackTotal: parseNumberWithZeroClearing(trackTotal, Boolean(detailedMeta?.trackTotal)),
        discNumber: parseNumberWithZeroClearing(discNumber, Boolean(detailedMeta?.discNumber)),
        discTotal: parseNumberWithZeroClearing(discTotal, Boolean(detailedMeta?.discTotal)),
        year: parseNumberWithZeroClearing(year, Boolean(track.year)),
        genre: genre.trim() || (detailedMeta?.genre ? '' : undefined),
        comment: comment.trim() || (detailedMeta?.comment ? '' : undefined),
        artworkBase64: finalArtworkBase64,
        removeArtwork: removeArtworkMarked ? true : undefined,
        newFileName: newFileNameToSend,
      };

      const updatedTrack = await tauriBridge.updateTrackMetadata(track.id, payload);

      // Update store and notify
      updateTrackInStore(updatedTrack);

      // If this track is currently loaded in the player, update it
      if (currentTrack?.id === track.id) {
        usePlayerStore.setState({
          currentTrack: {
            ...currentTrack,
            path: updatedTrack.path,
            title: updatedTrack.title,
            artist: updatedTrack.artist,
            album: updatedTrack.album,
          },
        });
      }

      addToast({
        type: 'success',
        title: 'Metadata & File Saved',
        message: `File tags, cover art, and disk file updated for "${updatedTrack.title}".`,
      });

      onClose();
    } catch (err: any) {
      console.error('Failed to save metadata:', err);
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Could not update audio tags on disk.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!track) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Track Metadata & Tag Editor"
      description={`Physical File: ${track.path}`}
      maxWidth="lg"
      zIndex={zIndex}
      overlayClassName="bg-black/85 backdrop-blur-md"
      className="max-w-2xl bg-zinc-900 border-zinc-800 text-zinc-100 shadow-2xl ring-1 ring-white/[0.08]"
    >
      {/* Header Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 -mt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('tags')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'tags'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            Tag Editor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('properties')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'properties'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            Audio Stream Details
          </button>
        </div>
        <div className="flex items-center gap-2">
          <CodecBadge format={track.format} bitrateKbps={track.bitrateKbps} size="sm" />
        </div>
      </div>

      {isLoading && (
        <div className="py-2 px-3 rounded-lg bg-zinc-950/60 border border-zinc-800/60 flex items-center gap-2 text-xs text-zinc-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
          Reading container headers & metadata directly from disk...
        </div>
      )}

      {activeTab === 'tags' ? (
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Artwork Column */}
            <div className="flex flex-col items-center gap-2 shrink-0 sm:w-40">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-36 h-36 rounded-xl border-2 border-dashed border-zinc-700 hover:border-amber-500/60 bg-zinc-950 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all group relative shadow-md"
                title="Click to change artwork"
              >
                {artworkPreview && !removeArtworkMarked ? (
                  <>
                    <img
                      src={artworkPreview}
                      alt="Cover Art"
                      className="w-full h-full object-cover group-hover:opacity-40 transition-opacity"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-amber-400 gap-1 text-[10px] font-medium">
                      <Upload className="w-4 h-4" />
                      <span>Replace</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-zinc-500 group-hover:text-amber-400 transition-colors p-2 text-center">
                    <Music className="w-8 h-8 stroke-[1.5]" />
                    <span className="text-[10px] leading-tight font-medium">Upload Cover</span>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="flex items-center gap-1.5 w-full">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 text-[10px] py-1 h-7"
                >
                  <Upload className="w-3 h-3 mr-1" />
                  Choose
                </Button>
                {(artworkPreview || track.hasArtwork) && !removeArtworkMarked && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveArtwork}
                    className="text-[10px] text-red-400 hover:text-red-300 hover:bg-red-950/30 py-1 h-7 px-2"
                    title="Remove artwork from audio file"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 hover:text-zinc-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={embedArtwork}
                  onChange={(e) => setEmbedArtwork(e.target.checked)}
                  className="rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-0 w-3 h-3"
                />
                <span>Embed directly into file</span>
              </label>
            </div>

            {/* Tag Inputs */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* File Name on Disk */}
              <div className="sm:col-span-2 flex flex-col gap-1.5 p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    File Name on Disk
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const parts = (fileName || track.path).split('.');
                        const ext = parts.length > 1 ? parts.pop() : 'wav';
                        const numPart = trackNumber.trim() ? `${trackNumber.trim()} - ` : '';
                        const cleanTitle = title.trim() || 'Track';
                        setFileName(`${numPart}${cleanTitle}.${ext}`);
                      }}
                      className="text-[10px] text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded transition-colors"
                      title="Set filename to [Track #] - [Title].[ext]"
                    >
                      # - Title
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const parts = (fileName || track.path).split('.');
                        const ext = parts.length > 1 ? parts.pop() : 'wav';
                        const cleanTitle = title.trim() || 'Track';
                        setFileName(`${cleanTitle}.${ext}`);
                      }}
                      className="text-[10px] text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 hover:bg-zinc-800 px-2 py-0.5 rounded transition-colors"
                      title="Set filename to [Title].[ext]"
                    >
                      Title only
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="e.g. 1 - Together.wav"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/80 text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/60 font-mono text-xs"
                />
                {detailedMeta?.format === 'mpeg' && fileName.toLowerCase().endsWith('.wav') && (
                  <div className="flex items-center justify-between mt-0.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-400">
                    <span>Detected true MP3 format inside .wav container</span>
                    <button
                      type="button"
                      onClick={() => setFileName(fileName.replace(/\.wav$/i, '.mp3'))}
                      className="font-medium underline hover:text-amber-300 ml-2"
                    >
                      Fix to .mp3
                    </button>
                  </div>
                )}
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-[11px] font-medium text-zinc-400">Track Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Bohemian Rhapsody"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/60"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-zinc-400">Artist</label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="e.g. Queen"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/60"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-zinc-400">Album Artist</label>
                <input
                  type="text"
                  value={albumArtist}
                  onChange={(e) => setAlbumArtist(e.target.value)}
                  placeholder="e.g. Queen"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/60"
                />
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-[11px] font-medium text-zinc-400">Album Name</label>
                <input
                  type="text"
                  value={album}
                  onChange={(e) => setAlbum(e.target.value)}
                  placeholder="e.g. A Night at the Opera"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-zinc-400">Track #</label>
                    <span className="text-[10px] text-zinc-600">0 to remove</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={trackNumber}
                    onChange={(e) => setTrackNumber(e.target.value)}
                    placeholder="e.g. 1 (0 to clear)"
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/60"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-zinc-400">Total Tracks</label>
                    <span className="text-[10px] text-zinc-600">0 to remove</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={trackTotal}
                    onChange={(e) => setTrackTotal(e.target.value)}
                    placeholder="e.g. 12 (0 to clear)"
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-zinc-400">Disc #</label>
                    <span className="text-[10px] text-zinc-600">0 to remove</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={discNumber}
                    onChange={(e) => setDiscNumber(e.target.value)}
                    placeholder="e.g. 1 (0 to clear)"
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/60"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-zinc-400">Year</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="1975"
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/60"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-[11px] font-medium text-zinc-400">Genre</label>
                <input
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="e.g. Classic Rock, Pop, Jazz"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/60"
                />
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-[11px] font-medium text-zinc-400">Comment</label>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Notes, liner notes, or comments"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/60"
                />
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800/80">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSaving || !title.trim()}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-4"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Writing Tags to Disk...
                </>
              ) : (
                'Save to Audio File'
              )}
            </Button>
          </div>
        </form>
      ) : (
        /* Audio Stream Details Tab */
        <div className="flex flex-col gap-4 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                Container Format
              </span>
              <span className="font-semibold text-zinc-200 uppercase">
                {detailedMeta?.format || track.format}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                Bitrate
              </span>
              <span className="font-semibold text-zinc-200">
                {detailedMeta?.bitrateKbps || track.bitrateKbps
                  ? `${detailedMeta?.bitrateKbps || track.bitrateKbps} kbps`
                  : 'VBR / Unknown'}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                Sample Rate
              </span>
              <span className="font-semibold text-zinc-200">
                {detailedMeta?.sampleRate ? `${detailedMeta.sampleRate} Hz` : '44,100 Hz (Std)'}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                Channels
              </span>
              <span className="font-semibold text-zinc-200">
                {detailedMeta?.channels === 1
                  ? 'Mono (1 ch)'
                  : detailedMeta?.channels === 2
                  ? 'Stereo (2 ch)'
                  : detailedMeta?.channels
                  ? `${detailedMeta.channels} channels`
                  : 'Stereo'}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                Bit Depth
              </span>
              <span className="font-semibold text-zinc-200">
                {detailedMeta?.bitDepth ? `${detailedMeta.bitDepth}-bit` : '16-bit'}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                Duration
              </span>
              <span className="font-semibold text-zinc-200">
                {formatDuration(detailedMeta?.durationSeconds || track.durationSeconds)} (
                {(detailedMeta?.durationSeconds || track.durationSeconds).toFixed(1)}s)
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                File Size
              </span>
              <span className="font-semibold text-zinc-200">
                {formatBytes(detailedMeta?.fileSizeBytes || 0)}
              </span>
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                Last Modified on Disk
              </span>
              <span className="font-semibold text-zinc-200 truncate">
                {detailedMeta?.dateModified
                  ? new Date(detailedMeta.dateModified).toLocaleString()
                  : 'Unknown'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/40">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
              Storage Location
            </span>
            <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 break-all select-all">
              {detailedMeta?.path || track.path}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => setActiveTab('tags')}>
              Back to Tag Editor
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
