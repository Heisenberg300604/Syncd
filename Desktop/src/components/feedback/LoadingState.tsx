import React from "react";
import { Loader2 } from "lucide-react";

export interface LoadingStateProps {
  message?: string;
  variant?: "spinner" | "skeleton";
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Loading...",
  variant = "spinner",
  className = "",
}) => {
  if (variant === "skeleton") {
    return (
      <div className={`flex flex-col gap-3 w-full animate-pulse p-4 ${className}`}>
        <div className="h-6 bg-zinc-850 rounded-lg w-1/3 mb-2" />
        <div className="h-10 bg-zinc-900 rounded-xl w-full" />
        <div className="h-10 bg-zinc-900 rounded-xl w-full" />
        <div className="h-10 bg-zinc-900 rounded-xl w-full" />
        <div className="h-10 bg-zinc-900 rounded-xl w-full" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center p-8 gap-3 text-center ${className}`}>
      <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
      <p className="text-xs text-zinc-400 font-medium">{message}</p>
    </div>
  );
};

