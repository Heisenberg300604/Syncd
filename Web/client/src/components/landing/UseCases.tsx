import { Section, SectionHeading } from "./Section";
import GlareHover from "../ui/GlareHover";
import { ScrollReveal, ParallaxImage } from "../ui/ScrollReveal";

const useCases = [
  {
    title: "Friends",
    description:
      "Listen to the same music while hanging out remotely — like sharing earbuds across the internet.",
    d: "M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  },
  {
    title: "Students",
    description:
      "Casual listening rooms with classmates during study sessions or breaks.",
    d: "M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 0 1 .665 6.479A11.952 11.952 0 0 0 12 20.055a11.952 11.952 0 0 0-6.824-2.998 12.078 12.078 0 0 1 .665-6.479L12 14z",
  },
  {
    title: "Communities",
    description:
      "A simple shared music space for Discord servers, subreddits, and gaming clans.",
    d: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    title: "Music lovers",
    description:
      "Discover and experience tracks together instead of alone — share the moment, not just the link.",
    d: "M9 18V5l12-3v13M9 18c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3zm12-3c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3z",
  },
];

function UseCasesBackground() {
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
      {/* Atmospheric grading to blend seamlessly into canvas */}
      <div className="absolute inset-0 bg-gradient-to-b from-canvas via-canvas/60 to-canvas" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-canvas to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-canvas to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_50%,transparent_15%,var(--color-canvas)_95%)]" />
    </div>
  );
}

export function UseCases() {
  return (
    <Section
      id="about"
      className="overflow-hidden border-y border-line"
      background={<UseCasesBackground />}
    >
      <SectionHeading
        title="Who is SyncD for?"
        subtitle="Anyone who believes music is better when it's shared."
      />

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {useCases.map((useCase, index) => (
          <ScrollReveal
            key={useCase.title}
            delay={index * 90}
            distance={24}
            className="h-full"
          >
            <GlareHover
              glareColor="#f7a23b"
              glareOpacity={0.25}
              glareAngle={-45}
              glareSize={280}
              transitionDuration={650}
              className="group block h-full w-full rounded-lg border border-line bg-raised/85 backdrop-blur-md p-6 shadow-md transition-all duration-300 hover:border-line-strong hover:bg-surface/90"
            >
              <div className="grid h-11 w-11 place-items-center rounded-md border border-line bg-white/3 text-accent transition-colors group-hover:bg-accent-lo group-hover:border-accent/30">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={useCase.d} />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink">
                {useCase.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                {useCase.description}
              </p>
            </GlareHover>
          </ScrollReveal>
        ))}
      </div>
    </Section>
  );
}
