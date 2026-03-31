"use client";

export function LogoutButton() {
  return (
    <a
      href="/logout"
      className="shrink-0 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
    >
      Log out
    </a>
  );
}
