import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { ProcessedContent, QuartzPluginData, defaultProcessedContent } from "../vfile"
import { FullPageLayout } from "../../cfg"
import { FullSlug, getAllSegmentPrefixes, joinSegments, pathToRoot } from "../../util/path"
import { defaultListPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { CategoryContent } from "../../components"
import { write } from "./helpers"
import { i18n, TRANSLATIONS } from "../../i18n"
import { BuildCtx } from "../../util/ctx"
import { StaticResources } from "../../util/resources"

interface CategoryPageOptions extends FullPageLayout {
  sort?: (f1: QuartzPluginData, f2: QuartzPluginData) => number
}

function computeCategoryInfo(
  allFiles: QuartzPluginData[],
  content: ProcessedContent[],
  locale: keyof typeof TRANSLATIONS,
): [Set<string>, Record<string, ProcessedContent>] {
  const categories: Set<string> = new Set(
    allFiles.flatMap((data) => data.frontmatter?.categories ?? []).flatMap(getAllSegmentPrefixes),
  )

  // add base category
  categories.add("index")

  const categoryDescriptions: Record<string, ProcessedContent> = Object.fromEntries(
    [...categories].map((category) => {
      const title =
        category === "index"
          ? i18n(locale).pages.categoryContent.categoryIndex
          : `${i18n(locale).pages.categoryContent.category}: ${category}`
      return [
        category,
        defaultProcessedContent({
          slug: joinSegments("categories", category) as FullSlug,
          frontmatter: { title, categories: [] },
        }),
      ]
    }),
  )

  // Update with actual content if available
  for (const [tree, file] of content) {
    const slug = file.data.slug!
    if (slug.startsWith("categories/")) {
      const category = slug.slice("categories/".length)
      if (categories.has(category)) {
        categoryDescriptions[category] = [tree, file]
        if (file.data.frontmatter?.title === category) {
          file.data.frontmatter.title = `${i18n(locale).pages.categoryContent.category}: ${category}`
        }
      }
    }
  }

  return [categories, categoryDescriptions]
}

async function processCategoryPage(
  ctx: BuildCtx,
  category: string,
  categoryContent: ProcessedContent,
  allFiles: QuartzPluginData[],
  opts: FullPageLayout,
  resources: StaticResources,
) {
  const slug = joinSegments("categories", category) as FullSlug
  const [tree, file] = categoryContent
  const cfg = ctx.cfg.configuration
  const externalResources = pageResources(pathToRoot(slug), resources)
  const componentData: QuartzComponentProps = {
    ctx,
    fileData: file.data,
    externalResources,
    cfg,
    children: [],
    tree,
    allFiles,
  }

  const content = renderPage(cfg, slug, componentData, opts, externalResources)
  return write({
    ctx,
    content,
    slug: file.data.slug!,
    ext: ".html",
  })
}

export const CategoryPage: QuartzEmitterPlugin<Partial<CategoryPageOptions>> = (userOpts) => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultListPageLayout,
    pageBody: CategoryContent({ sort: userOpts?.sort }),
    ...userOpts,
  }

  const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "CategoryPage",
    getQuartzComponents() {
      return [
        Head,
        Header,
        Body,
        ...header,
        ...beforeBody,
        pageBody,
        ...afterBody,
        ...left,
        ...right,
        Footer,
      ]
    },
    async *emit(ctx, content, resources) {
      const allFiles = content.map((c) => c[1].data)
      const cfg = ctx.cfg.configuration
      const [categories, categoryDescriptions] = computeCategoryInfo(allFiles, content, cfg.locale)

      for (const category of categories) {
        yield processCategoryPage(ctx, category, categoryDescriptions[category], allFiles, opts, resources)
      }
    },
    async *partialEmit(ctx, content, resources, changeEvents) {
      const allFiles = content.map((c) => c[1].data)
      const cfg = ctx.cfg.configuration

      // Find all categories that need to be updated based on changed files
      const affectedCategories: Set<string> = new Set()
      for (const changeEvent of changeEvents) {
        if (!changeEvent.file) continue
        const slug = changeEvent.file.data.slug!

        // If it's a category page itself that changed
        if (slug.startsWith("categories/")) {
          const category = slug.slice("categories/".length)
          affectedCategories.add(category)
        }

        // If a file with categories changed, we need to update those category pages
        const fileCategories = changeEvent.file.data.frontmatter?.categories ?? []
        fileCategories.flatMap(getAllSegmentPrefixes).forEach((category) => affectedCategories.add(category))

        // Always update the index category page if any file changes
        affectedCategories.add("index")
      }

      // If there are affected categories, rebuild their pages
      if (affectedCategories.size > 0) {
        // We still need to compute all categories because category pages show all categories
        const [_categories, categoryDescriptions] = computeCategoryInfo(allFiles, content, cfg.locale)

        for (const category of affectedCategories) {
          if (categoryDescriptions[category]) {
            yield processCategoryPage(ctx, category, categoryDescriptions[category], allFiles, opts, resources)
          }
        }
      }
    },
  }
}
