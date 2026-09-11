import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "./Card";

/**
 * `[emoji, name]`. The name drives both search and the accessible label, so
 * screen readers announce "Insert fire" rather than the raw glyph.
 *
 * This is a hand-picked set rather than the full Unicode table: it keeps the
 * picker dependency-free and, more importantly, keeps every glyph one the OS
 * font can actually render. Emoji are plain text — no sprite sheets, no image
 * requests, no CDN.
 */
type EmojiEntry = readonly [emoji: string, name: string];

interface EmojiCategory {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly emojis: readonly EmojiEntry[];
}

const CATEGORIES: readonly EmojiCategory[] = [
  {
    id: "vibes",
    label: "Music & vibes",
    icon: "🎵",
    emojis: [
      ["🎵", "music note"], ["🎶", "music notes"], ["🎧", "headphones"],
      ["🎤", "microphone"], ["🎸", "guitar"], ["🥁", "drum"],
      ["🎹", "piano keyboard"], ["🎷", "saxophone"], ["🎺", "trumpet"],
      ["🎻", "violin"], ["🪕", "banjo"], ["🪗", "accordion"],
      ["📻", "radio"], ["📀", "disc cd"], ["💿", "cd album"],
      ["📼", "tape cassette"], ["🔊", "loud speaker volume"], ["🔉", "speaker"],
      ["🔇", "mute"], ["🪩", "disco ball party"], ["🎚️", "level slider"],
      ["🎛️", "control knobs mixer"], ["🎬", "clapper film"], ["🕯️", "candle"],
      ["🔥", "fire lit"], ["✨", "sparkles"], ["💫", "dizzy star"],
      ["⚡", "zap lightning"], ["🌙", "moon night"], ["☀️", "sun"],
      ["🌊", "wave ocean"], ["🌈", "rainbow"], ["❄️", "snowflake cold"],
      ["💥", "boom"], ["🌌", "milky way night sky"], ["🎆", "fireworks"],
    ],
  },
  {
    id: "smileys",
    label: "Smileys",
    icon: "😀",
    emojis: [
      ["😀", "grin happy"], ["😃", "smile happy"], ["😄", "smile big"],
      ["😁", "beam grin"], ["😆", "laugh squint"], ["😅", "sweat laugh"],
      ["🤣", "rofl rolling laugh"], ["😂", "joy tears laugh"], ["🙂", "slight smile"],
      ["🙃", "upside down"], ["🫠", "melting"], ["😉", "wink"],
      ["😊", "blush smile"], ["😇", "halo angel"], ["🥰", "hearts love face"],
      ["😍", "heart eyes"], ["🤩", "star struck"], ["😘", "kiss blow"],
      ["😗", "kissing"], ["😚", "kiss closed eyes"], ["😋", "yum tasty"],
      ["😛", "tongue"], ["🤪", "zany goofy"], ["😝", "squint tongue"],
      ["🤑", "money face"], ["🤗", "hug"], ["🤭", "giggle oops"],
      ["🫢", "gasp shock"], ["🤫", "shush quiet"], ["🤔", "thinking hmm"],
      ["🫡", "salute"], ["🤐", "zipper mouth"], ["🤨", "raised eyebrow"],
      ["😐", "neutral"], ["😑", "expressionless"], ["😶", "no mouth blank"],
      ["🫥", "dotted invisible"], ["😏", "smirk"], ["😒", "unamused"],
      ["🙄", "eye roll"], ["😬", "grimace awkward"], ["🤥", "lying"],
      ["😌", "relieved calm"], ["😔", "pensive sad"], ["😪", "sleepy"],
      ["🤤", "drool"], ["😴", "sleeping zzz"], ["😷", "mask sick"],
      ["🤒", "thermometer sick"], ["🤕", "bandage hurt"], ["🤢", "nauseated"],
      ["🤮", "vomit"], ["🤧", "sneeze"], ["🥵", "hot overheated"],
      ["🥶", "freezing cold"], ["🥴", "woozy"], ["😵", "dizzy knocked out"],
      ["🤯", "mind blown exploding head"], ["🤠", "cowboy"], ["🥳", "party celebrate"],
      ["🥸", "disguise"], ["😎", "cool sunglasses"], ["🤓", "nerd"],
      ["🧐", "monocle inspect"], ["😕", "confused"], ["🫤", "diagonal mouth meh"],
      ["😟", "worried"], ["🙁", "slight frown"], ["😮", "open mouth wow"],
      ["😯", "hushed"], ["😲", "astonished"], ["🥺", "pleading puppy eyes"],
      ["😦", "frowning open"], ["😢", "cry sad"], ["😭", "sob bawling"],
      ["😤", "triumph steam huff"], ["😠", "angry"], ["😡", "rage mad"],
      ["🤬", "cursing swearing"], ["😱", "scream fear"], ["😨", "fearful"],
      ["😰", "anxious sweat"], ["😥", "sad relieved"], ["🥱", "yawn bored"],
      ["💀", "skull dead"], ["👻", "ghost"], ["👽", "alien"],
      ["🤖", "robot"], ["🤡", "clown"], ["💩", "poop"],
    ],
  },
  {
    id: "gestures",
    label: "People & gestures",
    icon: "👋",
    emojis: [
      ["👋", "wave hi bye"], ["🤚", "raised back hand"], ["✋", "raised hand stop"],
      ["🖐️", "hand fingers splayed"], ["🖖", "vulcan spock"], ["👌", "ok perfect"],
      ["🤌", "pinched fingers chef"], ["🤏", "pinch small"], ["✌️", "peace victory"],
      ["🤞", "crossed fingers luck"], ["🫰", "finger heart"], ["🤟", "love you"],
      ["🤘", "rock on horns"], ["🤙", "call me shaka"], ["👈", "point left"],
      ["👉", "point right"], ["👆", "point up"], ["👇", "point down"],
      ["☝️", "index up"], ["👍", "thumbs up yes like"], ["👎", "thumbs down no"],
      ["✊", "fist raised"], ["👊", "punch fist bump"], ["👏", "clap applause"],
      ["🙌", "raise hands celebrate"], ["🫶", "heart hands"], ["👐", "open hands"],
      ["🤝", "handshake deal"], ["🙏", "pray thanks please"], ["💪", "muscle strong"],
      ["👀", "eyes look"], ["🧠", "brain"], ["🫀", "heart organ"],
      ["💃", "dancing woman"], ["🕺", "dancing man"], ["🕴️", "levitating suit"],
      ["👯", "dancing partners"], ["🧑‍🎤", "singer artist"], ["🧑‍💻", "coder laptop"],
      ["🦸", "superhero"], ["🧘", "meditate yoga"], ["🚶", "walking"],
      ["🏃", "running"], ["🤷", "shrug idk"], ["🤦", "facepalm"],
      ["🙋", "raising hand me"], ["🙆", "ok gesture"], ["🙅", "no gesture stop"],
    ],
  },
  {
    id: "hearts",
    label: "Hearts & symbols",
    icon: "❤️",
    emojis: [
      ["❤️", "red heart love"], ["🧡", "orange heart"], ["💛", "yellow heart"],
      ["💚", "green heart"], ["💙", "blue heart"], ["💜", "purple heart"],
      ["🖤", "black heart"], ["🤍", "white heart"], ["🤎", "brown heart"],
      ["💖", "sparkling heart"], ["💗", "growing heart"], ["💓", "beating heart"],
      ["💞", "revolving hearts"], ["💕", "two hearts"], ["💘", "heart arrow cupid"],
      ["💝", "heart ribbon gift"], ["💔", "broken heart"], ["❤️‍🔥", "heart on fire"],
      ["💯", "hundred perfect"], ["✅", "check done yes"], ["❌", "cross no wrong"],
      ["⭐", "star"], ["🌟", "glowing star"], ["💢", "anger symbol"],
      ["❗", "exclamation"], ["❓", "question"], ["⚠️", "warning"],
      ["🔔", "bell notify"], ["🔕", "bell off mute"], ["♻️", "recycle"],
      ["🆕", "new"], ["🆗", "ok button"], ["🔝", "top"],
      ["🈶", "symbol"], ["➕", "plus add"], ["➖", "minus"],
      ["✖️", "multiply"], ["🔀", "shuffle"], ["🔁", "repeat loop"],
      ["🔂", "repeat one"], ["▶️", "play"], ["⏸️", "pause"],
      ["⏹️", "stop"], ["⏭️", "next track skip"], ["⏮️", "previous track"],
      ["⏩", "fast forward"], ["⏪", "rewind"], ["🔺", "up triangle"],
    ],
  },
  {
    id: "animals",
    label: "Animals & nature",
    icon: "🐶",
    emojis: [
      ["🐶", "dog puppy"], ["🐱", "cat kitten"], ["🐭", "mouse"],
      ["🐹", "hamster"], ["🐰", "rabbit bunny"], ["🦊", "fox"],
      ["🐻", "bear"], ["🐼", "panda"], ["🐨", "koala"],
      ["🐯", "tiger"], ["🦁", "lion"], ["🐮", "cow"],
      ["🐷", "pig"], ["🐸", "frog"], ["🐵", "monkey"],
      ["🙈", "see no evil monkey"], ["🙉", "hear no evil monkey"], ["🙊", "speak no evil monkey"],
      ["🐔", "chicken"], ["🐧", "penguin"], ["🐦", "bird"],
      ["🦅", "eagle"], ["🦉", "owl"], ["🦄", "unicorn"],
      ["🐝", "bee"], ["🦋", "butterfly"], ["🐢", "turtle"],
      ["🐍", "snake"], ["🐙", "octopus"], ["🦈", "shark"],
      ["🐬", "dolphin"], ["🐳", "whale"], ["🐠", "tropical fish"],
      ["🐊", "crocodile"], ["🐘", "elephant"], ["🦒", "giraffe"],
      ["🌸", "cherry blossom"], ["🌻", "sunflower"], ["🌹", "rose"],
      ["🌺", "hibiscus"], ["🌷", "tulip"], ["🌴", "palm tree"],
      ["🌵", "cactus"], ["🍀", "clover luck"], ["🍁", "maple leaf"],
      ["🌿", "herb leaf"], ["🪴", "potted plant"], ["🌎", "earth globe"],
    ],
  },
  {
    id: "food",
    label: "Food & drink",
    icon: "🍕",
    emojis: [
      ["🍕", "pizza"], ["🍔", "burger"], ["🍟", "fries"],
      ["🌭", "hot dog"], ["🌮", "taco"], ["🌯", "burrito"],
      ["🥪", "sandwich"], ["🍝", "pasta spaghetti"], ["🍜", "ramen noodles"],
      ["🍛", "curry rice"], ["🍣", "sushi"], ["🍱", "bento"],
      ["🥟", "dumpling"], ["🍤", "shrimp tempura"], ["🥗", "salad"],
      ["🍞", "bread"], ["🥐", "croissant"], ["🧀", "cheese"],
      ["🥓", "bacon"], ["🍳", "egg cooking"], ["🥞", "pancakes"],
      ["🍰", "cake slice"], ["🎂", "birthday cake"], ["🧁", "cupcake"],
      ["🍩", "donut"], ["🍪", "cookie"], ["🍫", "chocolate"],
      ["🍬", "candy"], ["🍿", "popcorn"], ["🍎", "apple"],
      ["🍌", "banana"], ["🍓", "strawberry"], ["🍉", "watermelon"],
      ["🍇", "grapes"], ["🥭", "mango"], ["🍑", "peach"],
      ["☕", "coffee"], ["🍵", "tea"], ["🧋", "bubble tea boba"],
      ["🥤", "soda cup"], ["🍺", "beer"], ["🍻", "cheers beers"],
      ["🍷", "wine"], ["🥂", "champagne toast"], ["🍸", "cocktail"],
      ["🥃", "whiskey"], ["🧊", "ice"], ["🍾", "bottle pop celebrate"],
    ],
  },
  {
    id: "activity",
    label: "Activities",
    icon: "⚽",
    emojis: [
      ["⚽", "soccer football"], ["🏀", "basketball"], ["🏈", "american football"],
      ["⚾", "baseball"], ["🎾", "tennis"], ["🏐", "volleyball"],
      ["🏓", "ping pong"], ["🏸", "badminton"], ["🥊", "boxing"],
      ["🥋", "martial arts"], ["⛳", "golf"], ["🏹", "archery bow"],
      ["🎣", "fishing"], ["🛹", "skateboard"], ["🛼", "roller skate"],
      ["⛷️", "skiing"], ["🏂", "snowboard"], ["🏄", "surfing"],
      ["🚴", "cycling bike"], ["🏋️", "weight lifting gym"], ["🤸", "cartwheel"],
      ["🏆", "trophy win"], ["🥇", "gold medal first"], ["🥈", "silver medal"],
      ["🥉", "bronze medal"], ["🎯", "target bullseye"], ["🎮", "game controller"],
      ["🕹️", "joystick"], ["🎲", "dice"], ["🧩", "puzzle"],
      ["🎳", "bowling"], ["🎰", "slot machine"], ["🃏", "joker card"],
      ["🎨", "art palette"], ["🎭", "theater masks"], ["🎪", "circus"],
      ["🎉", "party popper"], ["🎊", "confetti"], ["🎈", "balloon"],
      ["🎁", "gift present"], ["🏅", "medal"], ["🎟️", "ticket"],
    ],
  },
  {
    id: "travel",
    label: "Travel & places",
    icon: "✈️",
    emojis: [
      ["✈️", "airplane flight"], ["🚗", "car"], ["🚕", "taxi"],
      ["🚌", "bus"], ["🚎", "trolley"], ["🏎️", "race car"],
      ["🚓", "police car"], ["🚑", "ambulance"], ["🚒", "fire engine"],
      ["🛵", "scooter"], ["🏍️", "motorcycle"], ["🚲", "bicycle"],
      ["🚂", "train"], ["🚆", "train rail"], ["🚇", "metro subway"],
      ["🚁", "helicopter"], ["🚀", "rocket launch"], ["🛸", "ufo"],
      ["⛵", "sailboat"], ["🚢", "ship"], ["🛳️", "cruise"],
      ["🏝️", "island beach"], ["🏖️", "beach umbrella"], ["🏔️", "mountain"],
      ["🌋", "volcano"], ["🏕️", "camping"], ["🗺️", "map"],
      ["🧭", "compass"], ["🏠", "house home"], ["🏢", "office building"],
      ["🏨", "hotel"], ["🏫", "school"], ["🏰", "castle"],
      ["🗼", "tower"], ["🗽", "statue liberty"], ["🌉", "bridge night"],
      ["🌃", "city night"], ["🌆", "city sunset"], ["🎡", "ferris wheel"],
      ["🎢", "roller coaster"], ["⛺", "tent"], ["🧳", "luggage"],
    ],
  },
  {
    id: "objects",
    label: "Objects",
    icon: "💡",
    emojis: [
      ["💡", "idea light bulb"], ["🔦", "flashlight"], ["🔌", "plug"],
      ["🔋", "battery"], ["💻", "laptop computer"], ["🖥️", "desktop monitor"],
      ["⌨️", "keyboard"], ["🖱️", "mouse click"], ["📱", "phone mobile"],
      ["☎️", "telephone"], ["📞", "phone call"], ["📷", "camera"],
      ["📹", "video camera"], ["📺", "tv"], ["🖨️", "printer"],
      ["💾", "floppy save"], ["🗂️", "files folders"], ["📁", "folder"],
      ["📄", "document page"], ["📝", "memo note write"], ["✏️", "pencil"],
      ["🖊️", "pen"], ["📌", "pin"], ["📎", "paperclip"],
      ["📏", "ruler"], ["✂️", "scissors"], ["🔍", "search magnify"],
      ["🔒", "lock"], ["🔓", "unlock"], ["🔑", "key"],
      ["🔨", "hammer"], ["🛠️", "tools"], ["⚙️", "gear settings"],
      ["🧲", "magnet"], ["💣", "bomb"], ["🧨", "dynamite"],
      ["💰", "money bag"], ["💳", "credit card"], ["🛒", "shopping cart"],
      ["📦", "package box"], ["📬", "mailbox"], ["✉️", "email envelope"],
      ["⏰", "alarm clock"], ["⏳", "hourglass waiting"], ["🗓️", "calendar"],
      ["🔮", "crystal ball"], ["🧿", "evil eye"], ["🪄", "magic wand"],
    ],
  },
] as const;

