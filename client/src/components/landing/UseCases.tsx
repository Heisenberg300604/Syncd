const useCases = [
  {
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: "Friends",
    description: "Listen to the same music while hanging out remotely — like sharing earbuds across the internet.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" />
      </svg>
    ),
    title: "Students",
    description: "Create casual listening rooms with friends and classmates during study sessions or breaks.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Communities",
    description: "Give small groups a simple shared music space — Discord servers, subreddits, gaming clans.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.905 1.523 3.454 3.4 3.91M9 19a4 4 0 004 4h5a4 4 0 004-4" />
      </svg>
    ),
    title: "Music Lovers",
    description: "Discover and experience tracks together instead of listening alone — share the moment, not just the link.",
  },
];

export function UseCases() {
  return (
    <section id="about" className="py-20 lg:py-32 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.04)_0%,_transparent_60%)]" aria-hidden="true" />
      
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="text-center mb-16 lg:mb-20">
          <h2 className="mb-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            Who is SyncD for?
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Anyone who believes music is better when it's shared.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {useCases.map((useCase) => (
            <article
              key={useCase.title}
              className="group bg-zinc-950/50 border border-white/10 rounded-2xl p-6 lg:p-8 transition-all duration-300 hover:border-white/20 hover:bg-zinc-950/80"
            >
              <div className="mb-4 h-12 w-12 rounded-xl bg-zinc-900/50 border border-white/10 flex items-center justify-center text-violet-400 group-hover:bg-violet-500/10 group-hover:border-violet-500/20 transition-colors">
                {useCase.icon}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">{useCase.title}</h3>
              <p className="text-zinc-400 leading-relaxed">{useCase.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}