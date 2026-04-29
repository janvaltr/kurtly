import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kurtly",
  description: "Badminton bez WhatsApp koordinace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col font-body bg-bg text-text">
        {children}
      </body>
    </html>
  );
}
