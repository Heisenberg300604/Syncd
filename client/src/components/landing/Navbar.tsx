import { useState } from "react";
import { Link } from "react-router-dom";

const navLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#about", label: "About" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen((prev) => !prev);
  const closeMenu = () => setIsOpen(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-zinc-950/80 backdrop-blur-md border-b border-white/5">
      <nav
        className="mx-auto max-w-7xl px-6"
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white"
            aria-label="SyncD home"
          >
            <svg
              className="h-7 w-7 text-violet-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <span>SyncD</span>
          </Link>

          <div className="hidden md:flex md:items-center md:gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-sm font-medium text-zinc-300 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex md:items-center md:gap-4">
            <Link
              to="/signin"
              className="text-sm font-medium text-zinc-300 transition-colors hover:text-white"
            >
              Sign In
            </Link>
            <Link
              to="/enter"
              className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              Get Started
            </Link>
          </div>

          <button
            className="md:hidden p-2 rounded-lg text-zinc-300 transition-colors hover:text-white hover:bg-white/5"
            onClick={toggleMenu}
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            aria-label={isOpen ? "Close menu" : "Open menu"}
          >
            {isOpen ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        <div
          id="mobile-menu"
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
          role="navigation"
          aria-label="Mobile navigation"
        >
          <div className="py-6 space-y-4 border-t border-white/5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="block text-base font-medium text-zinc-300 transition-colors hover:text-white"
                onClick={closeMenu}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-4 space-y-3 border-t border-white/5">
              <Link
                to="/signin"
                className="block text-base font-medium text-zinc-300 transition-colors hover:text-white"
                onClick={closeMenu}
              >
                Sign In
              </Link>
              <Link
                to="/enter"
                className="block w-full text-center rounded-lg bg-violet-500 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-violet-600"
                onClick={closeMenu}
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}