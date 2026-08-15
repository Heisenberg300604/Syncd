const features = [
  {
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.905 1.523 3.454 3.4 3.91M9 19a4 4 0 004 4h5a4 4 0 004-4" />
      </svg>
    ),
    title: "Shared Music",
    description: "Everyone listens to the same track together, perfectly synchronized.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Real-Time Sync",
    description: "Playback stays synchronized across everyone in the room, down to the millisecond.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: "Shared Rooms",
    description: "Create a room and invite friends with a simple room code — no accounts needed to join.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    title: "Live Chat",
    description: "Talk about the music while you listen — reactions, requests, and conversation in real time.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    title: "Music Search",
    description: "Find music quickly and add it to the session queue without leaving the room.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
    title: "Live Presence",
    description: "See who is currently listening with you — avatars, status, and real-time activity.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 lg:py-32 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(139,92,246,0.04)_0%,_transparent_70%)]" aria-hidden="true" />
      
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="text-center mb-16 lg:mb-20">
          <h2 className="mb-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            Built for shared listening.
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Every feature designed around one goal: making music feel social again.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="group relative bg-zinc-950/50 border border-white/10 rounded-2xl p-6 lg:p-8 transition-all duration-300 hover:border-white/20 hover:bg-zinc-950/80 hover:shadow-xl hover:shadow-black/30"
            >
              <div className="mb-4 h-12 w-12 rounded-xl bg-zinc-900/50 border border-white/10 flex items-center justify-center text-violet-400 group-hover:bg-violet-500/10 group-hover:border-violet-500/20 transition-colors">
                {feature.icon}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">{feature.title}</h3>
              <p className="text-zinc-400 leading-relaxed">{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}