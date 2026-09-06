import { Section } from "./Section";
import { Card } from "../ui/Card";
import { Avatar } from "../ui/Avatar";
import { EqualizerBars } from "../ui/EqualizerBars";

const devices = [
  { name: "Nibedan", device: "Desktop" },
  { name: "Rahul", device: "Mobile" },
  { name: "Aman", device: "Tablet" },
  { name: "Priya", device: "Laptop" },
];

export function SyncDifferentiator() {
  return (
    <Section id="sync-differentiator" raised>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="text-center lg:text-left">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Everyone hears the{" "}
            <span className="text-accent">same moment.</span>
          </h2>
          <p className="mt-4 text-lg font-medium text-ink">
            Press play once. Everyone follows.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-ink-muted lg:mx-0">
            SyncD keeps the room's playback aligned so everyone experiences the
            same song together — even on different devices, in different places.
          </p>
        </div>

        <Card level="overlay" className="relative overflow-hidden p-6 sm:p-8">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,var(--color-accent-lo),transparent_70%)]"
            aria-hidden="true"
          />

          <div className="relative flex flex-col items-center gap-8">
            {/* Shared track */}
            <div className="text-center">
              <div className="relative mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-lg bg-[linear-gradient(160deg,#4a2a1c,#241228)]">
                <EqualizerBars className="h-6" />
              </div>
              <p className="mt-3 text-sm font-medium text-ink">
                Midnight City — M83
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="font-mono text-xs text-ink-faint">1:42</span>
                <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-2/5 rounded-full bg-accent" />
                </div>
                <span className="font-mono text-xs text-ink-faint">4:03</span>
              </div>
            </div>

            {/* Locked listeners */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
              {devices.map((d) => (
                <div key={d.name} className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <span className="absolute -inset-1.5 rounded-full ring-1 ring-accent/40" />
                    <Avatar name={d.name} size={48} online />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-ink">{d.name}</p>
                    <p className="text-[11px] text-ink-faint">{d.device}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-full border border-line bg-white/3 px-3 py-1.5 text-xs text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-online" />
              Playheads aligned · drift &lt; 50&nbsp;ms
            </div>
          </div>
        </Card>
      </div>
    </Section>
  );
}
