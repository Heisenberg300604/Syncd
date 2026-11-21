import React from "react";
import { WifiOff } from "lucide-react";

export interface OfflineBannerProps {
  isOffline: boolean;
  message?: string;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOffline,
  message = "Offline Mode: Local music library is active. Social rooms require an internet connection.",
}) => {
  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="bg-zinc-900 border-b border-amber-500/20 px-4 py-1.5 flex items-center justify-center gap-2 text-[11px] text-amber-300 select-none animate-in slide-in-from-top-1"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>{message}</span>
    </div>
  );
};

