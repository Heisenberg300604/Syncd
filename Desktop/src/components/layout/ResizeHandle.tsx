import React, { useCallback, useEffect, useState } from "react";

export interface ResizeHandleProps {
  onResize: (delta: number) => void;
  direction?: "horizontal" | "vertical";
  className?: string;
  onDragStateChange?: (isDragging: boolean) => void;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  onResize,
  direction = "horizontal",
  className = "",
  onDragStateChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      onDragStateChange?.(true);
    },
    [onDragStateChange]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      onResize(direction === "horizontal" ? e.movementX : e.movementY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onDragStateChange?.(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, onResize, direction]);

  return (
    <div
      role="separator"
      tabIndex={0}
      onMouseDown={handleMouseDown}
      className={`relative select-none flex items-center justify-center transition-colors group cursor-col-resize ${
        direction === "horizontal" ? "w-1 hover:w-1.5" : "h-1 hover:h-1.5 cursor-row-resize"
      } ${isDragging ? "bg-amber-500 w-1.5" : "bg-transparent hover:bg-amber-500/40"} ${className}`}
    >
      {/* Invisible wider hover hit-area */}
      <div
        className={`absolute inset-0 ${
          direction === "horizontal" ? "-left-1.5 -right-1.5 w-4" : "-top-1.5 -bottom-1.5 h-4"
        }`}
      />
    </div>
  );
};

