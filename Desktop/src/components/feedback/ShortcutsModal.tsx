import React from 'react';
import { Modal } from '../ui/Modal';
import { Play, Volume2, Compass, Command } from 'lucide-react';

export interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  icon: React.ReactNode;
  shortcuts: ShortcutItem[];
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const sections: ShortcutSection[] = [
    {
      title: 'Playback Controls',
      icon: <Play className="w-3.5 h-3.5 text-amber-400" />,
      shortcuts: [
        { keys: ['Space'], description: 'Play / Pause toggle' },
        { keys: ['Ctrl', '→'], description: 'Next track (or Ctrl + N)' },
        { keys: ['Ctrl', '←'], description: 'Previous track (or Ctrl + P)' },
        { keys: ['←', '→'], description: 'Scrub backward / forward 5s' },
        { keys: ['Shift', '← / →'], description: 'Scrub backward / forward 15s' },
        { keys: ['Ctrl', 'S'], description: 'Toggle Shuffle mode' },
        { keys: ['Ctrl', 'R'], description: 'Cycle Repeat (Off → All → One)' },
      ],
    },
    {
      title: 'Volume & Player Visibility',
      icon: <Volume2 className="w-3.5 h-3.5 text-amber-400" />,
      shortcuts: [
        { keys: ['Ctrl', '↑'], description: 'Increase volume (+5%)' },
        { keys: ['Ctrl', '↓'], description: 'Decrease volume (-5%)' },
        { keys: ['↑'], description: 'Call / show floating bottom player' },
        { keys: ['↓'], description: 'Hide / minimize floating bottom player' },
        { keys: ['Ctrl', 'M'], description: 'Mute / Unmute audio toggle' },
      ],
    },
    {
      title: 'Navigation & App Views',
      icon: <Compass className="w-3.5 h-3.5 text-amber-400" />,
      shortcuts: [
        { keys: ['Ctrl', 'K'], description: 'Open Global Search modal' },
        { keys: ['Ctrl', '1'], description: 'Switch to Home view' },
        { keys: ['Ctrl', '2'], description: 'Switch to Library view' },
        { keys: ['Ctrl', '3'], description: 'Switch to Playlists view' },
        { keys: ['Ctrl', '4'], description: 'Switch to Social Rooms view' },
        { keys: ['Ctrl', '5'], description: 'Switch to Settings view' },
        { keys: ['Ctrl', 'Q'], description: 'Toggle Queue & Chat Right Drawer' },
      ],
    },
    {
      title: 'System & Shortcuts',
      icon: <Command className="w-3.5 h-3.5 text-amber-400" />,
      shortcuts: [
        { keys: ['?'], description: 'Open this Keyboard Shortcuts cheatsheet' },
        { keys: ['Ctrl', '/'], description: 'Alternate hotkey for cheatsheet' },
        { keys: ['Ctrl', 'Shift', 'R'], description: 'Trigger background library rescan' },
        { keys: ['Esc'], description: 'Close active modal, drawer, or popover' },
      ],
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts"
      description="Quick navigation and playback controls for SyncDesk."
      maxWidth="lg"
      className="bg-zinc-950/95 border-zinc-800 shadow-[0_25px_60px_rgba(0,0,0,0.95)] max-h-[85vh] flex flex-col"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-1 overflow-y-auto max-h-[60vh] pr-1 custom-scrollbar">
        {sections.map((section) => (
          <div
            key={section.title}
            className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col gap-2.5"
          >
            <div className="flex items-center gap-2 pb-1.5 border-b border-zinc-800/60">
              {section.icon}
              <h3 className="text-xs font-semibold text-zinc-200">{section.title}</h3>
            </div>

            <div className="flex flex-col gap-1.5">
              {section.shortcuts.map((sc) => (
                <div
                  key={sc.description}
                  className="flex items-center justify-between gap-3 text-xs py-0.5"
                >
                  <span className="text-zinc-400 text-[11.5px] leading-tight">
                    {sc.description}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {sc.keys.map((k) => (
                      <kbd
                        key={k}
                        className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded-md bg-zinc-800/90 text-zinc-300 border border-zinc-700/80 shadow-xs"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-zinc-850 flex items-center justify-between text-[11px] text-zinc-500">
        <span>Press <kbd className="px-1 py-0.5 rounded bg-zinc-850 text-zinc-400 font-mono text-[10px] border border-zinc-750">Esc</kbd> anytime to close</span>
        <span className="font-mono text-amber-500/80">SyncDesk v0.0.1</span>
      </div>
    </Modal>
  );
};
