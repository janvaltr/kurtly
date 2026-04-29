import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kurtly",
  description: "Badminton bez WhatsApp koordinace.",
};

import Navbar from "@/components/layout/Navbar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-body bg-bg text-text">
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
