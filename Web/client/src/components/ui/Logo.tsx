interface LogoProps {
  className?: string;
  /** Hide the "SyncD" wordmark and render the mark only. */
  markOnly?: boolean;
  /** Animate the equalizer bars. */
  animated?: boolean;
  /** px height of the mark. */
  size?: number;
}

/**
 * SyncD brand lockup — an audio-equalizer mark plus wordmark.
 *
 * The mark reads as sound and as synchronization: bars of different heights
 * settling into rhythm. Sky-blue gradient, matching the product accent.
 */
export function Logo({
  className = "",
  markOnly = false,
  animated = false,
  size = 24,
}: LogoProps) {
  const bars = [
    { x: 1, h: 9, delay: "0ms" },
    { x: 6.5, h: 16, delay: "160ms" },
    { x: 12, h: 6, delay: "320ms" },
    { x: 17.5, h: 13, delay: "80ms" },
    { x: 23, h: 10, delay: "240ms" },
  ];

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 26 26"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        {bars.map((bar) => (
          <rect
            key={bar.x}
            x={bar.x}
            y={13 - bar.h / 2}
            width="3"
            height={bar.h}
            rx="1.5"
            className={animated ? "syncd-eq-bar" : ""}
            style={
              animated
                ? { animationDelay: bar.delay, transformBox: "fill-box" }
                : undefined
            }
            fill="url(#syncd-logo-gradient)"
          />
        ))}
        <defs>
          <linearGradient
            id="syncd-logo-gradient"
            x1="0"
            y1="0"
            x2="26"
            y2="26"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#fcd34d" />
            <stop offset="1" stopColor="#f97316" />
          </linearGradient>
        </defs>
      </svg>
      {!markOnly && (
        <span className="text-lg font-bold tracking-tight text-ink">
          Sync<span className="text-accent">D</span>
        </span>
      )}
    </span>
  );
}
