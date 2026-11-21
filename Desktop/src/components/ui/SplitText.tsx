import React from "react";
import { motion } from "motion/react";

export interface SplitTextProps {
  text: string;
  className?: string;
  charClassName?: (char: string, index: number) => string;
  delay?: number; // stagger in ms
  duration?: number; // in seconds
  initialY?: number;
  tag?: "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div";
  onLetterAnimationComplete?: () => void;
}

export const SplitText: React.FC<SplitTextProps> = ({
  text,
  className = "",
  charClassName,
  delay = 60,
  duration = 0.55,
  initialY = 32,
  tag = "h1",
  onLetterAnimationComplete,
}) => {
  const characters = Array.from(text);
  const Tag = motion[tag] as typeof motion.div;

  return (
    <Tag
      className={`inline-flex items-center justify-center overflow-hidden ${className}`}
      aria-label={text}
    >
      {characters.map((char, index) => {
        const isLast = index === characters.length - 1;
        const customClass = charClassName ? charClassName(char, index) : "";

        return (
          <motion.span
            key={`${char}-${index}`}
            initial={{ opacity: 0, y: initialY, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              duration,
              delay: (index * delay) / 1000,
              ease: [0.215, 0.61, 0.355, 1], // cubic-bezier smooth entrance
            }}
            onAnimationComplete={isLast ? onLetterAnimationComplete : undefined}
            className={`inline-block select-none ${customClass}`}
            style={{
              whiteSpace: char === " " ? "pre" : "normal",
              willChange: "transform, opacity, filter",
            }}
          >
            {char}
          </motion.span>
        );
      })}
    </Tag>
  );
};

export default SplitText;
