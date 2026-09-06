interface EqualizerBarsProps {
  /** Animate the bars. When false they sit flat (paused / idle). */
  active?: boolean;
  className?: string;
}

const BARS = [
  { h: 10, delay: "0ms" },
  { h: 16, delay: "180ms" },
  { h: 7, delay: "360ms" },
  { h: 13, delay: "90ms" },
];

/** Compact audio-activity indicator used wherever playback is live. */
export function EqualizerBars({ active = true, className = "" }: EqualizerBarsProps) {
  return (
    <span
      className={`inline-flex items-end gap-[3px] ${className}`}
      aria-hidden="true"
    >
      {BARS.map((bar, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full bg-accent ${active ? "syncd-eq-bar" : ""}`}
          style={{
            height: bar.h,
            animationDelay: bar.delay,
            transformBox: "fill-box",
            transform: active ? undefined : "scaleY(0.35)",
          }}
        />
      ))}
    </span>
  );
}
