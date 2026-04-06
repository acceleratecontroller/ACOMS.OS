"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { staffNavigationItems } from "@/config/navigation";

export function StaffSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = staffNavigationItems.map((item) => {
    const isActive =
      item.href === "/staff"
        ? pathname === "/staff"
        : pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 px-3 py-2 rounded text-sm mb-1 transition-colors ${
          isActive
            ? "bg-blue-600 text-white"
            : "text-gray-300 hover:bg-gray-800 hover:text-white"
        }`}
      >
        <span className="w-6 h-6 flex items-center justify-center rounded bg-gray-700 text-xs font-bold">
          {item.icon}
        </span>
        {item.label}
      </Link>
    );
  });

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-gray-900 text-white flex items-center justify-between px-4 h-14">
        <div>
          <h1 className="text-lg font-bold leading-tight">ACOMS.OS</h1>
          <p className="text-[10px] text-gray-400 -mt-0.5">Staff Portal</p>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-10 h-10 flex items-center justify-center rounded hover:bg-gray-800 transition-colors"
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile slide-out nav */}
      <div
        className={`md:hidden fixed top-14 left-0 bottom-0 z-30 w-56 bg-gray-900 transform transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="p-2">{navLinks}</nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700 text-xs text-gray-500">
          Staff Portal
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-gray-900 text-white min-h-screen flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-lg font-bold">ACOMS.OS</h1>
          <p className="text-xs text-gray-400 mt-1">Staff Portal</p>
        </div>
        <nav className="flex-1 p-2">{navLinks}</nav>
        <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
          Staff Portal
        </div>
      </aside>
    </>
  );
}
