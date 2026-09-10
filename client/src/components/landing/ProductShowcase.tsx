import { Section, SectionHeading } from "./Section";
import { Card } from "../ui/Card";
import { Avatar } from "../ui/Avatar";
import { EqualizerBars } from "../ui/EqualizerBars";
import { ScrollReveal, ParallaxImage } from "../ui/ScrollReveal";

const currentTrack = {
  title: "Midnight City",
  artist: "M83",
  album: "Hurry Up, We're Dreaming",
  duration: "4:03",
  progress: 0.42,
};

const queueTracks = [
  { title: "Runaway", artist: "AURORA", duration: "4:12" },
  { title: "Space Song", artist: "Beach House", duration: "5:21" },
  { title: "The Less I Know The Better", artist: "Tame Impala", duration: "3:36" },
  { title: "Electric Feel", artist: "MGMT", duration: "3:50" },
  { title: "Holocene", artist: "Bon Iver", duration: "5:36" },
];

const listeners = [
  { name: "Nibedan", isHost: true },
  { name: "Rahul", isHost: false },
  { name: "Aman", isHost: false },
  { name: "Priya", isHost: false },
];

const chatMessages = [
  { user: "Rahul", text: "This song is insane 😂", time: "2m ago" },
  { user: "Aman", text: "Bro play the next one", time: "5m ago" },
  { user: "Priya", text: "This is the one 🔥", time: "8m ago" },
  { user: "Nibedan", text: "Queue updated with Beach House", time: "12m ago" },
];

const sectionLabel =
  "text-xs font-semibold uppercase tracking-wider text-ink-faint";

function ProductShowcaseBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <ParallaxImage
        src="/hero-background-abstract.webp"
        speed={0.14}
        opacity={0.55}
      />
      {/* Atmospheric grading to blend seamlessly into canvas */}
      <div className="absolute inset-0 bg-gradient-to-b from-canvas via-canvas/45 to-canvas" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-canvas to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-canvas to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,transparent_20%,var(--color-canvas)_95%)]" />
    </div>
  );
}

export function ProductShowcase() {
  return (
    <Section
      id="showcase"
      className="overflow-hidden border-y border-line"
      background={<ProductShowcaseBackground />}
    >
      <SectionHeading
        title="Everything you need for a shared session."
        subtitle="A complete room interface built for synchronous music."
      />

      <div className="mt-14 grid gap-5 lg:grid-cols-3">
        {/* -------------------------------------------------- Player + queue */}
        <ScrollReveal
          animation="fade-up"
          distance={28}
          duration={850}
          delay={100}
          className="min-w-0 space-y-5 lg:col-span-2"
        >
          <Card className="p-6 bg-surface/85 backdrop-blur-xl border border-line-strong/60 shadow-xl">
            <div className="flex flex-col items-start gap-6 sm:flex-row">
              <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-md sm:h-36 sm:w-36">
                <div className="absolute inset-0 bg-[linear-gradient(160deg,#4a2a1c_0%,#241228_50%,#0a0908_100%)]" />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_at_bottom,var(--color-accent-lo),transparent_70%)]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-accent-lo text-accent ring-1 ring-accent/30">
                    <EqualizerBars className="h-5" />
                  </span>
                </div>
              </div>

              <div className="min-w-0 flex-1 pt-1">
                <h3 className="truncate text-xl font-bold text-ink">
                  {currentTrack.title}
                </h3>
                <p className="mt-1 truncate text-sm text-ink-muted">
                  {currentTrack.artist} · {currentTrack.album}
                </p>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="w-10 text-right font-mono text-xs text-ink-faint">
                      1:42
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${currentTrack.progress * 100}%` }}
                      />
                    </div>
                    <span className="w-10 font-mono text-xs text-ink-faint">
                      {currentTrack.duration}
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-5">
                    <button className="text-ink-muted transition-colors hover:text-ink" aria-label="Shuffle">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>
                    </button>
                    <button className="text-ink transition-colors hover:text-ink" aria-label="Previous">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
                    </button>
                    <button
                      className="syncd-glow grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-ink transition-transform hover:scale-105"
                      aria-label="Pause"
                    >
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5h3v14H8zm5 0h3v14h-3z" /></svg>
                    </button>
                    <button className="text-ink transition-colors hover:text-ink" aria-label="Next">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z" /></svg>
                    </button>
                    <button className="text-ink-muted transition-colors hover:text-ink" aria-label="Repeat">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4m14 3v2a4 4 0 0 1-4 4H3" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-surface/85 backdrop-blur-xl border border-line-strong/60 shadow-xl">
            <h4 className={sectionLabel}>Up next</h4>
            <div className="mt-4 space-y-1">
              {queueTracks.map((track, i) => (
                <div
                  key={i}
                  className="group flex items-center gap-4 rounded-md px-3 py-2.5 transition-colors hover:bg-white/5"
                >
                  <span className="w-5 text-right font-mono text-xs text-ink-faint">
                    {i + 2}
                  </span>
                  <div className="h-9 w-9 shrink-0 rounded-md bg-[linear-gradient(150deg,#2a2420,#12100e)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {track.title}
                    </p>
                    <p className="truncate text-xs text-ink-muted">{track.artist}</p>
                  </div>
                  <span className="font-mono text-xs text-ink-faint">
                    {track.duration}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </ScrollReveal>

        {/* People + chat */}
        <ScrollReveal
          animation="fade-up"
          distance={28}
          duration={850}
          delay={240}
          className="min-w-0 space-y-5"
        >
          <Card className="p-6 bg-surface/85 backdrop-blur-xl border border-line-strong/60 shadow-xl">
            <div className="flex items-center justify-between">
              <h4 className={sectionLabel}>
                People <span className="ml-1 font-mono text-accent">4</span>
              </h4>
              <span className="flex items-center gap-1.5 text-xs text-online">
                <span className="h-1.5 w-1.5 rounded-full bg-online" />
                All synced
              </span>
            </div>
            <div className="mt-4 space-y-1">
              {listeners.map((listener) => (
                <div
                  key={listener.name}
                  className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-white/5"
                >
                  <Avatar name={listener.name} size={36} online />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {listener.name}
                    </p>
                    <p className="text-xs text-ink-muted">Listening together</p>
                  </div>
                  {listener.isHost && (
                    <span className="rounded-full bg-accent-lo px-2 py-0.5 text-[10px] font-semibold text-accent">
                      HOST
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="flex max-h-80 flex-col p-6 bg-surface/85 backdrop-blur-xl border border-line-strong/60 shadow-xl">
            <h4 className={sectionLabel}>Chat</h4>
            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              {chatMessages.map((msg, index) => (
                <div key={index} className="flex gap-2">
                  <Avatar name={msg.user} size={28} />
                  <div className="min-w-0 flex-1 rounded-lg bg-white/3 px-3 py-2">
                    <p className="text-sm text-ink-muted">
                      <span className="font-medium text-ink">{msg.user}</span>{" "}
                      {msg.text}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-faint">{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
              <div className="flex-1 rounded-md border border-line bg-white/3 px-4 py-2.5 text-sm text-ink-faint">
                Message…
              </div>
              <button
                className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-accent text-accent-ink"
                aria-label="Send message"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
              </button>
            </div>
          </Card>
        </ScrollReveal>
      </div>
    </Section>
  );
}
