import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type FC,
  type ReactNode
} from "react";

export interface ScrollRevealProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  animation?: "fade-up" | "fade-down" | "fade-left" | "fade-right" | "zoom-in" | "blur-in";
  distance?: number;
  duration?: number;
  delay?: number;
  threshold?: number;
  rootMargin?: string;
  blur?: boolean;
  once?: boolean;
}

export const ScrollReveal: FC<ScrollRevealProps> = ({
  children,
  as: Component = "div",
  className = "",
  style = {},
  animation = "fade-up",
  distance = 28,
  duration = 850,
  delay = 0,
  threshold = 0.1,
  rootMargin = "0px 0px -60px 0px",
  blur = true,
  once = true,
}) => {
  const ref = useRef<HTMLElement | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setIsRevealed(true);
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setIsRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsRevealed(true);
          if (once) {
            observer.unobserve(el);
          }
        } else if (!once) {
          setIsRevealed(false);
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, once]);

  const getInitialTransform = () => {
    switch (animation) {
      case "fade-up":
        return `translate3d(0, ${distance}px, 0)`;
      case "fade-down":
        return `translate3d(0, -${distance}px, 0)`;
      case "fade-left":
        return `translate3d(-${distance}px, 0, 0)`;
      case "fade-right":
        return `translate3d(${distance}px, 0, 0)`;
      case "zoom-in":
        return `scale(0.92) translate3d(0, ${distance * 0.5}px, 0)`;
      case "blur-in":
        return `scale(0.97)`;
      default:
        return `translate3d(0, ${distance}px, 0)`;
    }
  };

  const dynamicStyle: CSSProperties = {
    ...style,
    opacity: isRevealed ? 1 : 0,
    transform: isRevealed ? "translate3d(0, 0, 0) scale(1)" : getInitialTransform(),
    filter: blur ? (isRevealed ? "blur(0px)" : "blur(8px)") : undefined,
    transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms${
      blur ? `, filter ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms` : ""
    }`,
    willChange: isRevealed ? "auto" : "opacity, transform, filter",
  };

  return (
    <Component ref={ref} className={className} style={dynamicStyle}>
      {children}
    </Component>
  );
};

export interface ParallaxImageProps {
  src: string;
  alt?: string;
  className?: string;
  speed?: number; // 0.1 to 0.3 is optimal
  opacity?: number;
}

export const ParallaxImage: FC<ParallaxImageProps> = ({
  src,
  alt = "",
  className = "",
  speed = 0.12,
  opacity,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let ticking = false;
    let isVisible = true;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { rootMargin: "150px" }
    );
    observer.observe(container);

    const updateParallax = () => {
      ticking = false;
      if (!isVisible) return;

      const rect = container.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Center of element relative to center of viewport
      const elementCenter = rect.top + rect.height / 2;
      const viewportCenter = windowHeight / 2;
      const distanceFromCenter = elementCenter - viewportCenter;

      // Subtle vertical translation
      const translateY = distanceFromCenter * speed;
      img.style.transform = `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(1.12)`;
    };

    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateParallax);
      }
    };

    updateParallax();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [speed]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={`absolute -inset-y-12 inset-x-0 h-[calc(100%+6rem)] w-full object-cover object-center will-change-transform ${className}`}
        style={{
          opacity,
          transform: "translate3d(0, 0, 0) scale(1.12)",
        }}
      />
    </div>
  );
};

export default ScrollReveal;
