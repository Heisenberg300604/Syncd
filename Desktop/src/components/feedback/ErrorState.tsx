import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "../ui/Button";

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  message,
  onRetry,
  className = "",
}) => {
  return (
    <div
      role="alert"
      className={`rounded-2xl border border-red-500/20 bg-red-500/5 p-6 flex flex-col items-center justify-center text-center select-none ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-3 shadow-inner">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-bold text-zinc-100 mb-1">{title}</h3>
      <p className="text-xs text-zinc-400 max-w-sm mb-4 leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} icon={<RefreshCw className="w-3.5 h-3.5" />}>
          Retry
        </Button>
      )}
    </div>
  );
};

