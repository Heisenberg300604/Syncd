import { Button } from "../ui/Button";
import FloatingLines from "./FloatingLines";
import GlareHover from "../ui/GlareHover";
import { ScrollReveal } from "../ui/ScrollReveal";

export function FinalCTA() {
  return (
    <section id="final-cta" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Full-width edge-to-edge Floating Lines background */}
      <div
        className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden"
        aria-hidden="true"
      >
        <FloatingLines
          linesGradient={['#f7a23b', '#f97316', '#fbbf24', '#f59e0b']}
          enabledWaves={['top', 'middle', 'bottom']}
          lineCount={[6, 8, 6]}
          lineDistance={[5, 6, 5]}
          topWavePosition={{ x: 10.0, y: 0.5, rotate: -0.4 }}
          middleWavePosition={{ x: 5.0, y: 0.0, rotate: 0.2 }}
          bottomWavePosition={{ x: 2.0, y: -0.7, rotate: 0.4 }}
          animationSpeed={0.9}
          brightness={0.7}
          interactive={false}
          parallax={false}
          mixBlendMode="screen"
          className="h-full w-full opacity-55 blur-[4px]"
        />
        {/* Soft edge fades into adjacent sections */}
        <div className="absolute inset-0 bg-linear-to-b from-canvas via-transparent to-canvas" />
        {/* Soft center atmosphere to maximize text contrast */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(10,9,8,0.7)_0%,transparent_80%)]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <ScrollReveal animation="fade-up" distance={32} duration={900}>
          <div className="relative mx-auto max-w-3xl text-center">
            <div className="mb-6 sm:mb-8 flex justify-center">
              <div className="relative group inline-flex">
                {/* Multi-layered warm ambient backlight to give high contrast against dark canvas */}
                <div
                  className="absolute -inset-3 sm:-inset-4 rounded-3xl bg-gradient-to-tr from-amber-500/40 via-orange-500/35 to-amber-300/30 blur-2xl opacity-75 transition-all duration-500 group-hover:opacity-100 group-hover:blur-3xl"
                  aria-hidden="true"
                />

                {/* Sleek icon with border hugging the mark directly — eliminates outer black padding */}
                <img
                  src="/favicon.svg"
                  alt="SyncD Logo"
                  width={68}
                  height={68}
                  className="relative h-14 w-14 sm:h-[68px] sm:w-[68px] rounded-2xl sm:rounded-[17px] border border-amber-500/45 shadow-[0_8px_28px_rgba(0,0,0,0.7),0_0_22px_rgba(247,162,59,0.3)] ring-1 ring-white/15 transition-transform duration-300 ease-out group-hover:scale-105"
                />
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-4 py-1.5 text-sm text-ink-muted backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-online" />
              Ready to listen together?
            </div>

            <h2 className="mt-8 text-balance text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl lg:text-5xl drop-shadow-[0_2px_14px_rgba(0,0,0,0.9)]">
              Create a room, invite your people, press play.
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-ink-muted drop-shadow-[0_1px_8px_rgba(0,0,0,0.85)]">
              Your first room is free. No credit card, no commitment — just music.
            </p>

            <div className="mt-10 flex flex-col justify-center items-center gap-3 sm:flex-row">
              <GlareHover
                width="auto"
                height="auto"
                borderRadius="9999px"
                glareColor="#ffffff"
                glareOpacity={0.35}
                glareSize={220}
                className="rounded-full inline-flex"
              >
                <Button to="/enter" size="lg" pill glow className="group">
                  <svg
                    className="h-4 w-4 text-accent-ink"
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
                  Create your room
                </Button>
              </GlareHover>

              <GlareHover
                width="auto"
                height="auto"
                borderRadius="9999px"
                glareColor="#f7a23b"
                glareOpacity={0.3}
                glareSize={220}
                className="rounded-full inline-flex"
              >
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
                  Join with a code
                </Button>
              </GlareHover>
            </div>

            <p className="mt-8 text-sm text-ink-faint">
              Works on desktop, mobile, and tablet — wherever you listen.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

