import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { sitesIdentityAllowed } from "../../sites-identity-policy.mjs";

function safeReturnPath(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    return url.origin === "https://app.local"
      ? `${url.pathname}${url.search}${url.hash}`
      : "/";
  } catch {
    return "/";
  }
}

export async function GET(request: Request) {
  const returnTo = safeReturnPath(new URL(request.url).searchParams.get("return_to"));
  if (sitesIdentityAllowed()) {
    const target = new URL("/signin-with-chatgpt", request.url);
    target.searchParams.set("return_to", returnTo);
    return NextResponse.redirect(target);
  }

  const { redirectToSignIn } = await auth();
  return redirectToSignIn({ returnBackUrl: new URL(returnTo, request.url) });
}
