# NEXT — notes.junghanacs.com

Boot sector for the next session. Durable facts live in `AGENTS.md`, not here.

# NOW
- **Current**: JSON-LD identity slice **shipped & live** (Netlify deployed, agenda stamped, sitemap submitted, Google Rich Results ProfilePage valid, schema.org 0/0). Person.image, ProfilePage ImageObject, Authology identity description live. Follow-up: `Person.alternateName` expanded to `[GLG, GLGMAN, 힣, 힣맨, 정한]` (GPT review — Korean glyphs were missing).
- **Next**: external confirmation — run validator.schema.org and Google Rich Results Test on the live home + one note URL (manual, browser). Then start the AFTER SHIP follow-ups below.
- **Blocker**: none. Google KG/index lag is days–weeks; don't test LLM retrieval (Gemini) until Search Console confirms indexed.
- **Do not touch**: `content/*.md` (org export output); per-page `canonical` (see AGENTS.md URL invariants); identity `sameAs` beyond LinkedIn.

# AFTER SHIP — follow-ups (priority order)
1. **`refs[] → schema.org citation`** ← top AEO lever. Org-export side (`denote-export.sh`): emit `#+reference:` citekeys into frontmatter, structured (key/title/DOI/url, not bare strings). Then wire the receiver in `Head.tsx` BlogPosting. This is the real "footprints" signal for the 679 bib notes.
2. **`og:url` ↔ `ProfilePage.url` mismatch** — home `og:url` is `/index`, JSON-LD url is root. Cosmetic, pre-existing. Small post-ship patch.
3. **Path-based schema type mapping** (GPT review, garden-okf track) — replace blanket `BlogPosting` per folder: `notes/`→`Article`, `botlog/`→`TechArticle`, `meta/`→`DefinedTerm`, `bib/`·`journal/`→`CreativeWork`. Do via a `schemaTypeForSlug(slug)` helper in `Head.tsx`. 1st-impl `BlogPosting` is fine for now; this is the next-step refinement.
4. **A-2 `Blog` node** — `{@type:Blog, @id:#blog, isPartOf:#website}`, notes `isPartOf:#blog`. Scale signal. Do NOT enumerate ~2,200 notes via `hasPart`.
5. **BreadcrumbList JSON-LD** — slug is `section/YYYYMMDDTHHMMSS`, breadcrumb trivially derivable; helps sitelinks + LLM nav.

> Verified NOT a bug (GPT flagged, refuted 2026-06-23): build-time `fileData.slug` is **uppercase T**, so `isDenoteContent` regex matches and all 2,235 denote pages emit JSON-LD with correct uppercase `isBasedOn`. The lowercase `t` is Netlify serve-time URL canonicalization only — same HTML served at both cases. Don't "fix" the regex. (See AGENTS.md "Build & URL invariants".)

# PARKED
- `Plugin.CustomOgImages()` disabled (`quartz.config.ts`) — every page shares `/static/og-image.png`. Enable only if per-page social cards become worth the build cost.
- v5 migration — watch-and-prepare (see AGENTS.md).

# VERIFY (JSON-LD after any Head.tsx / export change)
```bash
npx quartz build
node -e 'const fs=require("fs");const ex=f=>fs.readFileSync(f,"utf8").match(/ld\+json">([\s\S]*?)<\/script>/)[1];console.log(JSON.stringify(JSON.parse(ex("public/index.html")),null,1))'
# expect: parse failures 0, Person.image consistent, ProfilePage ImageObject on home
```
