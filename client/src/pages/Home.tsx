import { useUser, UserButton } from "@clerk/react";

export function Home() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded || !isSignedIn || !user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <p className="text-zinc-400">Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="bg-zinc-950/50 border border-white/10 rounded-2xl p-8 backdrop-blur-xl text-center">
        <h1 className="mb-2 text-2xl font-bold text-white">
          Welcome, {user.username ?? user.fullName ?? "there"}
        </h1>
        <p className="text-zinc-400 mb-4">You're signed in.</p>
        <div className="bg-zinc-900 rounded-xl p-4 text-left text-sm mb-6">
          <p className="text-zinc-500">Clerk User ID:</p>
          <p className="text-zinc-200 font-mono break-all">{user.id}</p>
        </div>
        <div className="flex justify-center">
          <UserButton />
        </div>
      </div>
    </div>
  );
}