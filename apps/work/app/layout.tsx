import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import "./jobflow.css";
import LocalPrivacyControl from "./local-privacy-control";
import { headers } from "next/headers";
import { sitesIdentityAllowed } from "./sites-identity-policy.mjs";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const useSitesIdentity = sitesIdentityAllowed();
  // Clerk's strict CSP uses a fresh nonce, so Vercel HTML renders per request.
  if (!useSitesIdentity) await headers();
  const content = (
    <>
      {children}
      <LocalPrivacyControl />
    </>
  );
  return (
    <html lang="en">
      <body className="antialiased">
        {useSitesIdentity ? (
          content
        ) : (
          <ClerkProvider dynamic appearance={{
            variables: { borderRadius: "4px" },
            elements: {
              cardBox: { backgroundColor: "var(--surface, #ffffff)" },
              card: { backgroundColor: "var(--surface, #ffffff)", color: "var(--ink, #182338)" },
              footer: { backgroundColor: "var(--surface-soft, #f3f5f7)" },
            },
          }}>
            {content}
          </ClerkProvider>
        )}
      </body>
    </html>
  );
}
