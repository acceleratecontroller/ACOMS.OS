"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Embeds an ACOMS.Controller page inside an iframe with token-based auth.
 * Handles token generation, auto-refresh, and loading states.
 *
 * @param path - Controller embed path, e.g. "/embed/tasks" or "/embed/dashboard"
 * @param className - Optional CSS class for the container div
 * @param minHeight - Optional minimum height for the iframe container
 */
export function ControllerEmbed({
  path,
  className = "",
  minHeight = "600px",
}: {
  path: string;
  className?: string;
  minHeight?: string;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const controllerUrl = process.env.NEXT_PUBLIC_ACOMS_CONTROLLER_URL || "";

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch("/api/embed-token");
      if (!res.ok) {
        setError("Failed to authenticate. Please refresh the page.");
        return;
      }
      const data = await res.json();
      setToken(data.token);
      setError(null);
      setLoading(false);

      // Auto-refresh token 1 minute before expiry (tokens last 5 min)
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(fetchToken, 4 * 60 * 1000);
    } catch {
      setError("Network error. Please check your connection.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToken();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [fetchToken]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-white border border-gray-200 rounded-lg ${className}`} style={{ minHeight }}>
        <div className="text-center">
          <p className="text-sm text-red-600 mb-2">{error}</p>
          <button
            onClick={() => { setLoading(true); setError(null); fetchToken(); }}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading || !token) {
    return (
      <div className={`flex items-center justify-center bg-white border border-gray-200 rounded-lg ${className}`} style={{ minHeight }}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Loading task manager...</span>
        </div>
      </div>
    );
  }

  const iframeSrc = `${controllerUrl}${path}?token=${encodeURIComponent(token)}`;

  return (
    <div className={className} style={{ minHeight, height: minHeight }}>
      <iframe
        src={iframeSrc}
        className="w-full h-full border-0"
        title="ACOMS Controller"
        allow="clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
