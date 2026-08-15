import { Link } from "react-router-dom";

export function FinalCTA() {
  return (
    <section id="final-cta" className="py-20 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 via-transparent to-transparent" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(139,92,246,0.08)_0%,_transparent_60%)]" aria-hidden="true" />
      
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-950/50 border border-white/10 mb-8 text-sm text-zinc-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
          Ready to listen together?
        </div>

        <h2 className="mb-6 text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight text-white leading-tight">
          Create a room, invite your people, and press play.
        </h2>
        
        <p className="mb-10 text-lg sm:text-xl text-zinc-300 max-w-2xl mx-auto leading-relaxed">
          Your first room is free. No credit card. No commitment. Just music.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/enter"
            className="rounded-lg bg-violet-500 px-8 py-3.5 text-base font-semibold text-white transition-all hover:bg-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-zinc-950 shadow-lg shadow-violet-500/20"
          >
            Create Your Room
          </Link>
          <Link
            to="/join"
            className="rounded-lg border border-white/10 bg-white/5 px-8 py-3.5 text-base font-semibold text-white transition-all hover:bg-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-zinc-950 backdrop-blur-sm"
          >
            Already have a room? Join with a code
          </Link>
        </div>

        <p className="mt-8 text-sm text-zinc-500">
          Works on desktop, mobile, and tablet — wherever you listen.
        </p>
      </div>

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-32 w-32 rounded-full bg-gradient-to-t from-violet-500/10 to-transparent blur-3xl" aria-hidden="true" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-32 w-32 rounded-full bg-gradient-to-b from-violet-500/10 to-transparent blur-3xl" aria-hidden="true" />
    </section>
  );
}