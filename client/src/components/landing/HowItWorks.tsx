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
    description: "Search for music, press play, and everyone follows the same playback in sync.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 lg:py-32 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.06)_0%,_transparent_60%)]" aria-hidden="true" />
      
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="text-center mb-16 lg:mb-20">
          <h2 className="mb-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            Listening together is simple.
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Three steps. Zero friction. Instant shared listening.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 relative">
          <div className="relative hidden lg:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent pointer-events-none" aria-hidden="true" />
          
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="relative flex flex-col items-center text-center z-10"
            >
              <div className="mb-6 relative">
                <div className="h-20 w-20 rounded-2xl bg-zinc-900/50 border border-white/10 flex items-center justify-center shadow-lg shadow-black/30 backdrop-blur-sm">
                  <span className="text-3xl font-bold text-white tracking-tight">{step.number}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-10 left-[calc(50%+6.25rem)] w-[calc(100%-12.5rem)] h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" aria-hidden="true" />
                )}
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white">{step.title}</h3>
              <p className="text-zinc-400 max-w-xs">{step.description}</p>
              {step.code && (
                <div className="mt-4 px-4 py-2 bg-zinc-900/50 border border-white/10 rounded-lg font-mono text-violet-400 tracking-widest text-sm">
                  {step.code}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}