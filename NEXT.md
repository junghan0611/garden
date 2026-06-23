# NEXT — notes.junghanacs.com

Boot sector for the next session. Durable facts live in `AGENTS.md`, not here.

# NOW
- **Current**: JSON-LD identity slice committed to `v4` (`f4d26d06`), **not pushed**. Push = Netlify deploy = publish.
- **Next**: (1) GLG `git push origin v4` → (2) agenda stamp the pushed commit → (3) `gog sc sitemap submit` → (4) confirm on validator.schema.org / Google Rich Results Test with a real URL.
- **Blocker**: push is GLG's (deploy trigger). Agent stops before push.
- **Do not touch**: `content/*.md` (org export output); per-page `canonical` (see AGENTS.md URL invariants); identity `sameAs` beyond LinkedIn.

# AFTER SHIP — follow-ups (priority order)
1. **`refs[] → schema.org citation`** ← top AEO lever. Org-export side (`denote-export.sh`): emit `#+reference:` citekeys into frontmatter, structured (key/title/DOI/url, not bare strings). Then wire the receiver in `Head.tsx` BlogPosting. This is the real "footprints" signal for the 679 bib notes.
2. **`og:url` ↔ `ProfilePage.url` mismatch** — home `og:url` is `/index`, JSON-LD url is root. Cosmetic, pre-existing. Small post-ship patch.
3. **A-2 `Blog` node** — `{@type:Blog, @id:#blog, isPartOf:#website}`, notes `isPartOf:#blog`. Scale signal. Do NOT enumerate ~2,200 notes via `hasPart`.
4. **BreadcrumbList JSON-LD** — slug is `section/YYYYMMDDTHHMMSS`, breadcrumb trivially derivable; helps sitelinks + LLM nav.

# PARKED
- `Plugin.CustomOgImages()` disabled (`quartz.config.ts`) — every page shares `/static/og-image.png`. Enable only if per-page social cards become worth the build cost.
- v5 migration — watch-and-prepare (see AGENTS.md).

# VERIFY (JSON-LD after any Head.tsx / export change)
```bash
npx quartz build
node -e 'const fs=require("fs");const ex=f=>fs.readFileSync(f,"utf8").match(/ld\+json">([\s\S]*?)<\/script>/)[1];console.log(JSON.stringify(JSON.parse(ex("public/index.html")),null,1))'
# expect: parse failures 0, Person.image consistent, ProfilePage ImageObject on home
```
