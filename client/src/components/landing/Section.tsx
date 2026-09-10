import type { ReactNode } from "react";
import { ScrollReveal } from "../ui/ScrollReveal";

interface SectionProps {
  id?: string;
  children: ReactNode;
  /** Tint the section one step up from the canvas. */
  raised?: boolean;
  /** Faint warm atmosphere behind the section. */
  glow?: boolean;
  className?: string;
  background?: ReactNode;
}

/** Consistent vertical rhythm + container width for every landing section. */
export function Section({
  id,
  children,
  raised,
  glow,
  className = "",
  background,
}: SectionProps) {
  return (
    <section
      id={id}
      className={`relative py-20 sm:py-28 ${
        raised ? "border-y border-line bg-surface/40" : ""
      } ${className}`}
    >
      {background}
      {glow && (
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_0%,var(--color-accent-lo),transparent_70%)]"
          aria-hidden="true"
        />
      )}
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">{children}</div>
    </section>
  );
}

interface SectionHeadingProps {
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
  className?: string;
}

export function SectionHeading({
  title,
  subtitle,
  align = "center",
  className = "",
}: SectionHeadingProps) {
  return (
    <ScrollReveal
      animation="fade-up"
      distance={22}
      duration={800}
      className={`${
        align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl"
      } ${className}`}
    >
      <h2 className="text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-pretty text-lg text-ink-muted">{subtitle}</p>
      )}
    </ScrollReveal>
  );
}
