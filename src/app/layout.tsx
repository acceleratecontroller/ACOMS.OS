import type { Metadata } from "next";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}
