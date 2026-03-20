"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

export default function SetupTwoFactorPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [step, setStep] = useState<"idle" | "scanning" | "backup-codes">("idle");
  const [qrCode, setQrCode] = useState("");
  const [manualEntry, setManualEntry] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupCodesCopied, setBackupCodesCopied] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setupStarted = useRef(false);

  // If not logged in, redirect to login
  // If already has 2FA enabled, redirect to home
  // If admin@acoms.local, redirect to home (exempt)
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      // Only redirect if 2FA was already enabled BEFORE this setup flow started
      // (don't redirect while showing backup codes after just enabling it)
      if (session?.user?.twoFactorEnabled && step !== "backup-codes") {
        router.push("/");
        return;
      }
      if (session?.user?.email === "admin@acoms.local") {
        router.push("/");
        return;
      }
      // User needs to set up 2FA — start the setup (ref prevents double-fire in strict mode)
      if (!setupStarted.current) {
        setupStarted.current = true;
        startSetup();
      }
    }
  }, [status, session, router]);

  async function startSetup() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/two-factor/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start setup.");
        setLoading(false);
        return;
      }
      setQrCode(data.qrCode);
      setManualEntry(data.manualEntry);
      setStep("scanning");
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/two-factor/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: confirmCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed. Please try again.");
        setLoading(false);
        return;
      }
      setBackupCodes(data.backupCodes);
      setStep("backup-codes");
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setBackupCodesCopied(true);
    setTimeout(() => setBackupCodesCopied(false), 2000);
  }

  function downloadBackupCodes() {
    const content = `ACOMS.OS — Backup Recovery Codes\nGenerated: ${new Date().toISOString()}\n\nKeep these codes safe. Each code can only be used once.\n\n${backupCodes.join("\n")}\n`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "acoms-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDone() {
    window.location.href = "/";
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="w-full max-w-md bg-white rounded border p-6 text-center">
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md bg-white rounded border p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">ACOMS.OS</h1>
        <p className="text-sm text-gray-500 mb-1">Two-Factor Authentication Setup</p>
        <p className="text-xs text-amber-600 font-medium mb-6">
          Two-factor authentication is required for all accounts. Please complete the setup to continue.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading state while fetching QR code */}
        {step === "idle" && !error && (
          <p className="text-sm text-gray-500 text-center py-4">Setting up two-factor authentication...</p>
        )}

        {/* Error with retry */}
        {step === "idle" && error && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setupStarted.current = false; startSetup(); }}
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Retrying..." : "Try Again"}
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}

        {/* Step 1: QR Code */}
        {step === "scanning" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Scan this QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, Authy, or 1Password).
            </p>
            {qrCode && (
              <div className="flex justify-center">
                <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
              </div>
            )}
            <details className="text-sm">
              <summary className="text-blue-600 cursor-pointer hover:underline">
                Can&apos;t scan? Enter code manually
              </summary>
              <div className="mt-2 p-3 bg-gray-50 border rounded">
                <p className="text-xs text-gray-500 mb-1">Manual entry key:</p>
                <code className="text-sm font-mono select-all break-all">{manualEntry}</code>
              </div>
            </details>

            <form onSubmit={handleConfirm} className="space-y-3">
              <div>
                <label htmlFor="confirm-code" className="block text-sm font-medium text-gray-700 mb-1">
                  Enter the 6-digit code from your app to confirm
                </label>
                <input
                  id="confirm-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading || confirmCode.length !== 6}
                className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Verifying..." : "Confirm & Enable"}
              </button>
            </form>

            <div className="pt-2 border-t">
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-sm text-gray-500 hover:underline"
              >
                Sign out
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Backup Codes */}
        {step === "backup-codes" && backupCodes.length > 0 && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <p className="text-sm font-medium text-yellow-800 mb-2">
                Save these backup codes now. You won&apos;t be able to see them again.
              </p>
              <p className="text-xs text-yellow-700">
                Each code can only be used once. Store them somewhere safe.
              </p>
            </div>
            <div className="bg-gray-50 border rounded p-4 font-mono text-sm grid grid-cols-2 gap-2">
              {backupCodes.map((code, i) => (
                <div key={i} className="text-gray-800">{code}</div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyBackupCodes}
                className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                {backupCodesCopied ? "Copied!" : "Copy codes"}
              </button>
              <button
                type="button"
                onClick={downloadBackupCodes}
                className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Download as file
              </button>
              <button
                type="button"
                onClick={handleDone}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors ml-auto"
              >
                Continue to ACOMS.OS
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
