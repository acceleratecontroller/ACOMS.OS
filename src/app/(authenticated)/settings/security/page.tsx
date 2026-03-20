"use client";

import { useSession } from "next-auth/react";
import { useState, useCallback } from "react";

type SetupStep = "idle" | "scanning" | "confirming" | "backup-codes";
type DisableStep = "idle" | "confirming";

export default function SecuritySettingsPage() {
  const { data: session, update } = useSession();

  // Setup flow state
  const [setupStep, setSetupStep] = useState<SetupStep>("idle");
  const [qrCode, setQrCode] = useState("");
  const [manualEntry, setManualEntry] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupCodesCopied, setBackupCodesCopied] = useState(false);

  // Disable flow state
  const [disableStep, setDisableStep] = useState<DisableStep>("idle");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  // Regenerate backup codes state
  const [regenCode, setRegenCode] = useState("");
  const [showRegen, setShowRegen] = useState(false);
  const [regenBackupCodes, setRegenBackupCodes] = useState<string[]>([]);

  // Shared state
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const is2FAEnabled = session?.user?.twoFactorEnabled ?? false;

  const clearMessages = useCallback(() => {
    setError("");
    setSuccessMessage("");
  }, []);

  // ── Enable 2FA: Step 1 — Start setup ──
  async function handleStartSetup() {
    clearMessages();
    setLoading(true);
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
      setSetupStep("scanning");
    } catch {
      setError("Something went wrong.");
    }
    setLoading(false);
  }

  // ── Enable 2FA: Step 2 — Confirm with code ──
  async function handleConfirmSetup(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/two-factor/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: confirmCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed.");
        setLoading(false);
        return;
      }
      setBackupCodes(data.backupCodes);
      setSetupStep("backup-codes");
      await update(); // Refresh session to reflect 2FA enabled
    } catch {
      setError("Something went wrong.");
    }
    setLoading(false);
  }

  // ── Disable 2FA ──
  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/two-factor/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to disable 2FA.");
        setLoading(false);
        return;
      }
      setSuccessMessage("Two-factor authentication has been disabled.");
      setDisableStep("idle");
      setDisablePassword("");
      setDisableCode("");
      await update();
    } catch {
      setError("Something went wrong.");
    }
    setLoading(false);
  }

  // ── Regenerate backup codes ──
  async function handleRegenerate(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/two-factor/backup-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: regenCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to regenerate codes.");
        setLoading(false);
        return;
      }
      setRegenBackupCodes(data.backupCodes);
      setRegenCode("");
    } catch {
      setError("Something went wrong.");
    }
    setLoading(false);
  }

  function copyBackupCodes(codes: string[]) {
    navigator.clipboard.writeText(codes.join("\n"));
    setBackupCodesCopied(true);
    setTimeout(() => setBackupCodesCopied(false), 2000);
  }

  function downloadBackupCodes(codes: string[]) {
    const content = `ACOMS.OS — Backup Recovery Codes\nGenerated: ${new Date().toISOString()}\n\nKeep these codes safe. Each code can only be used once.\n\n${codes.join("\n")}\n`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "acoms-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Backup codes display component ──
  function BackupCodesDisplay({ codes, onDone }: { codes: string[]; onDone?: () => void }) {
    return (
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
          {codes.map((code, i) => (
            <div key={i} className="text-gray-800">{code}</div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => copyBackupCodes(codes)}
            className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            {backupCodesCopied ? "Copied!" : "Copy codes"}
          </button>
          <button
            type="button"
            onClick={() => downloadBackupCodes(codes)}
            className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Download as file
          </button>
          {onDone && (
            <button
              type="button"
              onClick={onDone}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors ml-auto"
            >
              Done
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Security Settings</h1>
      <p className="text-sm text-gray-500 mb-6">Manage two-factor authentication for your account.</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          {successMessage}
        </div>
      )}

      {/* ── Status Card ── */}
      <div className="bg-white border rounded p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h2>
            <p className="text-sm text-gray-500 mt-1">
              Add an extra layer of security using an authenticator app.
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              is2FAEnabled
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {is2FAEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        {/* ── Not enabled: show enable button or setup flow ── */}
        {!is2FAEnabled && setupStep === "idle" && (
          <button
            type="button"
            onClick={handleStartSetup}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Starting..." : "Enable Two-Factor Authentication"}
          </button>
        )}

        {/* ── Setup Step 1: QR Code ── */}
        {!is2FAEnabled && setupStep === "scanning" && (
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

            <form onSubmit={handleConfirmSetup} className="space-y-3">
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
                  className="w-full max-w-xs border border-gray-300 rounded px-3 py-2 text-sm font-mono text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading || confirmCode.length !== 6}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Verifying..." : "Confirm & Enable"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSetupStep("idle");
                    setConfirmCode("");
                    clearMessages();
                  }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Setup Step 2: Backup Codes ── */}
        {setupStep === "backup-codes" && backupCodes.length > 0 && (
          <BackupCodesDisplay
            codes={backupCodes}
            onDone={() => {
              setSetupStep("idle");
              setBackupCodes([]);
              setConfirmCode("");
              setSuccessMessage("Two-factor authentication is now enabled.");
            }}
          />
        )}

        {/* ── Enabled: show disable and regenerate options ── */}
        {is2FAEnabled && setupStep === "idle" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Your account is protected with two-factor authentication.
            </p>

            {/* Disable 2FA */}
            {disableStep === "idle" ? (
              <button
                type="button"
                onClick={() => { setDisableStep("confirming"); clearMessages(); }}
                className="text-sm text-red-600 hover:underline"
              >
                Disable two-factor authentication
              </button>
            ) : (
              <form onSubmit={handleDisable} className="space-y-3 border-t pt-4">
                <p className="text-sm font-medium text-gray-700">
                  Confirm by entering your password and a current authenticator code.
                </p>
                <div>
                  <label htmlFor="disable-password" className="block text-sm text-gray-600 mb-1">Password</label>
                  <input
                    id="disable-password"
                    type="password"
                    required
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    className="w-full max-w-xs border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="disable-code" className="block text-sm text-gray-600 mb-1">Authenticator code</label>
                  <input
                    id="disable-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    placeholder="000000"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full max-w-xs border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? "Disabling..." : "Disable 2FA"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDisableStep("idle"); setDisablePassword(""); setDisableCode(""); clearMessages(); }}
                    className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Regenerate backup codes */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Backup Codes</h3>
              {regenBackupCodes.length > 0 ? (
                <BackupCodesDisplay
                  codes={regenBackupCodes}
                  onDone={() => {
                    setRegenBackupCodes([]);
                    setShowRegen(false);
                    setSuccessMessage("New backup codes saved.");
                  }}
                />
              ) : showRegen ? (
                <form onSubmit={handleRegenerate} className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Enter a current authenticator code to generate new backup codes. This will invalidate all existing codes.
                  </p>
                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      placeholder="000000"
                      value={regenCode}
                      onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, ""))}
                      className="w-full max-w-xs border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading || regenCode.length !== 6}
                      className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? "Generating..." : "Generate New Codes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowRegen(false); setRegenCode(""); clearMessages(); }}
                      className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => { setShowRegen(true); clearMessages(); }}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Regenerate backup codes
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
