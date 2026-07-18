import mirrorSnapshot from "../data/wikidocs-mirror.json"

const denoteId = /^\d{8}T\d{6}$/
const byDenoteId = mirrorSnapshot.byDenoteId as Record<string, string>

export function wikidocsMirrorUrl(slug?: string): string | undefined {
  const id = slug?.split("/").pop()
  if (!id || !denoteId.test(id)) return undefined
  return byDenoteId[id]
}

export const wikidocsMirrorBookUrl = mirrorSnapshot._meta.bookUrl
