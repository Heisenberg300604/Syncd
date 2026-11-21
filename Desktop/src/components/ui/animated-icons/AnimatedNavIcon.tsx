import React from 'react';
import { motion } from 'motion/react';

export type NavIconType = 'home' | 'library' | 'playlists' | 'rooms' | 'settings';

interface AnimatedNavIconProps {
  name: NavIconType;
  isActive?: boolean;
  className?: string;
}

export const AnimatedNavIcon: React.FC<AnimatedNavIconProps> = ({
  name,
  isActive = false,
  className = 'w-4 h-4',
}) => {
  switch (name) {
    case 'home':
      return (
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          whileHover="hover"
          initial="idle"
          animate={isActive ? 'active' : 'idle'}
        >
          {/* Roof */}
          <motion.path
            d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
            variants={{
              idle: { y: 0 },
              hover: { y: -1, transition: { type: 'spring', stiffness: 700, damping: 20 } },
              active: { y: 0, scale: 1.05 },
            }}
          />
          {/* Door */}
          <motion.path
            d="M9 22V12h6v10"
            variants={{
              idle: { scaleY: 1 },
              hover: { scaleY: 1.15, originY: '100%', transition: { type: 'spring', stiffness: 750, damping: 18 } },
              active: { scaleY: 1 },
            }}
          />
        </motion.svg>
      );

    case 'library':
      return (
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          whileHover="hover"
          initial="idle"
          animate={isActive ? 'active' : 'idle'}
        >
          {/* Book / Shelf spines */}
          <motion.path
            d="m16 6 4 14"
            variants={{
              idle: { rotate: 0 },
              hover: { rotate: 12, originX: '16px', originY: '20px', transition: { type: 'spring', stiffness: 700, damping: 20 } },
              active: { rotate: 8 },
            }}
          />
          <motion.path
            d="M12 6v14"
            variants={{
              idle: { y: 0 },
              hover: { y: -1.5, transition: { type: 'spring', stiffness: 700, damping: 20 } },
              active: { y: 0 },
            }}
          />
          <motion.path
            d="M8 8v12"
            variants={{
              idle: { y: 0 },
              hover: { y: -0.5, transition: { type: 'spring', stiffness: 700, damping: 20 } },
              active: { y: 0 },
            }}
          />
          <motion.path
            d="M4 4v16"
            variants={{
              idle: { scaleY: 1 },
              hover: { scaleY: 1.05, originY: '100%', transition: { type: 'spring', stiffness: 700, damping: 20 } },
              active: { scaleY: 1 },
            }}
          />
        </motion.svg>
      );

    case 'playlists':
      return (
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          whileHover="hover"
          initial="idle"
          animate={isActive ? 'active' : 'idle'}
        >
          <motion.path
            d="M21 15V6"
            variants={{
              idle: { y: 0 },
              hover: { y: -1.5, transition: { type: 'spring', stiffness: 700, damping: 20 } },
            }}
          />
          <motion.path
            d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
            variants={{
              idle: { scale: 1 },
              hover: { scale: 1.15, transition: { type: 'spring', stiffness: 750, damping: 20 } },
            }}
          />
          <motion.path
            d="M12 12H3"
            variants={{
              idle: { x: 0 },
              hover: { x: 2.5, transition: { type: 'spring', stiffness: 700, damping: 20 } },
            }}
          />
          <motion.path
            d="M16 6H3"
            variants={{
              idle: { x: 0 },
              hover: { x: 1.5, transition: { type: 'spring', stiffness: 700, damping: 20 } },
            }}
          />
          <motion.path
            d="M12 18H3"
            variants={{
              idle: { x: 0 },
              hover: { x: 3, transition: { type: 'spring', stiffness: 700, damping: 20 } },
            }}
          />
        </motion.svg>
      );

    case 'rooms':
      return (
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          whileHover="hover"
          initial="idle"
          animate={isActive ? 'active' : 'idle'}
        >
          <motion.circle
            cx="12"
            cy="12"
            r="2"
            variants={{
              idle: { scale: 1 },
              hover: { scale: 1.3, transition: { repeat: Infinity, repeatType: 'reverse', duration: 0.45 } },
              active: { scale: 1.2 },
            }}
          />
          <motion.path
            d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49"
            variants={{
              idle: { opacity: 0.7, scale: 1 },
              hover: { opacity: 1, scale: 1.08, originX: '12px', originY: '12px', transition: { duration: 0.15 } },
              active: { opacity: 1, scale: 1.05 },
            }}
          />
          <motion.path
            d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"
            variants={{
              idle: { opacity: 0.4 },
              hover: { opacity: 1, scale: 1.1, originX: '12px', originY: '12px', transition: { duration: 0.2 } },
              active: { opacity: 0.9 },
            }}
          />
        </motion.svg>
      );

    case 'settings':
      return (
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          whileHover="hover"
          initial="idle"
          animate={isActive ? 'active' : 'idle'}
        >
          <motion.g
            variants={{
              idle: { rotate: 0 },
              hover: { rotate: 60, transition: { type: 'spring', stiffness: 700, damping: 20 } },
              active: { rotate: 30 },
            }}
            style={{ originX: '12px', originY: '12px' }}
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </motion.g>
        </motion.svg>
      );
  }
};
