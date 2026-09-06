import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

type InputProps = ComponentPropsWithoutRef<"input">;

const BASE =
  "w-full rounded-md border border-line bg-white/3 px-4 text-sm text-ink " +
  "placeholder:text-ink-faint transition-colors " +
  "focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/40 " +
  "disabled:opacity-50";

/** Shared text input. Height matches the md Button (h-11) for aligned rows. */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", ...rest }, ref) => (
    <input ref={ref} className={`${BASE} h-11 ${className}`} {...rest} />
  ),
);

Input.displayName = "Input";
