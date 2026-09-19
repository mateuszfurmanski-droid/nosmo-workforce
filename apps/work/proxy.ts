import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { sitesIdentityAllowed } from "./app/sites-identity-policy.mjs";

const clerkProxy = clerkMiddleware(
  (_auth, request) => {
    const requestHeaders = new Headers(request.headers);
    for (const key of [...requestHeaders.keys()]) {
      if (key.startsWith("oai-authenticated-")) requestHeaders.delete(key);
    }
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Cache-Control", "no-store");
    return response;
  },
  {
    contentSecurityPolicy: {
      strict: true,
      directives: {
        "base-uri": ["'none'"],
        "font-src": ["'self'", "data:"],
        "frame-ancestors": ["'none'"],
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "object-src": ["'none'"],
      },
    },
  },
);

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (sitesIdentityAllowed()) return NextResponse.next();
  return clerkProxy(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
