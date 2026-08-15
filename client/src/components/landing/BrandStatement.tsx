export function BrandStatement() {
  return (
    <section id="brand-statement" className="py-20 lg:py-32 bg-zinc-950/50 border-y border-white/5 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(139,92,246,0.06)_0%,_transparent_70%)]" aria-hidden="true" />
      
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <div className="mb-8 flex items-center justify-center gap-4">
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" aria-hidden="true" />
          <svg className="h-10 w-10 text-violet-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.905 1.523 3.454 3.4 3.91M9 19a4 4 0 004 4h5a4 4 0 004-4" />
          </svg>
          <div className="h-px w-24 bg-gradient-to-r from-violet-500/30 via-transparent to-transparent" aria-hidden="true" />
        </div>

        <h2 className="mb-6 text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight text-white leading-tight">
          Music feels better together.
        </h2>
        
        <p className="text-lg sm:text-xl text-zinc-300 max-w-2xl mx-auto leading-relaxed">
          SyncD turns listening into a shared experience — without the noise and complexity
          of a full video call.
        </p>

        <div className="mt-16 flex items-center justify-center gap-8 lg:gap-16 text-center">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-violet-500/10 to-indigo-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="h-12 w-12 text-violet-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.905 1.523 3.454 3.4 3.91M9 19a4 4 0 004 4h5a4 4 0 004-4" />
              </svg>
            </div>
            <p className="text-sm text-zinc-400">Zero latency sync</p>
          </div>
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-violet-500/10 to-indigo-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="h-12 w-12 text-violet-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-sm text-zinc-400">Real-time presence</p>
          </div>
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-violet-500/10 to-indigo-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="h-12 w-12 text-violet-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm text-zinc-400">Live chat & reactions</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-32 w-32 rounded-full bg-gradient-to-t from-violet-500/10 to-transparent blur-3xl" aria-hidden="true" />
    </section>
  );
}