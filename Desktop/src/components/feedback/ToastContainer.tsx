import React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Trash2,
  Pencil,
  Info,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useToastStore, type Toast } from "../../stores/useToastStore";

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  // Newest toast is at the end of the array; reverse so index 0 is the front toast
  const reversedToasts = [...toasts].reverse();

  return (
    <div
      aria-live="polite"
      className="fixed bottom-24 right-6 z-50 w-84 pointer-events-none select-none flex items-end justify-end"
      style={{ minHeight: "72px" }}
    >
      <div className="relative w-full flex items-end justify-center">
        <AnimatePresence mode="popLayout">
          {reversedToasts.slice(0, 3).map((toast, index) => {
            const isFront = index === 0;
            const offsetY = -index * 9;
            const scale = 1 - index * 0.045;
            const opacity = index === 0 ? 1 : index === 1 ? 0.65 : 0.35;
            const zIndex = 30 - index * 10;

            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 18, scale: 0.92 }}
                animate={{
                  opacity,
                  y: offsetY,
                  scale,
                  zIndex,
                }}
                exit={{
                  opacity: 0,
                  y: 12,
                  scale: 0.88,
                  transition: { duration: 0.16, ease: "easeOut" },
                }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
                style={{
                  position: index === 0 ? "relative" : "absolute",
                  bottom: 0,
                  transformOrigin: "bottom center",
                  zIndex,
                }}
                className={`w-full ${isFront ? "pointer-events-auto" : "pointer-events-none"}`}
              >
                <ToastCard
                  toast={toast}
                  isFront={isFront}
                  onDismiss={() => removeToast(toast.id)}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

const ToastCard: React.FC<{
  toast: Toast;
  isFront: boolean;
  onDismiss: () => void;
}> = ({ toast, isFront, onDismiss }) => {
  const renderIcon = () => {
    switch (toast.type) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-400 shrink-0 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]" />;
      case "delete":
        return <Trash2 className="w-4 h-4 text-rose-400 shrink-0 drop-shadow-[0_0_8px_rgba(251,113,133,0.4)]" />;
      case "edit":
        return <Pencil className="w-4 h-4 text-amber-400 shrink-0 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]" />;
      case "info":
      default:
        return <Info className="w-4 h-4 text-zinc-300 shrink-0 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" />;
    }
  };

  return (
    <div
      className={`p-3.5 rounded-2xl border flex items-start gap-3 select-none backdrop-blur-2xl transition-colors duration-200 ${
        isFront
          ? "bg-zinc-950/92 border-zinc-800/90 shadow-[0_16px_36px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.12)]"
          : "bg-zinc-950/95 border-zinc-800/60 shadow-[0_8px_20px_rgba(0,0,0,0.6)]"
      }`}
    >
      <div className="pt-0.5">{renderIcon()}</div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-zinc-100 tracking-tight truncate">{toast.title}</h4>
        {toast.message && (
          <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug line-clamp-2">{toast.message}</p>
        )}
      </div>
      {isFront && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 -mr-1 -mt-0.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
