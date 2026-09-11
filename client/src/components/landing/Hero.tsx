import { Button } from "../ui/Button";
import { Avatar } from "../ui/Avatar";
import { EqualizerBars } from "../ui/EqualizerBars";
import { ScrollReveal, ParallaxImage } from "../ui/ScrollReveal";

/* -------------------------------------------------------------------------- */
/*  Data                                                                       */
/* -------------------------------------------------------------------------- */

const listeners = [
  { name: "Aman", city: "Delhi", pos: "left-[4%] top-[6%]" },
  { name: "Priya", city: "Bengaluru", pos: "right-[2%] top-[2%]" },
  { name: "Rahul", city: "Mumbai", pos: "left-[1%] bottom-[9%]" },
  { name: "Nibedan", city: "Kolkata", pos: "right-[11%] bottom-[22%]" },
] as const;

// Deterministic waveform bar heights (0–1). ~62% is "played".
const waveBars = [
  0.3, 0.55, 0.4, 0.7, 0.5, 0.85, 0.6, 0.45, 0.75, 0.55, 0.9, 0.65, 0.5, 0.8,
  0.6, 0.42, 0.7, 0.52, 0.88, 0.6, 0.48, 0.72, 0.58, 0.82, 0.5, 0.66, 0.44,
  0.78, 0.56, 0.7, 0.46, 0.6, 0.5, 0.74, 0.54, 0.64, 0.4, 0.58, 0.48, 0.36,
];
const PLAYED = Math.round(waveBars.length * 0.62);

const heroFeatures = [
  { label: "Real-time sync", d: "M13 10V3L4 14h7v7l9-11h-7z" },
  {
    label: "Live presence",
    d: "M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  },
  {
    label: "Chat & reactions",
    d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z",
  },
];

/* -------------------------------------------------------------------------- */
/*  Background                                                                 */
/* -------------------------------------------------------------------------- */

function HeroBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <ParallaxImage
        src="/hero-background-primary.webp"
        speed={0.16}
      />
      {/* Atmospheric grading — sink the photo into the canvas */}
      <div className="absolute inset-0 bg-gradient-to-b from-canvas/60 via-canvas/25 to-canvas" />
      <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/40 to-transparent lg:via-canvas/20" />
      {/* Warm horizon lift (atmosphere only) */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(ellipse_60%_50%_at_18%_100%,var(--color-accent-lo),transparent_70%)]" />
      {/* Edge vignette */}
      <div className="absolute inset-0 shadow-[inset_0_0_240px_70px_rgba(7,10,15,0.9)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-canvas to-transparent" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Listener network                                                           */
/* -------------------------------------------------------------------------- */

function ConnectionLines() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="syncd-line" cx="40%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#fcd34d" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#f7a23b" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.4" />
        </radialGradient>
      </defs>
      <g
        fill="none"
        stroke="url(#syncd-line)"
        strokeWidth="1.5"
        strokeLinecap="round"
        style={{ vectorEffect: "non-scaling-stroke" }}
      >
        {/* Card -> Aman (top-left) */}
        <path d="M28,28 Q18,22 12,14" className="syncd-dash" style={{ vectorEffect: "non-scaling-stroke" }} />
        {/* Card -> Priya (top-right) */}
        <path d="M62,34 Q76,22 90,11" className="syncd-dash" style={{ vectorEffect: "non-scaling-stroke", animationDelay: "-0.7s" }} />
        {/* Card -> Rahul (bottom-left) */}
        <path d="M22,72 Q14,76 8,81" className="syncd-dash" style={{ vectorEffect: "non-scaling-stroke", animationDelay: "-1.4s" }} />
        {/* Card -> Nibedan (bottom-right) */}
        <path d="M62,60 Q72,65 81,70" className="syncd-dash" style={{ vectorEffect: "non-scaling-stroke", animationDelay: "-2.1s" }} />
      </g>
    </svg>
  );
}

