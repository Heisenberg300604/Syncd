import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "amber" | "success" | "warning" | "danger" | "codec";
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = "neutral", className, ...props }) => {
  const baseStyles = "inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md border select-none";

  const variants = {
    neutral: "bg-zinc-800/80 text-zinc-300 border-zinc-700/60",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    danger: "bg-red-500/10 text-red-400 border-red-500/20",
    codec: "bg-zinc-900 text-zinc-400 border-zinc-800 font-mono uppercase tracking-wider text-[9px] px-1.5 py-0.2",
  };

  return (
    <span className={twMerge(clsx(baseStyles, variants[variant], className))} {...props}>
      {children}
    </span>
  );
};

