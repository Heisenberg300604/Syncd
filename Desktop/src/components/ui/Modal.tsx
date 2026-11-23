import React, { useEffect } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl";
  zIndex?: string;
  overlayClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  maxWidth = "md",
  zIndex = "z-50",
  overlayClassName,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidths = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={twMerge(
        clsx(
          "fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none animate-in fade-in duration-150",
          zIndex,
          overlayClassName
        )
      )}
    >
      <div
        className="fixed inset-0 bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={twMerge(
          clsx(
            "relative w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 z-10 animate-in zoom-in-95 duration-150",
            maxWidths[maxWidth],
            className
          )
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-sm font-bold text-zinc-100">{title}</h2>}
            {description && <p className="text-xs text-zinc-400 mt-0.5">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
};

