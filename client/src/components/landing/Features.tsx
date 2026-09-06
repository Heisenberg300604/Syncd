import { Section, SectionHeading } from "./Section";

const features = [
  {
    title: "Shared music",
    description:
      "Everyone hears the same track together, perfectly synchronized.",
    d: "M9 18V5l12-3v13M9 18c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3zm12-3c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3z",
  },
  {
    title: "Real-time sync",
    description:
      "Playback stays aligned across everyone in the room, down to the second.",
    d: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    title: "Shared rooms",
    description:
      "Invite friends with a simple room code — no account needed to join.",
    d: "M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  },
  {
    title: "Live chat",
    description:
      "React, request, and talk about the music while you listen — in real time.",
    d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z",
  },
  {
    title: "Music search",
    description:
      "Find a song or paste a link and add it to the queue without leaving the room.",
    d: "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
  },
  {
    title: "Live presence",
    description:
      "See who is listening with you — avatars, status, and real-time activity.",
    d: "M18 9v6m3-3h-6m-3-2a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM3 20a6 6 0 0 1 12 0v1H3v-1z",
  },
];

export function Features() {
  return (
    <Section id="features">
      <SectionHeading
        title="Built for shared listening."
        subtitle="Every feature serves one goal: making music feel social again."
      />

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="group rounded-lg border border-line bg-raised p-6 shadow-md transition-colors hover:border-line-strong"
          >
            <div className="grid h-11 w-11 place-items-center rounded-md border border-line bg-white/3 text-accent transition-colors group-hover:bg-accent-lo group-hover:border-accent/30">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={feature.d} />
              </svg>
            </div>
            <h3 className="mt-4 text-base font-semibold text-ink">
              {feature.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              {feature.description}
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}
