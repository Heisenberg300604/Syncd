export function SyncDifferentiator() {
  return (
    <section id="sync-differentiator" className="py-20 lg:py-32 bg-zinc-950/50 border-y border-white/5 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(139,92,246,0.08)_0%,_transparent_60%)]" aria-hidden="true" />
      
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <h2 className="mb-6 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
              Everyone hears the{' '}
              <span className="text-violet-400">same moment.</span>
            </h2>
            <h3 className="mb-4 text-xl text-zinc-300 font-medium">Press play once. Everyone follows.</h3>
            <p className="text-lg text-zinc-400 leading-relaxed max-w-xl mx-auto lg:mx-0">
              SyncD keeps the room's playback synchronized so everyone can experience
              the same song together, even when they're listening from different devices.
            </p>
          </div>

          <div className="relative">
            <div className="bg-zinc-950/50 border border-white/10 rounded-2xl lg:rounded-3xl p-6 lg:p-8 shadow-2xl shadow-black/50 backdrop-blur-xl relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(139,92,246,0.06)_0%,_transparent_70%)]" aria-hidden="true" />
              
              <div className="relative flex flex-col items-center gap-8">
                <div className="relative z-10">
                  <div className="h-24 w-24 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-indigo-600/20" />
                    <svg className="h-12 w-12 text-white/20" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <button className="h-10 w-10 rounded-full bg-violet-500/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-violet-500/30 transition-colors" aria-label="Play">
                        <svg className="h-5 w-5 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-sm font-medium text-white">Midnight City — M83</p>
                    <div className="mt-2 flex items-center justify-center gap-2">
                      <span className="text-xs font-mono text-zinc-400">1:42</span>
                      <div className="h-1 w-32 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full w-2/5 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full" />
                      </div>
                      <span className="text-xs font-mono text-zinc-400">4:03</span>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 flex items-center justify-center gap-4 lg:gap-8 flex-wrap">
                  {[
                    { name: "Nibedan", color: "bg-violet-500", initial: "N", device: "Desktop" },
                    { name: "Rahul", color: "bg-amber-500", initial: "R", device: "Mobile" },
                    { name: "Aman", color: "bg-emerald-500", initial: "A", device: "Tablet" },
                    { name: "Priya", color: "bg-rose-500", initial: "P", device: "Phone" },
                  ].map((listener) => (
                    <div key={listener.name} className="flex flex-col items-center gap-2 group relative">
                      <div className="relative">
                        <svg className="h-20 w-20 text-white/5 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                          <circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeDasharray="282.7"
                            strokeDashoffset="164"
                            className="text-violet-500/50"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke="url(#sync-gradient)"
                            strokeWidth="3"
                            strokeDasharray="282.7"
                            strokeDashoffset="164"
                            className="transition-all duration-1000"
                          />
                          <defs>
                            <linearGradient id="sync-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#a855f7" />
                              <stop offset="100%" stopColor="#6366f1" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className={`h-14 w-14 rounded-full ${listener.color} flex items-center justify-center text-white font-medium text-sm border-2 border-zinc-950 relative z-10`}>
                            {listener.initial}
                          </div>
                        </div>
                        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-emerald-500 border-2 border-zinc-950" aria-hidden="true" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-white">{listener.name}</p>
                        <p className="text-xs text-zinc-500">{listener.device}</p>
                      </div>
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-violet-500/50 animate-pulse" aria-hidden="true" />
                    </div>
                  ))}
                </div>

                <div className="relative z-10 mt-4 grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Progress", value: "1:42 / 4:03" },
                    { label: "Volume", value: "78%" },
                    { label: "Quality", value: "320 kbps" },
                    { label: "Latency", value: "< 50ms" },
                  ].map((stat) => (
                    <div key={stat.label} className="px-3 py-2 bg-zinc-900/50 border border-white/5 rounded-lg">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider">{stat.label}</p>
                      <p className="text-sm font-mono text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}