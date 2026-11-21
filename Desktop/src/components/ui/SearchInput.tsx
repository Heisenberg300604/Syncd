import React, { useRef } from "react";
import { Search, X } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  showShortcut?: boolean;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, onClear, showShortcut = true, placeholder = "Search...", className, ...props }, ref) => {
    const internalRef = useRef<HTMLInputElement>(null);
    const resolvedRef = (ref || internalRef) as React.RefObject<HTMLInputElement>;

    const handleClear = () => {
      onChange("");
      onClear?.();
      resolvedRef.current?.focus();
    };

    return (
      <div className={twMerge(clsx("relative flex items-center w-full", className))}>
        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 pointer-events-none" />
        <input
          ref={resolvedRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-zinc-900/90 border border-zinc-800 rounded-lg pl-8 pr-16 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all"
          {...props}
        />
        <div className="absolute right-2.5 flex items-center gap-1.5">
          {value ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            showShortcut && (
              <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/60 select-none">
                Ctrl K
              </kbd>
            )
          )}
        </div>
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";

