/** Sites authenticates these headers; a Vercel caller can supply them directly. */
export function sitesIdentityAllowed(env = process.env) {
  return env.VERCEL !== "1" && !env.VERCEL_ENV;
}