function ListenerNode({ name, city }: { name: string; city: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div className="relative">
        <Avatar name={name} size={52} online />
        <span className="absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full bg-online syncd-pulse-ring" />
      </div>
      <div className="leading-tight">
        <p className="text-[13px] font-medium text-ink">{name}</p>
        <p className="text-[11px] text-ink-faint">{city}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Music player                                                               */
/* -------------------------------------------------------------------------- */

function AlbumArt() {
  return (
    <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-md ring-1 ring-line-strong sm:w-28">
      <div className="absolute inset-0 bg-[linear-gradient(160deg,#4a2a1c_0%,#241228_45%,#0a0908_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_at_bottom,var(--color-accent-lo),transparent_70%)]" />
      <span className="absolute left-3 top-3 h-px w-px rounded-full bg-white shadow-[0_0_3px_1px_rgba(255,255,255,0.7)]" />
      <span className="absolute right-5 top-5 h-px w-px rounded-full bg-white shadow-[0_0_2px_1px_rgba(255,255,255,0.6)]" />
      <span className="absolute left-8 top-9 h-px w-px rounded-full bg-white/80" />
      <span className="absolute left-4 top-6 h-px w-10 -rotate-[28deg] bg-gradient-to-r from-transparent via-white to-transparent" />
    </div>
  );
}

function MusicPlayerCard() {
  return (
    <div className="relative w-full max-w-[380px] rounded-xl border border-line-strong bg-surface/85 p-5 shadow-lg backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium tracking-wide text-ink ring-1 ring-line">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-online opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-online" />
          </span>
          LIVE
        </span>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] text-ink-muted">
          <EqualizerBars className="h-3.5 shrink-0" />
          Synced · 4 listeners
        </span>
      </div>

      <div className="mt-4 flex items-start gap-4">
        <AlbumArt />
        <div className="min-w-0 flex-1 pt-1">
          <h3 className="truncate text-[15px] font-semibold text-ink">Midnight City</h3>
          <p className="mt-0.5 truncate text-xs text-ink-muted">
            M83 · Hurry Up, We're Dreaming
          </p>

          <div className="mt-3 flex h-9 items-center gap-[2px]">
            {waveBars.map((h, i) => (
              <span
                key={i}
                className={`w-full rounded-full ${
                  i < PLAYED ? "bg-accent" : "bg-white/12"
                }`}
                style={{ height: `${Math.max(12, h * 100)}%` }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-faint">
            <span>1:42</span>
            <span>4:03</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button className="text-ink-muted transition-colors hover:text-ink" aria-label="Shuffle">
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="text-ink transition-colors hover:text-ink" aria-label="Previous track">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
        </button>
        <button
          className="syncd-glow grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-ink transition-transform hover:scale-105"
          aria-label="Pause"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5h3v14H8zm5 0h3v14h-3z" /></svg>
        </button>
        <button className="text-ink transition-colors hover:text-ink" aria-label="Next track">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z" /></svg>
        </button>
        <button className="text-ink-muted transition-colors hover:text-accent" aria-label="Add to favourites">
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 21s-7.5-4.9-10-9.4C.5 8.2 2 4.5 5.5 4.5c2 0 3.5 1.2 4.5 2.7 1-1.5 2.5-2.7 4.5-2.7C22 4.5 23.5 8.2 22 11.6 19.5 16.1 12 21 12 21Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ChatReaction() {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-line bg-surface/90 px-3.5 py-3 shadow-md backdrop-blur-xl">
      <Avatar name="Priya" size={28} />
      <div className="leading-tight">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink">Priya</span>
          <span className="text-[10px] text-ink-faint">2m ago</span>
        </div>
        <p className="mt-0.5 text-xs text-ink-muted">This song is insane 🔥</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Social proof                                                               */
/* -------------------------------------------------------------------------- */

function SocialProof() {
  return (
    <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-7">
      <div className="flex -space-x-2.5">
        {listeners.map((l) => (
          <Avatar
            key={l.name}
            name={l.name}
            size={32}
            className="ring-2 ring-canvas rounded-full"
          />
        ))}
        <div className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-[10px] font-semibold text-ink-muted ring-2 ring-canvas">
          +2
        </div>
      </div>

      <div className="flex items-center gap-5 sm:gap-7">
        <div>
          <p className="text-xl font-bold text-ink">10K+</p>
          <p className="text-xs text-ink-muted">People already syncing</p>
        </div>
        <div className="h-9 w-px bg-line" />
        <div>
          <p className="text-xl font-bold text-ink">4.9/5</p>
          <p className="max-w-[13rem] text-xs text-ink-muted">
            Because music is better together
          </p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero                                                                       */
/* -------------------------------------------------------------------------- */

export function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden pt-28 pb-20 lg:pt-20">
      <HeroBackground />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:gap-8">
        {/* ---------------------------------------------------- Left column */}
        <div className="min-w-0 lg:col-span-5 lg:pt-6">
          <ScrollReveal animation="fade-up" distance={16} duration={700} delay={60}>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Music brings people closer
            </span>
          </ScrollReveal>

          <ScrollReveal animation="fade-up" distance={24} duration={850} delay={140}>
            <h1 className="mt-6 text-[2.5rem] font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-[3.5rem]">
              Listen together.
              <br />
              Stay in{" "}
              <span className="bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">
                sync
              </span>
              .
            </h1>
          </ScrollReveal>

          <ScrollReveal animation="fade-up" distance={20} duration={850} delay={220}>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-muted sm:text-[17px]">
              Create a room, share the code, and enjoy music together in real time —
              wherever your friends are.
            </p>
          </ScrollReveal>

          <ScrollReveal animation="fade-up" distance={18} duration={850} delay={300}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button to="/enter" size="lg" variant="light" pill glow className="group">
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
                Create a room
              </Button>
              <Button to="/enter" size="lg" variant="secondary" pill className="group">
                <svg
                  className="h-4 w-4 text-accent transition-transform duration-200 group-hover:scale-110"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                </svg>
                Join a room
              </Button>
            </div>

            <p className="mt-5 text-xs text-ink-faint">
              No account required to join · Free forever
            </p>
          </ScrollReveal>

          <ScrollReveal animation="fade-up" distance={16} duration={850} delay={380}>
            <SocialProof />
          </ScrollReveal>
        </div>

        {/* ---------------------------------------------------- Right column */}
        <div className="min-w-0 lg:col-span-7">
          <div className="relative mx-auto hidden min-h-[560px] max-w-2xl lg:block">
            {/* Connection lines fade in smoothly as listeners connect */}
            <ScrollReveal
              animation="fade-up"
              distance={0}
              blur={false}
              duration={900}
              delay={450}
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <ConnectionLines />
            </ScrollReveal>

            {/* Listeners enter sequentially one by one */}
            {listeners.map((l, index) => (
              <div key={l.name} className={`absolute ${l.pos}`}>
                <ScrollReveal
                  animation="zoom-in"
                  distance={12}
                  duration={650}
                  delay={350 + index * 130}
                >
                  <ListenerNode {...l} />
                </ScrollReveal>
              </div>
            ))}

            {/* Central Music Player anchors the room */}
            <div className="absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2 px-10">
              <ScrollReveal
                animation="zoom-in"
                distance={16}
                duration={800}
                delay={200}
              >
                <MusicPlayerCard />
              </ScrollReveal>
            </div>

            {/* Live Chat reaction pops up after the session is established */}
            <div className="absolute -bottom-2 right-0 w-[236px]">
              <ScrollReveal
                animation="fade-up"
                distance={20}
                duration={700}
                delay={920}
              >
                <ChatReaction />
              </ScrollReveal>
            </div>

            {/* Atmospheric handwritten note drifts in last */}
            <div className="pointer-events-none absolute right-0 top-[30%] text-right">
              <ScrollReveal
                animation="fade-left"
                distance={14}
                duration={750}
                delay={1080}
                as="p"
                className="font-hand text-lg leading-tight text-ink-muted/80"
              >
                Same song.
                <br />
                Different places.
                <br />
                One moment.
              </ScrollReveal>
            </div>
          </div>

          {/* Mobile / tablet — staggered card and reaction */}
          <div className="mx-auto flex max-w-[380px] flex-col items-center gap-5 lg:hidden">
            <ScrollReveal animation="zoom-in" distance={16} duration={800} delay={200} className="w-full">
              <MusicPlayerCard />
            </ScrollReveal>
            <ScrollReveal animation="fade-up" distance={16} duration={700} delay={420} className="w-full max-w-[300px]">
              <ChatReaction />
            </ScrollReveal>
          </div>
        </div>
      </div>

      {/* Handwritten anchor over the foreground */}
      <p className="pointer-events-none absolute bottom-8 left-5 hidden font-hand text-xl leading-tight text-ink-muted/70 lg:block xl:left-8">
        Music feels better
        <br />
        together.
      </p>

      {/* Feature rail */}
      <div className="absolute bottom-8 right-8 hidden items-center gap-6 lg:flex">
        {heroFeatures.map((f) => (
          <div key={f.label} className="flex items-center gap-2 text-xs font-medium text-ink-muted">
            <svg className="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={f.d} />
            </svg>
            {f.label}
          </div>
        ))}
      </div>
    </section>
  );
}
