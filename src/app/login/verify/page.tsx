"use client";

import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

export default function TwoFactorVerifyPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [useBackupCode]);

  // If not logged in or 2FA already verified, redirect
  useEffect(() => {
    if (session && !session.user.twoFactorEnabled) {
      router.push("/");
    }
    if (session && session.user.twoFactorVerified) {
      router.push("/");
    }
  }, [session, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/two-factor/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          isBackupCode: useBackupCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed.");
        setLoading(false);
        return;
      }

      // Update the session JWT to mark 2FA as verified
      await update();
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm bg-white rounded border p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">ACOMS.OS</h1>
        <p className="text-sm text-gray-500 mb-6">
          {useBackupCode
            ? "Enter one of your backup codes to continue."
            : "Enter the 6-digit code from your authenticator app."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="code"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {useBackupCode ? "Backup Code" : "Verification Code"}
            </label>
            <input
              ref={inputRef}
              id="code"
              name="code"
              type="text"
              inputMode={useBackupCode ? "text" : "numeric"}
              autoComplete="one-time-code"
              required
              maxLength={useBackupCode ? 9 : 6}
              placeholder={useBackupCode ? "XXXX-XXXX" : "000000"}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-center text-lg tracking-widest"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-gray-500 hover:underline"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={() => {
              setUseBackupCode(!useBackupCode);
              setCode("");
              setError("");
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            {useBackupCode
              ? "Use authenticator app instead"
              : "Use a backup code instead"}
          </button>
        </div>
      </div>
    </div>
  );
}
