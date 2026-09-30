// Asset-first Worker for the garden. Static assets are served without invoking this code
// (run_worker_first is unset); it only sees requests that match no asset.
// Job: 301 an old lowercase-t Denote URL to its uppercase canonical page when that page exists.
// Everything else goes back to the asset server untouched (404-page stays the 404).
// _headers does not apply to responses a Worker produces, so this sets the same values itself.
// Contract: docs/deploy-cloudflare.md

import { canonicalPath, finish } from "./garden-route.mjs"

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const target = request.method === "GET" || request.method === "HEAD" ? canonicalPath(url.pathname) : null
    if (target) {
      // Existence only: no query, no body, asked of the asset binding (never this Worker again).
      const probe = await env.ASSETS.fetch(new Request(new URL(target, url.origin), { method: "HEAD" }))
      if (probe.status === 200) {
        // Relative Location: the host is never taken from the request.
        return finish(new Response(null, { status: 301, headers: { Location: target + url.search } }), url, "lowercase-301")
      }
      if (probe.status !== 404) {
        return finish(new Response(`asset lookup failed: ${probe.status}\n`, { status: 502 }), url, "lookup-error")
      }
    }
    return finish(await env.ASSETS.fetch(request), url, "miss")
  },
}
