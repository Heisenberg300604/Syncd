import { Section } from "./Section";
import { Button } from "../ui/Button";

export function FinalCTA() {
  return (
    <Section id="final-cta" className="overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        aria-hidden="true"
      >
        <img
          src="/abstract-audio-wave.png"
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-b from-canvas via-canvas/70 to-canvas" />
      </div>

      <div className="relative mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-4 py-1.5 text-sm text-ink-muted backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-online" />
          Ready to listen together?
        </div>

        <h2 className="mt-8 text-balance text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl lg:text-5xl">
          Create a room, invite your people, press play.
        </h2>

        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-ink-muted">
          Your first room is free. No credit card, no commitment — just music.
        </p>

        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Button to="/enter" size="lg" pill glow>
            Create your room
          </Button>
          <Button to="/enter" size="lg" variant="secondary" pill>
            Join with a code
          </Button>
        </div>

        <p className="mt-8 text-sm text-ink-faint">
          Works on desktop, mobile, and tablet — wherever you listen.
        </p>
      </div>
    </Section>
  );
}
