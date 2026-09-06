import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

interface AppHeaderProps {
  /** Right-aligned actions — typically the Clerk <UserButton />. */
  actions?: ReactNode;
  /** Optional content between the logo and the actions (e.g. room summary). */
  children?: ReactNode;
}

/** Shared product top bar. Keeps Home and Room visually identical up top. */
export function AppHeader({ actions, children }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:px-8">
        <Link to="/" aria-label="SyncD home" className="shrink-0">
          <Logo />
        </Link>
        {children && <div className="min-w-0 flex-1">{children}</div>}
        {!children && <div className="flex-1" />}
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