const RECENTS_KEY = "syncd:recent-emojis";
const RECENTS_LIMIT = 16;
const SEARCH_RESULT_LIMIT = 48;

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is string => typeof e === "string");
  } catch {
    return [];
  }
}

function writeRecents(emojis: string[]): void {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(emojis));
  } catch {
    // Storage unavailable (private mode, blocked cookies) — recents are a
    // convenience, so silently carry on without them.
  }
}

/** Flat list and name lookup, built once at module load rather than per render. */
const ALL_EMOJIS: readonly EmojiEntry[] = CATEGORIES.flatMap((c) => c.emojis);
const NAME_BY_EMOJI = new Map<string, string>(ALL_EMOJIS);

interface EmojiPickerProps {
  /** Called with the chosen emoji; the panel stays open for multi-picking. */
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

export function EmojiPicker({ onSelect, disabled = false }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<string>(CATEGORIES[0].id);
  const [search, setSearch] = useState("");
  const [recents, setRecents] = useState<string[]>(readRecents);
  const containerRef = useRef<HTMLDivElement>(null);

  // A disconnected composer closes the panel without needing its own effect.
  const isOpen = open && !disabled;

  // Dismiss on outside click or Escape.
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleToggle() {
    // Recents can change in another tab/room — re-read them on each open.
    if (!isOpen) {
      setRecents(readRecents());
      setSearch("");
    }
    setOpen(!isOpen);
  }

  function handlePick(emoji: string) {
    const next = [emoji, ...recents.filter((e) => e !== emoji)].slice(
      0,
      RECENTS_LIMIT,
    );
    setRecents(next);
    writeRecents(next);
    onSelect(emoji);
  }

  const query = search.trim().toLowerCase();

  const visible = useMemo<readonly EmojiEntry[]>(() => {
    if (query.length === 0) {
      const category =
        CATEGORIES.find((c) => c.id === categoryId) ?? CATEGORIES[0];
      return category.emojis;
    }
    return ALL_EMOJIS.filter(([, name]) => name.includes(query)).slice(
      0,
      SEARCH_RESULT_LIMIT,
    );
  }, [query, categoryId]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        aria-label="Insert emoji"
        aria-expanded={isOpen}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line text-lg transition-colors hover:border-accent/60 hover:bg-white/5 disabled:opacity-50 disabled:pointer-events-none ${
          isOpen ? "border-accent/60 bg-white/5" : "bg-white/3"
        }`}
      >
        <span aria-hidden="true">🙂</span>
      </button>

      {isOpen && (
        <Card
          level="overlay"
          className="absolute bottom-12 left-0 z-20 w-72 p-3"
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search emoji…"
            aria-label="Search emoji"
            autoComplete="off"
            className="mb-2 h-8 w-full rounded-md border border-line bg-white/3 px-2.5 text-xs text-ink placeholder:text-ink-faint focus:border-accent/60 focus:outline-none"
          />

          {query.length === 0 && recents.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                Recent
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {recents.map((emoji) => (
                  <EmojiButton
                    key={`recent-${emoji}`}
                    emoji={emoji}
                    name={NAME_BY_EMOJI.get(emoji) ?? "emoji"}
                    onPick={handlePick}
                  />
                ))}
              </div>
            </div>
          )}

          {query.length === 0 && (
            <div
              role="tablist"
              aria-label="Emoji categories"
              className="mb-2 flex gap-0.5 border-b border-line pb-2"
            >
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={c.id === categoryId}
                  title={c.label}
                  aria-label={c.label}
                  onClick={() => setCategoryId(c.id)}
                  className={`flex h-7 w-7 items-center justify-center rounded text-sm transition-colors ${
                    c.id === categoryId
                      ? "bg-accent-lo"
                      : "opacity-50 hover:opacity-100"
                  }`}
                >
                  <span aria-hidden="true">{c.icon}</span>
                </button>
              ))}
            </div>
          )}

          <div className="grid max-h-44 grid-cols-8 gap-0.5 overflow-y-auto">
            {visible.map(([emoji, name]) => (
              <EmojiButton
                key={emoji}
                emoji={emoji}
                name={name}
                onPick={handlePick}
              />
            ))}
          </div>

          {visible.length === 0 && (
            <p className="py-4 text-center text-xs text-ink-faint">
              No emoji match “{search.trim()}”.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function EmojiButton({
  emoji,
  name,
  onPick,
}: {
  emoji: string;
  name: string;
  onPick: (emoji: string) => void;
}) {
  return (
    <button
      type="button"
      // Keep focus in the message input so the caret position survives a pick.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(emoji)}
      title={name}
      aria-label={`Insert ${name}`}
      className="flex h-8 w-8 items-center justify-center rounded text-lg transition-colors hover:bg-white/8"
    >
      <span aria-hidden="true">{emoji}</span>
    </button>
  );
}
