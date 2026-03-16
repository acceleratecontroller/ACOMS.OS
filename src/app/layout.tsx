import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/shared/components/Sidebar";

export const metadata: Metadata = {
  title: "ACOMS.OS — Operations Platform",
  description: "Internal company operations platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
