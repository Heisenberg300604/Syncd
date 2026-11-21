import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth, useUser, useClerk, SignIn } from "@clerk/react";
import { AuthShell } from "../components/ui/AuthShell";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { getDesktopAuthCode, checkDesktopCodeStatus } from "../services/api";

const clerkAppearance = {
  variables: {
    colorPrimary: "#f7a23b",
    colorText: "#f5f3f0",
    colorTextSecondary: "#b0a79c",
    colorBackground: "#181512",
    colorInputBackground: "#201b16",
    colorInputText: "#f5f3f0",
    colorDanger: "#f87171",
    colorSuccess: "#34d399",
    borderRadius: "12px",
    fontFamily: '"Manrope", ui-sans-serif, system-ui, sans-serif',
  },
};

export function DesktopAuth() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();

  const [code, setCode] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isClaimed, setIsClaimed] = useState<boolean>(false);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedOnceRef = useRef(false);
  const isClaimedRef = useRef(false);
  const isSigningOutRef = useRef(false);
  const signOutCalledRef = useRef(false);

  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  });

  const performSignOut = useCallback(async () => {
    if (signOutCalledRef.current) return;
    signOutCalledRef.current = true;
    isSigningOutRef.current = true;
    setIsSigningOut(true);

    try {
      await signOut({ redirectUrl: "/desktop-auth" });
    } catch (err) {
      console.warn("Clerk signOut error, redirecting:", err);
      window.location.href = "/desktop-auth";
    }
  }, [signOut]);

  const fetchCode = useCallback(async () => {
    if (!isSignedIn) return;
    setIsLoading(true);
    setErrorMessage(null);
    setCopied(false);
    setIsClaimed(false);
    setIsSigningOut(false);
    isClaimedRef.current = false;
    isSigningOutRef.current = false;
    signOutCalledRef.current = false;

    try {
      const username = user?.username || user?.firstName || undefined;
      const res = await getDesktopAuthCode(getTokenRef.current, username);
      if (res.ok && res.code) {
        setCode(res.code);
        setSecondsRemaining(res.expiresInSeconds || 120);
        if (typeof res.attemptsRemaining === "number") {
          setAttemptsRemaining(res.attemptsRemaining);
        }
      } else {
        throw new Error("Unable to generate desktop linking code.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to obtain desktop linking code.";
      setErrorMessage(msg);
      if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 429) {
        setAttemptsRemaining(0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, user]);

  // Initial code fetch once signed in (strictly once)
  useEffect(() => {
    if (isLoaded && isSignedIn && !fetchedOnceRef.current) {
      fetchedOnceRef.current = true;
      fetchCode();
    }
  }, [isLoaded, isSignedIn, fetchCode]);

  // Countdown timer
  useEffect(() => {
    if (secondsRemaining <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [secondsRemaining]);

  // Poll for code verification in Desktop app: auto-logout once claimed
  useEffect(() => {
    if (!code || !isSignedIn) return;

    let isMounted = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (!isMounted || isClaimedRef.current || isSigningOutRef.current) return;

      try {
        const status = await checkDesktopCodeStatus(code);
        if (!isMounted) return;

        if (status === "claimed") {
          isClaimedRef.current = true;
          isSigningOutRef.current = true;
          setIsClaimed(true);

          // Brief delay so user sees success confirmation, then sign out
          setTimeout(() => {
            performSignOut();
          }, 1200);
          return;
        }
      } catch (err) {
        console.warn("Desktop code status poll error:", err);
      }

      // Schedule next poll in 1.5s
      if (isMounted && !isClaimedRef.current && !isSigningOutRef.current) {
        pollTimer = setTimeout(poll, 1500);
      }
    };

    // Start polling loop
    pollTimer = setTimeout(poll, 1000);

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [code, isSignedIn, performSignOut]);

  // Auto-logout when code expires (2 minutes reached)
  useEffect(() => {
    if (
      secondsRemaining === 0 &&
      code &&
      isSignedIn &&
      !isClaimedRef.current &&
      !isSigningOutRef.current
    ) {
      isSigningOutRef.current = true;
      setIsSigningOut(true);

      const timer = setTimeout(() => {
        performSignOut();
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [secondsRemaining, code, isSignedIn, performSignOut]);

  const handleCopyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const formatCodeDisplay = (rawCode: string) => {
    if (rawCode.length !== 9) return rawCode;
    return `${rawCode.slice(0, 3)} - ${rawCode.slice(3, 6)} - ${rawCode.slice(6, 9)}`;
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (!isLoaded) {
    return (
      <AuthShell>
        <div className="flex items-center justify-center p-12 text-zinc-400 text-sm">
          Loading authentication...
        </div>
      </AuthShell>
    );
  }

  if (!isSignedIn) {
    return (
      <AuthShell wide>
        <div className="flex flex-col items-center gap-2 text-center pb-4">
          <h2 className="text-xl font-bold text-zinc-100">Sign in to connect SyncD Desktop</h2>
          <p className="text-xs text-zinc-400 max-w-sm">
            Sign in below to generate your secure linking code for the SyncD desktop application.
          </p>
        </div>
        <div className="syncd-clerk">
          <SignIn
            appearance={clerkAppearance}
            fallbackRedirectUrl="/desktop-auth"
            forceRedirectUrl="/desktop-auth"
            signUpUrl="/signup"
          />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="p-8 flex flex-col items-center text-center gap-6 max-w-md w-full mx-auto bg-zinc-950/80 border-zinc-800 backdrop-blur-xl">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xl font-bold">
          <svg
            className="w-7 h-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">
            Link SyncD Desktop
          </h2>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            Enter this 9-character code in your desktop app to complete verification and sign in.
          </p>
        </div>

        {isLoading ? (
          <div className="p-8 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-zinc-400">Generating secure linking code...</span>
          </div>
        ) : errorMessage ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex flex-col items-center gap-3 w-full">
            <p className="text-xs text-red-400 font-medium">{errorMessage}</p>
            {attemptsRemaining !== 0 && (
              <Button variant="primary" size="sm" onClick={fetchCode} className="text-xs">
                Try Again
              </Button>
            )}
          </div>
        ) : isClaimed ? (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center gap-3 text-center w-full animate-in fade-in">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <svg viewBox="0 0 52 52" className="w-14 h-14 overflow-visible drop-shadow-[0_0_14px_rgba(16,185,129,0.45)]">
                <circle
                  cx="26"
                  cy="26"
                  r="24"
                  fill="rgba(16, 185, 129, 0.15)"
                  stroke="#10b981"
                  strokeWidth="2.5"
                />
                <path
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 27 L23 35 L37 19"
                />
              </svg>
            </div>
            <h3 className="text-base font-bold text-zinc-100">SyncD Desktop Linked!</h3>
            <p className="text-xs text-zinc-400 max-w-xs">
              Code verified in SyncD Desktop. Signing out of this browser window for your security...
            </p>
          </div>
        ) : isSigningOut && secondsRemaining === 0 ? (
          <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col items-center gap-3 text-center w-full animate-in fade-in">
            <span className="text-xs font-semibold text-amber-400">Code Expired</span>
            <p className="text-xs text-zinc-400 max-w-xs">
              Your 2-minute linking window expired. Logging out of this browser window...
            </p>
          </div>
        ) : (
          code && (
            <div className="flex flex-col items-center gap-4 w-full">
              {/* Monospace Code Display */}
              <div
                onClick={handleCopyCode}
                className="group relative cursor-pointer px-6 py-4 rounded-2xl bg-zinc-900/90 border border-amber-500/30 hover:border-amber-500/60 transition-all flex flex-col items-center gap-1 shadow-lg shadow-black/40 w-full"
              >
                <span className="text-2xl sm:text-3xl font-mono font-bold tracking-wider text-amber-400 selection:bg-amber-500/30 whitespace-nowrap">
                  {formatCodeDisplay(code)}
                </span>
                <span className="text-[10px] text-zinc-500 group-hover:text-amber-400/80 transition-colors uppercase tracking-wider font-semibold">
                  {copied ? "✓ Copied to clipboard" : "Click to copy"}
                </span>
              </div>

              {/* Expiration Countdown Bar & Generation Attempts */}
              <div className="flex flex-col items-center gap-1.5 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    Valid for <strong className="text-zinc-200 font-mono">{formatTime(secondsRemaining)}</strong>
                  </span>
                </div>
                {attemptsRemaining !== null && (
                  <span className="text-[11px] font-mono text-zinc-500">
                    {attemptsRemaining > 0
                      ? `(${attemptsRemaining} refresh ${attemptsRemaining === 1 ? "attempt" : "attempts"} left)`
                      : "(Generation limit reached: 3 of 3 used)"}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={fetchCode}
                  disabled={isLoading || attemptsRemaining === 0}
                  className="text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {attemptsRemaining === 0 ? "No Retries Left" : "Refresh Code"}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCopyCode}
                  className="text-xs font-semibold"
                >
                  {copied ? "Copied!" : "Copy Code"}
                </Button>
              </div>
            </div>
          )
        )}

        <div className="border-t border-zinc-900 pt-4 w-full flex items-center justify-between text-[11px] text-zinc-500">
          <span>Signed in as @{user?.username || user?.firstName || "user"}</span>
          <span>SyncD Desktop v1.0</span>
        </div>
      </Card>
    </AuthShell>
  );
}
