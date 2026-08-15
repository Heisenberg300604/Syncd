const currentTrack = {
  title: "Midnight City",
  artist: "M83",
  album: "Hurry Up, We're Dreaming",
  duration: "4:03",
  progress: 0.42,
};

const queueTracks = [
  { title: "Runaway", artist: "AURORA", duration: "4:12" },
  { title: "Space Song", artist: "Beach House", duration: "5:21" },
  { title: "The Less I Know The Better", artist: "Tame Impala", duration: "3:36" },
  { title: "Electric Feel", artist: "MGMT", duration: "3:50" },
  { title: "Holocene", artist: "Bon Iver", duration: "5:36" },
];

const listeners = [
  { name: "Nibedan", initial: "N", color: "bg-violet-500", isHost: true },
  { name: "Rahul", initial: "R", color: "bg-amber-500", isHost: false },
  { name: "Aman", initial: "A", color: "bg-emerald-500", isHost: false },
  { name: "Priya", initial: "P", color: "bg-rose-500", isHost: false },
];

const chatMessages = [
  { user: "Rahul", text: "This song is insane 😂", time: "2m ago" },
  { user: "Aman", text: "Bro play the next one", time: "5m ago" },
  { user: "Priya", text: "This is the one 🔥", time: "8m ago" },
  { user: "Nibedan", text: "Queue updated with Beach House", time: "12m ago" },
];

export function ProductShowcase() {
  return (
    <section id="showcase" className="py-20 lg:py-32 bg-zinc-950/30 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(139,92,246,0.05)_0%,_transparent_60%)]" aria-hidden="true" />
      
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="mb-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            Everything you need for a shared listening session.
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            A complete room interface built for synchronous music experiences.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-950/50 border border-white/10 rounded-2xl p-6 shadow-xl shadow-black/30 backdrop-blur-xl">
              <div className="flex items-start gap-6">
                <div className="relative h-40 w-40 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-indigo-600/20" />
                  <svg className="absolute inset-0 h-full w-full text-white/10" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button className="h-14 w-14 rounded-full bg-violet-500/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-violet-500/30 transition-colors" aria-label="Play">
                      <svg className="h-7 w-7 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                  </div>
                </div>
                <div className="flex-1 min-w-0 pt-2">
                  <h3 className="text-2xl font-bold text-white truncate">{currentTrack.title}</h3>
                  <p className="text-zinc-400 mt-1">{currentTrack.artist} · {currentTrack.album}</p>
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-zinc-400 w-10 text-right">0:00</span>
                      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all" style={{ width: `${currentTrack.progress * 100}%` }} />
                      </div>
                      <span className="text-sm font-mono text-zinc-400 w-10">{currentTrack.duration}</span>
                    </div>
                    <div className="flex items-center justify-center gap-6">
                      <button className="p-2 rounded-full bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors" aria-label="Shuffle">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                      </button>
                      <button className="p-2 rounded-full bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors" aria-label="Previous">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                      </button>
                      <button className="h-14 w-14 rounded-full bg-violet-500 text-white hover:bg-violet-600 transition-colors flex items-center justify-center shadow-lg shadow-violet-500/30" aria-label="Play">
                        <svg className="h-7 w-7 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      </button>
                      <button className="p-2 rounded-full bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors" aria-label="Next">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z"/></svg>
                      </button>
                      <button className="p-2 rounded-full bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors" aria-label="Repeat">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-950/50 border border-white/10 rounded-2xl p-6 shadow-xl shadow-black/30 backdrop-blur-xl">
              <h4 className="mb-4 text-sm font-medium text-white uppercase tracking-wider">Up Next</h4>
              <div className="space-y-3">
                {queueTracks.map((track, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-white/5 transition-colors group"
                  >
                    <span className="text-sm font-mono text-zinc-500 w-6 text-right group-hover:text-zinc-300 transition-colors">{i + 2}.</span>
                    <div className="h-10 w-10 rounded-lg flex-shrink-0 bg-gradient-to-br from-zinc-700 to-zinc-800 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{track.title}</p>
                      <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
                    </div>
                    <span className="text-xs text-zinc-500 font-mono">{track.duration}</span>
                    <button className="p-2 rounded-lg bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors opacity-0 group-hover:opacity-100" aria-label="More options">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-zinc-950/50 border border-white/10 rounded-2xl p-6 shadow-xl shadow-black/30 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-white uppercase tracking-wider">People <span className="text-violet-400 font-mono ml-2">4</span></h4>
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                  All synced
                </span>
              </div>
              <div className="space-y-3">
                {listeners.map((listener) => (
                  <div key={listener.name} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors">
                    <div className="relative h-10 w-10 flex-shrink-0 rounded-full">
                      <div className={`h-full w-full rounded-full ${listener.color} flex items-center justify-center text-white font-medium text-sm`}>
                        {listener.initial}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-zinc-950" aria-label={`${listener.name} is online`} />
                      {listener.isHost && (
                        <span className="absolute -top-0.5 -left-0.5 bg-violet-500 text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white">HOST</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{listener.name}</p>
                      <p className="text-xs text-zinc-400">Listening together</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-950/50 border border-white/10 rounded-2xl p-6 shadow-xl shadow-black/30 backdrop-blur-xl max-h-80 flex flex-col">
              <h4 className="mb-4 text-sm font-medium text-white uppercase tracking-wider">Chat</h4>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {chatMessages.map((msg, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="h-7 w-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-300 flex-shrink-0">
                      {msg.user[0]}
                    </div>
                    <div className="flex-1 min-w-0 bg-zinc-900/50 rounded-xl px-3 py-2.5">
                      <p className="text-sm text-zinc-300"><span className="font-medium text-white">{msg.user}</span> {msg.text}</p>
                      <p className="text-[11px] text-zinc-600 mt-1">{msg.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Message..."
                    className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50"
                    aria-label="Chat message"
                  />
                  <button className="p-2.5 rounded-xl bg-violet-500 text-white hover:bg-violet-600 transition-colors" aria-label="Send message">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}