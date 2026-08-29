interface AuthErrorScreenProps {
  message: string;
  onRetry: () => void;
}

export function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <p className="text-zinc-400">Checking authentication...</p>
    </div>
  );
}

export function AuthErrorScreen({ message, onRetry }: AuthErrorScreenProps) {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold text-white">
          Could not load your profile
        </h1>
        <p className="text-sm text-red-400">{message}</p>
        <p className="text-sm text-zinc-500">
          You are still signed in. This is a connection problem, not a missing
          account.
        </p>
        <button
          onClick={onRetry}
          className="rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
