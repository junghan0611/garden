// Pure pieces of the garden Worker, kept out of worker.mjs: workerd treats every named export of the
// main module as an entrypoint and refuses non-handlers (measured 2026-09-30, wrangler dev 4.143.0).
// Contract: docs/deploy-cloudflare.md

export const CANONICAL_HOST = "notes.junghanacs.com"
export const PREVIEW_HOST_SUFFIX = ".junghanacs.workers.dev"
// Must equal the "/*" rule and the canonical-host rule in cloudflare/_headers (tested).
export const COMMON_HEADERS = {
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  Link: '</llms.txt>; rel="service-doc"; type="text/plain", </sitemap.xml>; rel="sitemap"; type="application/xml"',
}
export const HSTS = "max-age=31536000; includeSubDomains; preload"

// Only the Denote id's t changes case; section names and everything else stay as they are.
const LOWERCASE_DENOTE = /^\/(notes|meta|bib|botlog|journal)\/(\d{8})t(\d{6})\/?$/

/** Uppercase canonical path for an old lowercase Denote path, or null. */
export function canonicalPath(pathname) {
  const m = LOWERCASE_DENOTE.exec(pathname)
  return m ? `/${m[1]}/${m[2]}T${m[3]}` : null
}

export function finish(response, url, route) {
  const out = new Response(response.body, response)
  for (const [name, value] of Object.entries(COMMON_HEADERS)) out.headers.set(name, value)
  if (url.hostname.endsWith(PREVIEW_HOST_SUFFIX)) out.headers.set("X-Robots-Tag", "noindex")
  if (url.hostname === CANONICAL_HOST) out.headers.set("Strict-Transport-Security", HSTS)
  out.headers.set("x-garden-route", route)
  return out
}
