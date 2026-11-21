import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-zinc-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3 text-zinc-500 pointer-events-none flex items-center justify-center">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={twMerge(
              clsx(
                "w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all disabled:opacity-50 disabled:pointer-events-none",
                icon ? "pl-9 pr-3" : "px-3",
                error && "border-red-500/80 focus:border-red-500 focus:ring-red-500/20",
                className
              )
            )}
            {...props}
          />
        </div>
        {error && <span className="text-[11px] text-red-400 font-medium">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";

