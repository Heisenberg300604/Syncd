import { useEffect, useRef } from "react";

export function ReactiveDashedPill() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const glowBorderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    let rafId = 0;
    const startTime = performance.now();

    const samplePoints = 32;

    const CTRL_INDICES = [
      [1, -2, 3, -4],
      [9, -8, 7, -6],
      [5, 2, 5, -5],
      [-1, -3, 8, 9]
    ];

    const bez = (t: number, c: [number, number, number, number]) => {
      const w = 6.2831853 * t;
      return 0.5 * (c[0] * Math.sin(w) + c[1] * Math.cos(w) + c[2] * Math.sin(2.0 * w) + c[3] * Math.cos(2.0 * w));
    };

    const updateGlow = () => {
      if (!active) return;
      rafId = requestAnimationFrame(updateGlow);

      const container = containerRef.current;
      const glowBorder = glowBorderRef.current;
      if (!container || !glowBorder) return;

      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.bottom < 0 || rect.top > window.innerHeight) {
        return;
      }

      // Priority 1: High-precision direct WebGL GPU pixel sampling from Topography
      const win = window as unknown as {
        __sampleTopographyUnderRect?: (rect: { left: number; top: number; width: number; height: number }) => {
          intensities: Float32Array;
          count: number;
        } | null;
        __topographyTime?: number;
      };

      const activeSpots: Array<{ pct: number; intensity: number }> = [];

      let hasGpuSample = false;
      if (typeof win.__sampleTopographyUnderRect === "function") {
        const sample = win.__sampleTopographyUnderRect(rect);
        if (sample && sample.intensities) {
          hasGpuSample = true;
          const { intensities, count } = sample;
          for (let i = 0; i < count; i++) {
            const val = intensities[i];
            if (val > 0.08) {
              const pct = (i / (count - 1)) * 100;
              activeSpots.push({ pct, intensity: Math.min(1.0, val * 1.5) });
            }
          }
        }
      }

      // Fallback: Mathematical field evaluation matching the shader
      if (!hasGpuSample) {
        const timeSeconds =
          typeof win.__topographyTime === "number"
            ? win.__topographyTime
            : (performance.now() - startTime) / 1000;

        const sp = 0.35;
        const ma = 3.0;
        const msp = 0.05;
        const bands = 2.5;
        const thickness = 0.012;
        const glow = 0.65;

        const ctrl: [number, number, number, number][] = [];
        for (let g = 0; g < 4; g++) {
          const idx = CTRL_INDICES[g];
          const v: [number, number, number, number] = [0, 0, 0, 0];
          for (let j = 0; j < 4; j++) {
            const i = idx[j];
            v[j] = ma * Math.sin(timeSeconds * sp * Math.sin(i * msp) + i);
          }
          ctrl.push(v);
        }

        const centerY = rect.top + rect.height / 2;
        const uvY = (window.innerHeight - centerY) / window.innerHeight;

        for (let s = 0; s < samplePoints; s++) {
          const pct = (s / (samplePoints - 1)) * 100;
          const clientX = rect.left + (pct / 100) * rect.width;
          const uvX = clientX / window.innerWidth;

          const aX = bez(uvX, ctrl[0]);
          const aY = bez(uvX, ctrl[1]);
          const bX = bez(uvY, ctrl[2]);
          const bY = bez(uvY, ctrl[3]);
          const dX = aX - bX;
          const dY = aY - bY;
          const fv = Math.sqrt(dX * dX + dY * dY);

          const f = fv * bands;
          const frac = f - Math.floor(f);
          const lineDist = Math.min(frac, 1.0 - frac);

          const glowR = thickness + glow * 0.5 + 0.005;
          if (lineDist < glowR) {
            const intensity = 1.0 - (lineDist / glowR);
            if (intensity > 0.12) {
              activeSpots.push({ pct, intensity });
            }
          }
        }
      }

      if (activeSpots.length === 0) {
        glowBorder.style.opacity = "0";
        return;
      }

      // Merge contiguous active points into sharp radial glow peaks
      const maxInt = Math.max(...activeSpots.map((s) => s.intensity));
      const clampedOpacity = Math.min(1, Math.max(0.4, maxInt * 1.1));

      const masks = activeSpots.map((s) => {
        const radiusPx = Math.round(28 + s.intensity * 24);
        return `radial-gradient(ellipse ${radiusPx}px 48px at ${s.pct.toFixed(1)}% 50%, black 15%, transparent 100%)`;
      });

      const maskCss = masks.join(", ");
      glowBorder.style.webkitMaskImage = maskCss;
      glowBorder.style.maskImage = maskCss;
      glowBorder.style.opacity = clampedOpacity.toFixed(2);
    };

    rafId = requestAnimationFrame(updateGlow);

    return () => {
      active = false;
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center rounded-xl bg-white/[0.04] py-3.5 px-6 text-center overflow-hidden transition-colors"
    >
      {/* 1. Base quiet dashed outline (white/15) */}
      <div
        className="absolute inset-0 rounded-xl border border-dashed border-white/15 pointer-events-none"
        aria-hidden="true"
      />

      {/* 2. Ultra-accurate reactive glowing dashed outline — matches physical WebGL buffer pixels */}
      <div
        ref={glowBorderRef}
        className="absolute inset-0 rounded-xl border-[1.5px] border-dashed border-accent pointer-events-none transition-opacity duration-100"
        style={{
          opacity: 0,
          boxShadow:
            "0 0 16px 2px rgba(247, 162, 59, 0.75), inset 0 0 10px 1px rgba(247, 162, 59, 0.4)",
          filter: "drop-shadow(0 0 6px rgba(249, 115, 22, 0.9)) drop-shadow(0 0 2px rgba(255, 255, 255, 0.8))",
          willChange: "mask-image, -webkit-mask-image, opacity",
        }}
        aria-hidden="true"
      />

      {/* 3. Static text — remains calm and steady with no glow */}
      <span className="relative z-10 text-xs font-mono uppercase tracking-widest text-ink-faint select-none">
        Coming Soon
      </span>
    </div>
  );
}
