import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check } from 'lucide-react';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  ariaLabel?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  disabled = false,
  id,
  className = '',
  ariaLabel,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <motion.button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={handleKeyDown}
      whileTap={{ scale: 0.9 }}
      className={`relative w-[18px] h-[18px] rounded-[5px] flex items-center justify-center transition-all cursor-pointer select-none focus:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${
        checked
          ? 'bg-amber-500 border border-amber-400 shadow-[0_0_10px_var(--syncd-accent-primary,rgba(245,158,11,0.45))]'
          : 'bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 hover:border-zinc-500 shadow-inner'
      } ${className}`}
      style={{
        backgroundColor: checked ? 'var(--syncd-accent-primary, #f59e0b)' : undefined,
        borderColor: checked ? 'var(--syncd-accent-primary, #f59e0b)' : undefined,
      }}
    >
      <AnimatePresence initial={false}>
        {checked && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 700, damping: 30 }}
            className="flex items-center justify-center"
          >
            <Check className="w-3.5 h-3.5 text-zinc-950 stroke-[3.2]" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};
