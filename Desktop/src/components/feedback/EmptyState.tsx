import React from "react";
import { Button } from "../ui/Button";

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = "",
}) => {
  return (
    <div
      className={`flex-1 min-h-[320px] rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 flex flex-col items-center justify-center p-8 text-center select-none ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-4 shadow-inner">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-zinc-100 mb-1">{title}</h3>
      <p className="text-xs text-zinc-400 max-w-sm mb-5 leading-relaxed">{description}</p>
      {action && (
        <Button variant="primary" size="sm" onClick={action.onClick} icon={action.icon}>
          {action.label}
        </Button>
      )}
    </div>
  );
};

