import type { Metadata, Viewport } from "next";
import { Providers } from "@/shared/components/Providers";
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
