import React from "react";
import { Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "xs" | "sm" | "md" | "icon";
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant = "primary",
      size = "sm",
      isLoading = false,
      disabled = false,
      icon,
      type = "button",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all select-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500/50 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] cursor-pointer";

    const variants = {
      primary:
        "bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold shadow-xs shadow-amber-500/10 active:bg-amber-600",
      secondary:
        "bg-zinc-800 hover:bg-zinc-750 text-zinc-100 border border-zinc-700/60 active:bg-zinc-700",
      ghost:
        "bg-transparent hover:bg-zinc-800/60 text-zinc-300 hover:text-zinc-100 active:bg-zinc-800",
      danger:
        "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 active:bg-red-500/30",
      outline:
        "bg-transparent hover:bg-zinc-900 text-zinc-300 border border-zinc-700/80 hover:border-zinc-600 active:bg-zinc-850",
    };

    const sizes = {
      xs: "text-[11px] h-6 px-2.5 rounded-md gap-1.5",
      sm: "text-xs h-8 px-3.5 rounded-lg gap-2",
      md: "text-sm h-10 px-4 rounded-xl gap-2.5",
      icon: "h-8 w-8 rounded-lg p-0",
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
        ) : (
          icon && <span className="shrink-0 inline-flex items-center">{icon}</span>
        )}
        {children && (
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            {children}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

