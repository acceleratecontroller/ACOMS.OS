import type { Metadata, Viewport } from "next";
import { SessionProvider } from "@/shared/components/SessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ACOMS.OS — Operations Platform",
  description: "Internal company operations platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased overflow-x-hidden">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
