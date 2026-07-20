# WikiDocs mirror contract

This document is the technical contract between
[`junghan0611/garden`](https://github.com/junghan0611/garden) and
[`junghan0611/garden2wikidocs`](https://github.com/junghan0611/garden2wikidocs).
The public rationale and project timeline live in Denote note
`20260220T201100` (`§garden2wikidocs — 원본 가든을 건드리지 않는 위키독스 미러`).

## Center

> The garden is the canonical, latest, and authored source.
> WikiDocs is a Korean-language discovery and reading mirror.
> `garden2wikidocs` is the translation harness between them.

WikiDocs may appear before the garden in Korean search results. That is an intended
property of the discovery surface, not a transfer of authorship or source authority.
Readers arriving there must have an exact route back to the garden, where backlinks,
tags, history, comments, source links, and the latest revision live.

## Field ownership

| Field | Authority |
|---|---|
| Body, title, description, section | garden Markdown exported from Org |
| Denote ID, source URL | garden |
| `date`, `lastmod` | garden frontmatter |
| WikiDocs `page_id`, mirror URL | `garden2wikidocs/mapping.json` |
| Mirror synchronization status | `garden2wikidocs` / WikiDocs |
| Canonical-versus-mirror policy | this garden |

The Denote ID is the join key. Source metadata copied into `mapping.json` remains a
cache of garden facts; it does not become their authority.

## Data flow

```text
Org → exported garden Markdown → independent garden deploy
                              ↓ read-only
                    garden2wikidocs build
                              ↓
                 WikiDocs page_id recovery
                              ↓
            garden2wikidocs/mapping.json
                              ↓ explicit owner-run import
           garden/quartz/data/wikidocs-mirror.json
                              ↓
                   (retained as data only —
              the garden emits no per-note link)
```

The garden's Netlify build never reads a sibling checkout and never fetches a remote
mapping over the network. `scripts/sync-wikidocs-map.mjs` is an explicit import gate:
it validates the mirror ledger and commits only the minimal Denote-ID-to-URL snapshot
needed by Quartz.

`garden2wikidocs` must not write into the garden repository. It updates its own ledger
and reports that a new stable `page_id` is ready; the garden owner decides when to
import the new snapshot.

## Publication ordering

1. Export and deploy the garden independently.
2. Let `garden2wikidocs` read the public garden files and update the WikiDocs mirror.
3. Recover new WikiDocs `page_id` values and audit the mirror.
4. Explicitly import the refreshed mapping snapshot into the garden.
5. Deploy the garden. The garden emits nothing per-note about the mirror; step 4 only
   keeps the ledger current for future use.

A new garden note may temporarily have no WikiDocs mapping. That is normal and must
not fail a garden build. A mirror outage or delayed `page_id` recovery must never block
the canonical publication path.

## Garden output

**The garden emits nothing per-note about the mirror.** No visible `WikiDocs mirror`
link in content metadata, no `sameAs` in the page's CreativeWork JSON-LD.

Both surfaces shipped in `f7688814` (2026-07-18) and were removed on 2026-07-20, for two
independent reasons:

1. **`sameAs` became factually wrong.** WikiDocs is moving to a curated minimal edition —
   a few hundred selected notes, not a page-for-page rendering of the garden. `sameAs`
   asserts that two URLs denote the *same entity*; a selected subset published under a
   different editorial shape does not qualify.
2. **The snapshot has no liveness guarantee.** `wikidocs-mirror.json` is a frozen import
   and no build step verifies that a mapped page still resolves. WikiDocs applies
   server-side caps without notice — `garden2wikidocs@6bfbadf` hit a 1000-node TOC
   truncation on a 2,243-node book — so a stale snapshot degrades into thousands of dead
   outbound links that the garden cannot detect.

`scripts/validate-jsonld.mjs` asserts the absence of both surfaces. Restoring either one
fails the validator by design. Before reinstating per-note links, the curated set must be
stable *and* something must check remote liveness.

The surviving link direction is mirror → garden: each WikiDocs page carries a provenance
block pointing at its exact original (see below).

The garden's existing uppercase-`T` URL behavior deliberately has no per-page
`<link rel="canonical">`. This mirror integration does not change that invariant.

## Mirror output

Each generated WikiDocs page must contain a separate `원본·최신본` provenance block.
It is system metadata, not part of the author's `이 노트에 대하여` abstract.

- If an abstract exists: abstract → provenance block → body.
- If no abstract exists: provenance block → body.
- The block links to the exact garden URL and identifies the garden as original/latest.
- It directs readers to the garden for backlinks, tags, history, comments, and updates.
- Creation and modification dates come only from garden frontmatter.
- Journal title dates and recent-first ordering use `source_date` (the week/date represented by the journal).
- Meta, bibliography, notes, and botlog title dates and recent-first ordering use `source_lastmod`,
  falling back to `source_date` only when `lastmod` is absent.
- Mirror build, Git commit, file mtime, and sync time must never masquerade as either source date.
- WikiDocs may force its sidebar into ascending title order. Preserve stable titles and `page_id` values;
  provide an explicit recent-first chapter index rather than renumbering every page to fight the sidebar.
- Mirror sync time belongs at book level, not repeated as a content date on every page.

## Validation contract

### Garden

At the import gate (`scripts/sync-wikidocs-map.mjs`):

- Denote IDs and WikiDocs URLs are well formed.
- Every imported WikiDocs page ID and URL is unique.
- Every snapshot entry points to an existing garden Denote page.

At build validation (`scripts/validate-jsonld.mjs`):

- No content node carries `sameAs`.
- No built page links out to `wikidocs.net`.
- An unmapped new garden page remains valid and deployable.
- Netlify requires no sibling repository or network mapping fetch.

### garden2wikidocs

- Every mirror page has exactly one exact source URL.
- `gid`, source URL Denote ID, and mapping entry agree.
- Journal title dates equal garden `date`; all other title dates equal garden `lastmod` with `date` fallback.
- The provenance block is separate from the author's abstract.
- An existing WikiDocs `page_id` remains stable across rebuilds.
- Mirror-internal links use recovered WikiDocs URLs where available and retain the
  garden URL as fallback.

## Change protocol

This file is the cross-repository policy SSOT. A change to source authority, field
ownership, publication ordering, or the provenance contract is agreed here first.
The `garden2wikidocs` skill references this contract and owns implementation details of
the mirror pipeline; the garden owns its importer, local snapshot, structured data, and
public canonical policy.
