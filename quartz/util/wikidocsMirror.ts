import mirrorSnapshot from "../data/wikidocs-mirror.json"

const denoteId = /^\d{8}T\d{6}$/
const byDenoteId = (mirrorSnapshot.byDenoteId ?? {}) as Record<string, string>
const byGardenSlug = (mirrorSnapshot.byGardenSlug ?? {}) as Record<string, string>

export function wikidocsMirrorUrl(slug?: string): string | undefined {
  if (!slug) return undefined
  const id = slug.split("/").pop()
  // Unpublished Denote pages must not fall through to the folder chapter URL.
  if (id && denoteId.test(id)) return byDenoteId[id]
  const normalized = slug.replace(/\/index$/, "")
  return byGardenSlug[normalized] ?? byGardenSlug[slug]
}

export const wikidocsMirrorBookUrl = mirrorSnapshot._meta.bookUrl
