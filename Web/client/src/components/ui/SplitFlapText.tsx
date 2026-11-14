import { useEffect, useRef, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                   */
/* -------------------------------------------------------------------------- */

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Random flips before each character settles. */
const FLAP_COUNT = 12;
/** ms between each flip tick. */
const TICK_MS = 45;
/** ms stagger between character columns (left → right). */
const STAGGER_MS = 60;

/* -------------------------------------------------------------------------- */
/*  Single character cell                                                       */
/* -------------------------------------------------------------------------- */

function FlapCell({
  target,
  delay,
  active,
}: {
  target: string;
  delay: number;
  active: boolean;
}) {
  const [display, setDisplay] = useState(" ");
  const [settling, setSettling] = useState(false);
  const isStatic = target === " " || target === "-";

  useEffect(() => {
    if (!active || isStatic) return;

    const t = setTimeout(() => {
      let flaps = 0;
      setSettling(true);
      const id = setInterval(() => {
        setDisplay(CHARSET[Math.floor(Math.random() * CHARSET.length)]);
        if (++flaps >= FLAP_COUNT) {
          clearInterval(id);
          setDisplay(target);
          setSettling(false);
        }
      }, TICK_MS);
    }, delay);

    return () => clearTimeout(t);
  }, [active, target, delay, isStatic]);

  return (
    <span
      className={[
        "relative inline-flex h-9 w-[22px] select-none flex-col items-center justify-center overflow-hidden",
        "rounded-[3px] bg-[#111009] font-mono text-[14px] font-bold tracking-tight",
        "border border-white/[0.07]",
        settling ? "text-amber-200" : "text-amber-400",
        "transition-colors duration-75",
      ].join(" ")}
    >
      {/* top-half sheen */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-[45%] bg-white/[0.025]" aria-hidden />
      {/* hinge line */}
      <span className="pointer-events-none absolute inset-x-0 top-[45%] h-px bg-black/80" aria-hidden />
      {isStatic ? target : display}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Public component                                                            */
/* -------------------------------------------------------------------------- */

export function SplitFlapText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const [active, setActive] = useState(() => typeof IntersectionObserver === "undefined");
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setActive(true); obs.unobserve(el); } },
      { threshold: 0.6 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const chars = text.toUpperCase().split("");

  return (
    <span
      ref={ref}
      className={`inline-flex items-center gap-[2px] ${className}`}
      aria-label={text}
    >
      {chars.map((ch, i) =>
        ch === "-" ? (
          <span key={i} className="mx-[3px] font-mono text-[12px] font-bold text-amber-500/50 select-none">
            —
          </span>
        ) : (
          <FlapCell key={i} target={ch} delay={i * STAGGER_MS} active={active} />
        )
      )}
    </span>
  );
}
