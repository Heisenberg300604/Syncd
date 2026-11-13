interface AvatarProps {
  name: string;
  /** px size of the circle. */
  size?: number;
  /** undefined = no dot, true = online, false = offline */
  online?: boolean;
  className?: string;
}

/**
 * CSS-only listener avatar: a deterministic gradient keyed off the name plus the
 * initial. SyncD has no portrait assets, so presence is always drawn, never
 * photographed. The palette leans warm to sit inside the sunset system while
 * still giving each person a distinct colour.
 */
const GRADIENTS = [
  "from-amber-400 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-orange-400 to-red-500",
  "from-sky-400 to-blue-600",
  "from-teal-400 to-emerald-600",
  "from-fuchsia-500 to-purple-600",
  "from-violet-500 to-indigo-600",
  "from-yellow-400 to-amber-600",
];

function gradientFor(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % GRADIENTS.length;
}

export function Avatar({ name, size = 40, online, className = "" }: AvatarProps) {
  const trimmed = name.trim();
  const initial = trimmed.charAt(0).toUpperCase() || "?";
  return (
    <div
      className={`relative shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      <div
        className={`grid h-full w-full place-items-center rounded-full bg-gradient-to-br ${
          GRADIENTS[gradientFor(trimmed)]
        } font-semibold text-white`}
        style={{ fontSize: Math.max(11, size * 0.4) }}
      >
        {initial}
      </div>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-canvas ${
            online ? "bg-online" : "bg-ink-faint"
          }`}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
