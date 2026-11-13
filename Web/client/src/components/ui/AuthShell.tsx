import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

interface AuthShellProps {
  title?: string;
  subtitle?: string;
  /** Roomier column — used to host the Clerk widget, which sizes its own card. */
  wide?: boolean;
  children: ReactNode;
}

/**
 * Centered, branded frame for the auth / onboarding / status screens. Same
 * cinematic backdrop as the landing hero so the whole product feels continuous.
 */
export function AuthShell({ title, subtitle, wide, children }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-16">
      {/* Atmospheric backdrop */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <img
          src="/hero-background-abstract.png"
          alt=""
          className="h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-canvas/70 via-canvas/85 to-canvas" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_55%_50%_at_15%_100%,var(--color-accent-lo),transparent_70%)]" />
      </div>

      <div className={`relative w-full ${wide ? "max-w-[28rem]" : "max-w-sm"}`}>
        <Link to="/" aria-label="SyncD home" className="mb-8 flex justify-center">
          <Logo size={26} />
        </Link>

        {title && (
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
            {subtitle && (
              <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
