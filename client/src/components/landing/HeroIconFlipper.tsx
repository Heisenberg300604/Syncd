import { useState, useEffect } from "react";
import { YouTubeIcon } from "../icons/YouTubeIcon";

const ICONS = [
  {
    id: "plus",
    component: (
      <svg
        className="h-4 w-4 text-canvas"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  {
    id: "youtube",
    component: <YouTubeIcon className="h-4 w-4 text-canvas" />,
  },
];

export function HeroIconFlipper() {
  const [index, setIndex] = useState(0);
  const [animationClass, setAnimationClass] = useState("");

  useEffect(() => {
    const cycleInterval = setInterval(() => {
      // 1. Exit current icon upwards
      setAnimationClass("animate-icon-flip-exit");

      const switchTimeout = setTimeout(() => {
        // 2. Change to next icon and slide in from below
        setIndex((prev) => (prev + 1) % ICONS.length);
        setAnimationClass("animate-icon-flip-enter");

        const settleTimeout = setTimeout(() => {
          setAnimationClass("");
        }, 230);

        return () => clearTimeout(settleTimeout);
      }, 200);

      return () => clearTimeout(switchTimeout);
    }, 1800); // 1.8s per icon cycle

    return () => clearInterval(cycleInterval);
  }, []);

  return (
    <span
      className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden"
      aria-hidden="true"
    >
      <span className={`inline-flex items-center justify-center ${animationClass}`}>
        {ICONS[index].component}
      </span>
    </span>
  );
}
