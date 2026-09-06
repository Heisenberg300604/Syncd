import type { ComponentPropsWithoutRef } from "react";

interface CardProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * Surface level:
   *  - "raised"  (default) — standard card on the page
   *  - "flat"    — quieter, for nested/secondary panels
   *  - "overlay" — floating panels (popovers, sheets)
   */
  level?: "raised" | "flat" | "overlay";
}

const LEVELS: Record<NonNullable<CardProps["level"]>, string> = {
  flat: "bg-white/2 border border-line",
  raised: "bg-raised border border-line shadow-md",
  overlay: "bg-overlay border border-line-strong shadow-lg",
};

export function Card({ level = "raised", className = "", ...rest }: CardProps) {
  return (
    <div
      className={`rounded-lg ${LEVELS[level]} ${className}`}
      {...rest}
    />
  );
}
