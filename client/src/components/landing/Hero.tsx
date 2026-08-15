import { Link } from "react-router-dom";

const listeners = [
  { name: "Nibedan", initial: "N", color: "bg-violet-500" },
  { name: "Rahul", initial: "R", color: "bg-amber-500" },
  { name: "Aman", initial: "A", color: "bg-emerald-500" },
  { name: "Priya", initial: "P", color: "bg-rose-500" },
];

const queueTracks = [
  { title: "Midnight City", artist: "M83", duration: "4:03" },
  { title: "Runaway", artist: "AURORA", duration: "4:12" },
  { title: "Space Song", artist: "Beach House", duration: "5:21" },
  { title: "The Less I Know The Better", artist: "Tame Impala", duration: "3:36" },
];

const chatMessages = [
  { user: "Rahul", text: "This song is insane 😂", time: "2m ago" },
  { user: "Aman", text: "Bro play the next one", time: "5m ago" },
  { user: "Priya", text: "This is the one 🔥", time: "8m ago" },
];

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(139,92,246,0.08)_0%,_transparent_70%)]" aria-hidden="true" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 400 400%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22 opacity=%220.02%22/%3E%3C/svg%3E')]" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-6 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <h1 className="mb-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white">
              Listen together.{' '}
              <span className="text-violet-400">Stay in sync.</span>
            </h1>
            <p className="mb-8 text-lg sm:text-xl text-zinc-300 max-w-xl mx-auto lg:mx-0">
              Create a room, share the code, and enjoy music together in real time
              — wherever your friends are.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                to="/enter"
                className="rounded-lg bg-violet-500 px-8 py-3.5 text-base font-semibold text-white transition-all hover:bg-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-zinc-950 shadow-lg shadow-violet-500/20"
              >
                Create a Room
              </Link>
              <Link
                to="/join"
                className="rounded-lg border border-white/10 bg-white/5 px-8 py-3.5 text-base font-semibold text-white transition-all hover:bg-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-zinc-950 backdrop-blur-sm"
              >
                Join a Room
              </Link>
            </div>
            <p className="mt-6 text-sm text-zinc-500">No account required to join · Free forever</p>
          </div>

          <div className="relative">
            <div className="relative bg-zinc-950/50 border border-white/10 rounded-2xl lg:rounded-3xl p-4 lg:p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
              <div className="space-y-4 lg:space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center">
                      <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Now Playing</p>
                      <p className="text-xs text-zinc-400">Synced across 4 listeners</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                      LIVE
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-900/50 rounded-xl p-4 border border-white/5">
                  <div className="flex items-start gap-4">
                    <div className="relative h-24 w-24 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900">
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/30 to-indigo-600/30" />
                      <svg className="absolute inset-0 h-full w-full text-white/10" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <h3 className="font-medium text-white truncate">Midnight City</h3>
                      <p className="text-sm text-zinc-400 truncate">M83 · Hurry Up, We're Dreaming</p>
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 bg-zinc-800 rounded-full flex-1 overflow-hidden">
                            <div className="h-full w-2/3 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full" />
                          </div>
                          <span className="text-xs text-zinc-500 font-mono w-10 text-right">1:42</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <button className="p-1 hover:text-white transition-colors" aria-label="Previous">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                          </button>
                          <button className="p-2 rounded-full bg-violet-500 text-white hover:bg-violet-400 transition-colors" aria-label="Play">
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                          </button>
                          <button className="p-1 hover:text-white transition-colors" aria-label="Next">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/50 rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-white">Room</h4>
                    <button className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1" aria-label="Copy room code">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                      Copy
                    </button>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 rounded-lg border border-white/5 font-mono text-base tracking-widest text-violet-400">
                    ROOM-7XK9
                  </div>
                </div>

                <div className="bg-zinc-900/50 rounded-xl p-4 border border-white/5">
                  <h4 className="text-sm font-medium text-white mb-3">People <span className="text-violet-400 font-mono">4</span></h4>
                  <div className="flex items-center gap-2">
                    {listeners.map((listener, i) => (
                      <div key={listener.name} className="relative" style={{ zIndex: listeners.length - i }}>
                        <div className={`h-10 w-10 rounded-full ${listener.color} flex items-center justify-center text-white font-medium text-sm border-2 border-zinc-950`}>
                          {listener.initial}
                        </div>
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-emerald-500 border-2 border-zinc-950" aria-label={`${listener.name} is online`} />
                      </div>
                    ))}
                    <div className="ml-2 text-sm text-zinc-400">+2 more</div>
                  </div>
                </div>

                <div className="bg-zinc-900/50 rounded-xl p-4 border border-white/5">
                  <h4 className="text-sm font-medium text-white mb-3">Queue <span className="text-zinc-400 font-mono">4</span></h4>
                  <div className="space-y-2">
                    {queueTracks.map((track, i) => (
                      <div key={i} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors">
                        <span className="text-xs text-zinc-500 font-mono w-6 text-right">{i + 2}.</span>
                        <div className="h-8 w-8 rounded flex-shrink-0 bg-gradient-to-br from-zinc-700 to-zinc-800" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{track.title}</p>
                          <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
                        </div>
                        <span className="text-xs text-zinc-500 font-mono">{track.duration}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-900/50 rounded-xl p-4 border border-white/5 max-h-48 overflow-y-auto">
                  <h4 className="text-sm font-medium text-white mb-3">Chat</h4>
                  <div className="space-y-3">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="h-6 w-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-300 flex-shrink-0">
                          {msg.user[0]}
                        </div>
                        <div className="flex-1 min-w-0 bg-zinc-900/50 rounded-lg px-3 py-2">
                          <p className="text-xs text-zinc-300"><span className="font-medium text-white">{msg.user}</span> {msg.text}</p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">{msg.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-6 -right-6 lg:-bottom-8 lg:-right-8 h-32 w-32 rounded-full bg-gradient-to-tr from-violet-500/20 to-transparent blur-3xl" aria-hidden="true" />
            <div className="absolute -top-6 -left-6 lg:-top-8 lg:-left-8 h-32 w-32 rounded-full bg-gradient-to-bl from-indigo-500/15 to-transparent blur-3xl" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}