import { Section } from "./Section";

const pillars = [
  {
    label: "Aligned playback",
    d: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    label: "Real-time presence",
    d: "M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  },
  {
    label: "Chat & reactions",
    d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z",
  },
];

export function BrandStatement() {
  return (
    <Section id="brand-statement" raised glow>
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-balance text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl lg:text-5xl">
          Music feels better together.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-ink-muted">
          SyncD turns listening into a shared experience — without the noise and
          complexity of a full video call.
        </p>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
          {pillars.map((pillar) => (
            <div key={pillar.label} className="flex flex-col items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-full border border-line bg-white/3 text-accent">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={pillar.d} />
                </svg>
              </div>
              <p className="text-sm text-ink-muted">{pillar.label}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
