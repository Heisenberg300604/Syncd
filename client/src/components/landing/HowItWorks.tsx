import { Section, SectionHeading } from "./Section";
import { ScrollReveal, ParallaxImage } from "../ui/ScrollReveal";

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

function HowItWorksBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <ParallaxImage
        src="/bottom-landscape-headphones.webp"
        speed={0.14}
        opacity={0.5}
      />
      {/* Atmospheric grading to blend seamlessly with canvas */}
      <div className="absolute inset-0 bg-gradient-to-b from-canvas via-canvas/60 to-canvas" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-canvas to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-canvas to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_45%,transparent_15%,var(--color-canvas)_95%)]" />
    </div>
  );
}

export function HowItWorks() {
  return (
    <Section
      id="how-it-works"
      className="overflow-hidden"
      background={<HowItWorksBackground />}
    >
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

        {steps.map((step, index) => (
          <ScrollReveal
            key={step.number}
            delay={index * 130}
            distance={28}
            className="relative z-10 flex flex-col items-center text-center"
          >
            <div className="grid h-20 w-20 place-items-center rounded-lg border border-line bg-raised/85 shadow-lg backdrop-blur-md transition-transform duration-300 hover:scale-105">
              <span className="font-mono text-2xl font-medium text-accent">
                {step.number}
              </span>
            </div>
            <h3 className="mt-6 text-lg font-semibold text-ink">{step.title}</h3>
            <p className="mt-2 max-w-xs text-sm text-ink-muted">
              {step.description}
            </p>
            {step.code && (
              <div className="mt-4 rounded-md border border-line bg-surface/80 px-4 py-2 font-mono text-sm tracking-[0.2em] text-accent backdrop-blur-md">
                {step.code}
              </div>
            )}
          </ScrollReveal>
        ))}
      </div>
    </Section>
  );
}
