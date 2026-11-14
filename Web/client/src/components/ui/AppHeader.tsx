import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

interface AppHeaderProps {
  /** Right-aligned actions — typically the Clerk <UserButton />. */
  actions?: ReactNode;
  /** Optional content between the logo and the actions (e.g. room summary, search bar). */
  children?: ReactNode;
  /** Custom max width for inner container — e.g. "max-w-7xl", "w-full". Defaults to "max-w-6xl". */
  maxWidth?: string;
  /** Custom padding or container classes. */
  containerClassName?: string;
}

/** Shared product top bar. Keeps Home and Room visually identical up top. */
export function AppHeader({
  actions,
  children,
  maxWidth = "max-w-6xl",
  containerClassName = "px-5 sm:px-8",
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-md">
      <div
        className={`mx-auto flex h-16 ${maxWidth} items-center gap-3 sm:gap-4 ${containerClassName}`}
      >
        <Link to="/" aria-label="SyncD home" className="shrink-0">
          <Logo />
        </Link>
        {children && (
          <div className="flex min-w-0 flex-1 items-center justify-center px-1 sm:px-4">
            {children}
          </div>
        )}
        {!children && <div className="flex-1" />}
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
