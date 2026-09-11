import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./jobflow.css";
import LocalPrivacyControl from "./local-privacy-control";

export const metadata: Metadata = {
  title: "NOSMO Work · Ask Nexus",
  description: "A worker-owned flow from Worker Card and private CVs to live job search, applications and connected work tools.",
  applicationName: "NOSMO Work",
  manifest: "/manifest.webmanifest",
  referrer: "no-referrer",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/pwa-icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NOSMO Work",
  },
  other: {
    "codex-preview": "development",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b1730",
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
        <LocalPrivacyControl />
      </body>
    </html>
  );
}
