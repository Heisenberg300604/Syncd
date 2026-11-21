import React from 'react';

export const TrackCardSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col justify-between p-3 rounded-2xl bg-zinc-900/40 border border-zinc-800/40 select-none animate-pulse">
      {/* Artwork placeholder */}
      <div className="relative aspect-square w-full rounded-xl bg-zinc-800/50 overflow-hidden flex items-center justify-center">
        <div className="w-8 h-8 rounded-full bg-zinc-700/30" />
      </div>

      {/* Meta text placeholders */}
      <div className="mt-3 flex flex-col gap-2">
        <div className="h-3 w-4/5 bg-zinc-800/80 rounded-md" />
        <div className="h-2.5 w-1/2 bg-zinc-800/40 rounded-md" />
      </div>

      {/* Bottom badge / duration placeholder */}
      <div className="mt-3.5 flex items-center justify-between pt-1 border-t border-zinc-900/60">
        <div className="h-2 w-8 bg-zinc-800/30 rounded" />
        <div className="h-2 w-10 bg-zinc-800/40 rounded" />
      </div>
    </div>
  );
};
