import { Link } from "react-router-dom";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Variant = "primary" | "light" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

interface CommonProps {
  /**
   *  - "primary"   amber fill — the product's main action
   *  - "light"     white fill — top-of-funnel marketing CTA
   *  - "secondary" hairline outline
   *  - "ghost"     text only
   */
  variant?: Variant;
  size?: Size;
  /** Fully rounded — used for marketing CTAs. */
  pill?: boolean;
  /** Adds the reserved accent glow (primary / light only). */
  glow?: boolean;
  className?: string;
  children: ReactNode;
}

const BASE =
  "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap " +
  "transition-colors duration-150 focus:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas " +
  "disabled:opacity-50 disabled:pointer-events-none";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hi",
  light: "bg-white text-canvas hover:bg-stone-200",
  secondary:
    "border border-line-strong bg-white/5 text-ink hover:bg-white/10 hover:border-white/25",
  ghost: "text-ink-muted hover:text-ink hover:bg-white/5",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

function classes({ variant = "primary", size = "md", pill, glow, className = "" }: CommonProps) {
  return [
    BASE,
    VARIANTS[variant],
    SIZES[size],
    pill ? "rounded-full" : "rounded-md",
    glow && (variant === "primary" || variant === "light") ? "syncd-glow" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = CommonProps &
  Omit<ComponentPropsWithoutRef<"button">, "className" | "children"> & {
    to?: string;
    href?: string;
  };

export function Button({
  variant,
  size,
  pill,
  glow,
  className,
  children,
  to,
  href,
  ...rest
}: ButtonProps) {
  const cls = classes({ variant, size, pill, glow, className, children });

  if (to) {
    return (
      <Link to={to} className={cls} {...(rest as Record<string, unknown>)}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={cls} {...(rest as Record<string, unknown>)}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
