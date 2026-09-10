import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./jobflow.css";

export const metadata: Metadata = {
  title: "NOSMO Work · Ask Nexus",
  description: "A worker-owned flow from Worker Card and private CVs to live job search, applications and connected work tools.",
  referrer: "no-referrer",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  other: {
    "codex-preview": "development",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
