import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Sparkles,
  Music,
  Crown,
  AlertCircle,
  RotateCcw,
  RotateCw,
  Square,
  SkipForward,
  RefreshCw,
  Search,
  Subtitles,
} from 'lucide-react';
import { useRoomStore } from '../../../stores/useRoomStore';
import { useLibraryStore } from '../../../stores/useLibraryStore';
import { useToastStore } from '../../../stores/useToastStore';
import { useYouTubePlayer, type PlayerState } from '../../../hooks/useYouTubePlayer';
import { Badge } from '../../../components/ui/Badge';

export interface YouTubeRoomPlayerProps {
  onFocusSearch?: () => void;
}

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

export const YouTubeRoomPlayer: React.FC<YouTubeRoomPlayerProps> = ({ onFocusSearch }) => {
  const { playback, isHost, controlPlayback, playNextInQueue, queue } = useRoomStore();
  const { tracks } = useLibraryStore();
  const { addToast } = useToastStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [localMuted, setLocalMuted] = useState(false);
  const [volume, setVolumeState] = useState(100);
  const [matchingLocalTrack, setMatchingLocalTrack] = useState<{ id: string; title: string; artist: string } | null>(null);

  // Scrubber drag state
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [dragSeekTime, setDragSeekTime] = useState(0);

  // Guard against echo-loops during local user interactions
  const lastUserActionTimestampRef = useRef<number>(0);
  const loadedVideoIdRef = useRef<string | null>(null);

  // Hook into the official YouTube IFrame engine
  const player = useYouTubePlayer(containerRef, {
    onEnded: () => {
      if (isHost) {
        playNextInQueue();
      }
    },
    onStateChange: (state: PlayerState, currentTime: number) => {
      // If host pauses or plays via native player event
      if (isHost && (Date.now() - lastUserActionTimestampRef.current > 2000)) {
        if (state === 'playing' && !playback?.isPlaying) {
          controlPlayback('play', currentTime);
        } else if (state === 'paused' && playback?.isPlaying) {
          controlPlayback('pause', currentTime);
        }
      }
    },
  });

  // Check if track exists in user's personal offline SQLite music collection
  useEffect(() => {
    if (!playback?.title) {
      setMatchingLocalTrack(null);
      return;
    }

    const cleanTitle = playback.title.toLowerCase();
    const matched = tracks.find((t) =>
      cleanTitle.includes(t.title.toLowerCase()) || (t.artist && cleanTitle.includes(t.artist.toLowerCase()))
    );

    if (matched) {
      setMatchingLocalTrack({ id: matched.id, title: matched.title, artist: matched.artist });
    } else {
      setMatchingLocalTrack(null);
    }
  }, [playback?.title, tracks]);

  // Synchronize track selection with YouTube IFrame API
  useEffect(() => {
    if (!playback?.videoId) {
      loadedVideoIdRef.current = null;
      return;
    }

    if (player.ready && loadedVideoIdRef.current !== playback.videoId) {
      loadedVideoIdRef.current = playback.videoId;

      const serverTimeMs = playback.serverTime ? Date.parse(playback.serverTime) : Date.now();
      const updatedAtMs = playback.updatedAt ? Date.parse(playback.updatedAt) : serverTimeMs;
      const elapsedSeconds = playback.isPlaying ? Math.max(0, (serverTimeMs - updatedAtMs) / 1000) : 0;
      const startPosition = (playback.position || 0) + elapsedSeconds;

      if (playback.isPlaying) {
        player.loadVideo(playback.videoId, startPosition);
      } else {
        player.cueVideo(playback.videoId, startPosition);
      }
    }
  }, [playback?.videoId, playback?.isPlaying, playback?.position, playback?.serverTime, playback?.updatedAt, player.ready, player]);

  // Synchronize Play/Pause State
  useEffect(() => {
    if (!player.ready || !playback?.videoId) return;

    // Suppress local echo within 2 seconds of user action
    if (Date.now() - lastUserActionTimestampRef.current < 2000) return;

    if (playback.isPlaying && player.state === 'paused') {
      player.play();
    } else if (!playback.isPlaying && player.state === 'playing') {
      player.pause();
    }
  }, [playback?.isPlaying, player.ready, player.state, player]);

  // Bounded Drift Reconciler (5-second polling interval with 2.0s threshold)
  const reconcileDrift = useCallback(() => {
    if (!player.ready || !playback || !playback.isPlaying || !playback.updatedAt) return;

    // Echo suppression: ignore if local action occurred within 2000ms
    if (Date.now() - lastUserActionTimestampRef.current < 2000) return;

    const serverTimeMs = playback.serverTime ? Date.parse(playback.serverTime) : Date.now();
    const updatedAtMs = Date.parse(playback.updatedAt);
    const elapsedSeconds = Math.max(0, (serverTimeMs - updatedAtMs) / 1000);
    const expectedPlayhead = playback.position + elapsedSeconds;

    const actualPlayhead = player.getCurrentTime();
    const driftSeconds = Math.abs(expectedPlayhead - actualPlayhead);

    // Reconcile only if drift exceeds 2.0 seconds
    if (driftSeconds > 2.0) {
      player.seekTo(expectedPlayhead);
    }
  }, [playback, player]);

  useEffect(() => {
    const interval = setInterval(reconcileDrift, 5000);
    return () => clearInterval(interval);
  }, [reconcileDrift]);

  // Volume & Mute Handlers
  const toggleMute = () => {
    if (localMuted) {
      player.unMute();
      setLocalMuted(false);
    } else {
      player.mute();
      setLocalMuted(true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseInt(e.target.value, 10);
    setVolumeState(newVol);
    player.setVolume(newVol);
    if (newVol > 0 && localMuted) {
      player.unMute();
      setLocalMuted(false);
    }
  };

  // Playback Control Actions
  const handleTogglePlay = async () => {
    if (!isHost || !playback?.videoId) return;
    lastUserActionTimestampRef.current = Date.now();
    const nextState = !playback.isPlaying;
    const currentPos = player.getCurrentTime();

    if (nextState) {
      player.play();
    } else {
      player.pause();
    }

    await controlPlayback(nextState ? 'play' : 'pause', currentPos);
  };

  const handleSeekCommit = async () => {
    if (!isHost || !playback?.videoId) return;
    setIsDraggingSeek(false);
    lastUserActionTimestampRef.current = Date.now();
    player.seekTo(dragSeekTime);
    await controlPlayback('seek', dragSeekTime);
  };

  const handleSeekRelative = async (deltaSeconds: number) => {
    if (!isHost || !playback?.videoId) return;
    lastUserActionTimestampRef.current = Date.now();
    const cur = player.getCurrentTime();
    const dur = player.duration || (playback.duration ? parseFloat(playback.duration) : 0) || Infinity;
    const target = Math.max(0, Math.min(dur, cur + deltaSeconds));
    player.seekTo(target);
    await controlPlayback('seek', target);
  };

  const handleStop = async () => {
    if (!isHost || !playback?.videoId) return;
    lastUserActionTimestampRef.current = Date.now();
    player.seekTo(0);
    player.pause();
    await controlPlayback('pause', 0);
  };

  const handleSkipNext = async () => {
    if (!isHost) return;
    if (queue.length > 0) {
      await playNextInQueue();
      addToast({
        type: 'info',
        title: 'Skipped Track',
        message: 'Playing next song in room queue.',
      });
    } else {
      addToast({
        type: 'warning',
        title: 'Queue is Empty',
        message: 'Add more songs to the room queue to skip.',
      });
    }
  };

  const handleResync = () => {
    if (!player.ready || !playback || !playback.updatedAt) return;
    const serverTimeMs = playback.serverTime ? Date.parse(playback.serverTime) : Date.now();
    const updatedAtMs = Date.parse(playback.updatedAt);
    const elapsedSeconds = playback.isPlaying ? Math.max(0, (serverTimeMs - updatedAtMs) / 1000) : 0;
    const expectedPlayhead = (playback.position || 0) + elapsedSeconds;

    player.seekTo(expectedPlayhead);
    if (playback.isPlaying && player.state !== 'playing') {
      player.play();
    }
    addToast({
      type: 'info',
      title: 'Synced with Host',
      message: `Audio aligned to ${formatDuration(expectedPlayhead)}.`,
    });
  };

  const handleToggleCaptions = () => {
    player.toggleCaptions();
    const nextState = !player.captionsEnabled;
    addToast({
      type: 'info',
      title: nextState ? 'Closed Captions Enabled' : 'Closed Captions Disabled',
      message: nextState ? 'Showing English subtitles where available.' : 'Subtitles turned off.',
    });
  };

  // Timeline values
  const displayTime = isDraggingSeek ? dragSeekTime : player.currentTime;
  const totalDuration = player.duration || (playback?.duration ? parseFloat(playback.duration) : 0) || 0;
  const progressPercent = totalDuration > 0 ? Math.min(100, Math.max(0, (displayTime / totalDuration) * 100)) : 0;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Pristine Local SQLite Match Pill */}
      {matchingLocalTrack && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-zinc-200">
              Lossless file found in your library: <strong className="text-amber-400">{matchingLocalTrack.title}</strong>
            </span>
          </div>
          <Badge variant="amber" className="text-[10px]">
            Lossless Synced
          </Badge>
        </div>
      )}

      {/* YouTube Video Player Container */}
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl group">
        {/* DOM Mount Point for window.YT.Player */}
        <div ref={containerRef} className="w-full h-full object-cover" />

        {/* Standby Overlay when no video is currently selected */}
        {!playback?.videoId && (
          <div className="absolute inset-0 bg-zinc-950/90 flex flex-col items-center justify-center text-center p-8 z-10">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-500 mb-3 shadow-inner">
              <Music className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-zinc-200 mb-1">Room Audio Standby</h3>
            <p className="text-xs text-zinc-400 max-w-sm">
              {isHost
                ? 'Add a song to the queue or search YouTube to start social playback for everyone.'
                : 'Waiting for the room host to start playing a track.'}
            </p>
          </div>
        )}

        {/* Error Overlay if YouTube stream is restricted */}
        {player.error && playback?.videoId && (
          <div className="absolute inset-0 bg-zinc-950/90 flex flex-col items-center justify-center text-center p-6 gap-2 z-20">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-xs font-semibold text-zinc-200">{player.error}</p>
            {isHost && (
              <button
                type="button"
                onClick={playNextInQueue}
                className="mt-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 cursor-pointer"
              >
                Skip to Next Track
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dedicated Floating Playback Control Deck (Android Parity) */}
      <div className="w-full bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
        {!playback?.videoId ? (
          /* Standby State */
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Music className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200">Room Audio Standby</h4>
                <p className="text-[11px] text-zinc-500">
                  {isHost
                    ? 'No track broadcasting. Use the search pill above or pick from queue to play.'
                    : 'Waiting for room host to broadcast audio.'}
                </p>
              </div>
            </div>
            {isHost && onFocusSearch && (
              <button
                type="button"
                onClick={onFocusSearch}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search YouTube</span>
              </button>
            )}
          </div>
        ) : (
          /* Active Track Control Deck */
          <>
            {/* Header: Track Title & Broadcast State */}
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-zinc-100 truncate" title={playback.title}>
                  {playback.title}
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                  <span className="flex items-center gap-1 text-amber-400 font-medium">
                    <Crown className="w-3 h-3" />
                    Host Synchronized
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5 font-mono">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        playback.isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                      }`}
                    />
                    {playback.isPlaying ? 'Broadcasting live' : 'Paused by host'}
                  </span>
                </div>
              </div>

              {/* Listener Resync / Host Queue Info */}
              <div className="flex items-center gap-2 shrink-0">
                {!isHost && (
                  <button
                    type="button"
                    onClick={handleResync}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-all cursor-pointer active:scale-95"
                    title="Resync to exact host broadcast position"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Resync Audio</span>
                  </button>
                )}
              </div>
            </div>

            {/* Interactive Timeline Scrubber */}
            <div className="flex items-center gap-3 w-full pt-1">
              <span className="text-[11px] font-mono text-zinc-400 w-10 text-right shrink-0">
                {formatDuration(displayTime)}
              </span>

              <div className="relative flex-1 flex items-center group py-2">
                {/* Background Track */}
                <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden relative">
                  {/* Progress Fill */}
                  <div
                    className="h-full bg-amber-500 group-hover:bg-amber-400 transition-[background-color]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Range Input: Draggable for Host */}
                {isHost && (
                  <input
                    type="range"
                    min={0}
                    max={totalDuration || 1}
                    step={0.5}
                    value={displayTime}
                    onChange={(e) => {
                      setIsDraggingSeek(true);
                      setDragSeekTime(parseFloat(e.target.value));
                    }}
                    onMouseUp={handleSeekCommit}
                    onTouchEnd={handleSeekCommit}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                    title="Drag to seek room audio"
                  />
                )}

                {/* Scrubber Thumb */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)] pointer-events-none transition-transform group-hover:scale-125"
                  style={{ left: `${progressPercent}%` }}
                />
              </div>

              <span className="text-[11px] font-mono text-zinc-400 w-10 text-left shrink-0">
                {formatDuration(totalDuration)}
              </span>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between gap-4 pt-1">
              {/* Left Placeholder for visual balance */}
              <div className="hidden sm:flex items-center text-[11px] text-zinc-500 min-w-[120px]">
                {queue.length > 0 ? (
                  <span>
                    Queue: <strong className="text-zinc-300 font-mono">{queue.length}</strong> {queue.length === 1 ? 'track' : 'tracks'}
                  </span>
                ) : (
                  <span>Queue empty</span>
                )}
              </div>

              {/* Main Playback Buttons */}
              <div className="flex items-center gap-2 mx-auto">
                {isHost ? (
                  <>
                    {/* Stop */}
                    <button
                      type="button"
                      onClick={handleStop}
                      className="p-2 px-3 rounded-xl bg-zinc-900/80 hover:bg-red-950/40 border border-zinc-800 hover:border-red-500/40 text-zinc-400 hover:text-red-400 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      title="Stop and reset playback"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span className="hidden md:inline">Stop</span>
                    </button>

                    {/* Rewind 10s */}
                    <button
                      type="button"
                      onClick={() => handleSeekRelative(-10)}
                      className="p-2 px-3 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      title="Rewind 10 seconds"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>-10s</span>
                    </button>

                    {/* Play / Pause */}
                    <button
                      type="button"
                      onClick={handleTogglePlay}
                      className="w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-zinc-950 flex items-center justify-center transition-all shadow-lg shadow-amber-500/25 cursor-pointer mx-1"
                      title={playback.isPlaying ? 'Pause for all' : 'Play for all'}
                    >
                      {playback.isPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </button>

                    {/* Forward 10s */}
                    <button
                      type="button"
                      onClick={() => handleSeekRelative(10)}
                      className="p-2 px-3 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      title="Forward 10 seconds"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>+10s</span>
                    </button>

                    {/* Skip */}
                    <button
                      type="button"
                      onClick={handleSkipNext}
                      disabled={queue.length === 0}
                      className="p-2 px-3 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={queue.length > 0 ? `Skip to next track (${queue.length} in queue)` : 'Queue is empty'}
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      <span>Skip</span>
                      {queue.length > 0 && (
                        <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-mono font-bold">
                          {queue.length}
                        </span>
                      )}
                    </button>
                  </>
                ) : (
                  /* Listener Info */
                  <div className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-zinc-950/40 border border-zinc-800/60 text-xs text-zinc-400">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span>Host controls playback for this room</span>
                  </div>
                )}
              </div>

              {/* CC, Volume & Mute */}
              <div className="flex items-center gap-2 min-w-[170px] justify-end">
                {/* Closed Captions Toggle */}
                <button
                  type="button"
                  onClick={handleToggleCaptions}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                    player.captionsEnabled
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                      : 'bg-zinc-900/80 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                  title={player.captionsEnabled ? 'Turn Off Closed Captions (CC)' : 'Turn On Closed Captions (CC)'}
                >
                  <Subtitles className="w-3.5 h-3.5" />
                  <span>CC</span>
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer border border-zinc-800"
                  title={localMuted ? 'Unmute' : 'Mute'}
                >
                  {localMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={localMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-18 accent-amber-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                  title={`Volume: ${localMuted ? 0 : volume}%`}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
