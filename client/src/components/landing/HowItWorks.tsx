import { Section, SectionHeading } from "./Section";

const steps = [
  {
    number: "01",
    title: "Create a room",
    description: "Start a listening room in seconds and become the host.",
  },
  {
    number: "02",
    title: "Share the code",
    description: "Send your room code to your friends or group.",
    code: "ROOM-7XK9",
  },
  {
    number: "03",
    title: "Listen together",
    description:
      "Search for music, press play, and everyone follows the same playback in sync.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <SectionHeading
        title="Listening together is simple."
        subtitle="Three steps. Zero friction. Instant shared listening."
      />

      <div className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
        {/* connecting rule */}
        <div
          className="pointer-events-none absolute left-0 right-0 top-10 hidden h-px bg-gradient-to-r from-transparent via-line-strong to-transparent md:block"
          aria-hidden="true"
        />

        {steps.map((step) => (
          <div
            key={step.number}
            className="relative z-10 flex flex-col items-center text-center"
          >
            <div className="grid h-20 w-20 place-items-center rounded-lg border border-line bg-raised shadow-md">
              <span className="font-mono text-2xl font-medium text-accent">
                {step.number}
              </span>
            </div>
            <h3 className="mt-6 text-lg font-semibold text-ink">{step.title}</h3>
            <p className="mt-2 max-w-xs text-sm text-ink-muted">
              {step.description}
            </p>
            {step.code && (
              <div className="mt-4 rounded-md border border-line bg-white/3 px-4 py-2 font-mono text-sm tracking-[0.2em] text-accent">
                {step.code}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
