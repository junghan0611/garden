import { FullSlug, getFullSlug, pathToRoot, simplifySlug } from "../../util/path"

function getRandomInt(max: number): number {
  return Math.floor(Math.random() * max)
}

async function navigateToRandomPage() {
  const fullSlug = getFullSlug(window)
  const currentSlug = simplifySlug(fullSlug)
  const data = await fetchData

  // Filter out pages with exclude tags
  const allPosts = Object.keys(data)
    .filter((slug) => {
      const fileData = data[slug]
      const hasExcludeTag = fileData.tags?.some(
        (tag: string) => tag.endsWith("exclude") || tag === "private",
      )
      return !hasExcludeTag
    })
    .map((slug) => simplifySlug(slug as FullSlug))

  // Get random slug (different from current)
  let newSlug = allPosts[getRandomInt(allPosts.length)]
  while (newSlug === currentSlug && allPosts.length > 1) {
    newSlug = allPosts[getRandomInt(allPosts.length)]
  }

  // Navigate
  const newPageUrl =
    newSlug === "" || newSlug === "/" ? pathToRoot(fullSlug) : `${pathToRoot(fullSlug)}/${newSlug}`

  window.location.href = newPageUrl
}

function scrollToTop(e: Event) {
  e.preventDefault()
  globalThis.scrollTo({ top: 0, left: 0, behavior: "smooth" })
}

function setupFooterButtons() {
  const scrollTopBtn = document.getElementById("scroll-to-top")
  const randomPageBtn = document.getElementById("random-page-button")

  scrollTopBtn?.removeEventListener("click", scrollToTop)
  scrollTopBtn?.addEventListener("click", scrollToTop)

  randomPageBtn?.removeEventListener("click", navigateToRandomPage)
  randomPageBtn?.addEventListener("click", navigateToRandomPage)
}

document.addEventListener("nav", setupFooterButtons)
