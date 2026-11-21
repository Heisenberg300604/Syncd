import React from 'react';

export interface AppLogoProps {
  size?: number;
  className?: string;
  showWordmark?: boolean;
  badge?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  size = 24,
  className = '',
  showWordmark = false,
  badge,
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Official SyncD Equalizer App Icon */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-sm"
      >
        <rect width="48" height="48" rx="12" fill="#12100e" />
        <rect width="48" height="48" rx="12" fill="url(#syncd-app-bg)" fillOpacity="0.22" stroke="var(--syncd-accent-primary, rgba(245, 158, 11, 0.25))" strokeOpacity="0.3" strokeWidth="1" />
        <g fill="url(#syncd-app-bars)">
          <rect x="9" y="19" width="5" height="10" rx="2.5" />
          <rect x="17" y="12" width="5" height="24" rx="2.5" />
          <rect x="25" y="21" width="5" height="6" rx="2.5" />
          <rect x="33" y="15" width="5" height="18" rx="2.5" />
        </g>
        <defs>
          <linearGradient id="syncd-app-bars" x1="9" y1="12" x2="38" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--syncd-accent-300, #fcd34d)" />
            <stop offset="1" stopColor="var(--syncd-accent-500, #f97316)" />
          </linearGradient>
          <linearGradient id="syncd-app-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--syncd-accent-500, #f59e0b)" />
            <stop offset="1" stopColor="var(--syncd-accent-600, #d97706)" />
          </linearGradient>
        </defs>
      </svg>

      {showWordmark && (
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-sm tracking-tight text-zinc-100">
            Sync<span className="text-amber-500">Desk</span>
          </span>
          {badge && (
            <span className="text-[9px] font-mono font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase tracking-wider">
              {badge}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

