import { useEffect, useState } from "react";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 320);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-40 transition-all duration-300 sm:bottom-8 sm:right-8 ${
        visible
          ? "translate-y-0 opacity-100 pointer-events-auto scale-100"
          : "translate-y-4 opacity-0 pointer-events-none scale-90"
      }`}
    >
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Scroll to top of page"
        className="group grid h-12 w-12 place-items-center rounded-full border border-line bg-raised/90 text-ink-muted shadow-lg backdrop-blur-md transition-all duration-300 hover:border-accent/60 hover:bg-surface hover:text-accent hover:shadow-[0_0_24px_rgba(247,162,59,0.25)] active:scale-95 cursor-pointer"
      >
        <svg
          className="h-5 w-5 transition-transform duration-200 group-hover:scale-110"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.2}
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
      </button>
    </div>
  );
}
