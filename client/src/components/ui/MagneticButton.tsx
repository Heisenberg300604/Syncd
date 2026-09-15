import {
  useRef,
  useState,
  useCallback,
  type ReactNode,
  type CSSProperties,
} from "react";

interface MagneticButtonProps {
  children: ReactNode;
  /**
   * How strongly the button follows the cursor.
   * 0.3 = 30 % of the distance from centre. Default: 0.35.
   */
  /** 0.2 = 20% of cursor distance from centre. Default: 0.2. */
  strength?: number;
  /** Extra class names applied to the magnetic wrapper. */
  className?: string;
}

/**
 * Wraps any child in a magnetic-pull layer.
 * The child translates toward the cursor while hovering and springs back on leave.
 * Works on pointer devices only; touch is unaffected.
 */
export function MagneticButton({
  children,
  strength = 0.04,
  className = "",
}: MagneticButtonProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const rafRef = useRef<number | null>(null);

  const handleMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = wrapRef.current;
      if (!el) return;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        setOffset({
          x: (e.clientX - cx) * strength,
          y: (e.clientY - cy) * strength,
        });
      });
    },
    [strength]
  );

  const handleEnter = useCallback(() => setActive(true), []);

  const handleLeave = useCallback(() => {
    setActive(false);
    setOffset({ x: 0, y: 0 });
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const style: CSSProperties = {
    transform: `translate(${offset.x}px, ${offset.y}px)`,
    transition: active
      ? "transform 0.25s cubic-bezier(0.23, 1, 0.32, 1)"
      : "transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)",
    willChange: "transform",
    display: "inline-flex",
  };

  return (
    /* Oversized hit-zone — cursor enters before reaching the button */
    <div
      ref={wrapRef}
      onPointerEnter={handleEnter}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      /* 40px padding so the magnet starts pulling before the cursor hits the edge */
      className={`relative inline-flex cursor-pointer p-[24px] -m-[24px] ${className}`}
      style={{ touchAction: "auto" }}
    >
      <div style={style}>{children}</div>
    </div>
  );
}
