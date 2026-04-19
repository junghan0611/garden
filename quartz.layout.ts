import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [
    Component.Webmentions(),
    Component.Remark42Comments(),
  ],
  footer: Component.Footer({
    links: {
      // Social / identity
      "@junghan0611": "https://github.com/junghan0611/",
      Threads: "https://www.threads.com/@junghanacs",
      Bluesky: "https://bsky.app/profile/junghanacs.bsky.social",
      Mastodon: "https://fosstodon.org/@junghanacs",
      Homepage: "https://www.junghanacs.com",
      Source: "https://github.com/junghanacs/notes.junghanacs.com",
      // Machine-readable entry points
      // (네트워크 제약 LLM이 홈 fetch 한 번으로 전부 provenance 승인받도록
      //  본문 링크로 노출. robots.txt 주석에도 llms.txt 경로 명시됨.)
      RSS: "https://notes.junghanacs.com/index.xml",
      "robots.txt": "https://notes.junghanacs.com/robots.txt",
      "sitemap.xml": "https://notes.junghanacs.com/sitemap.xml",
      "llms.txt": "https://notes.junghanacs.com/llms.txt",
      // Bibliography raw data — zotero-config (파사드가 아닌 누적 기록)
      "Book.bib": "https://github.com/junghan0611/zotero-config/blob/main/output/Book.bib",
      "github-starred.bib": "https://github.com/junghan0611/zotero-config/blob/main/output/github-starred.bib",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta({
      showReadingTime: true,
      repoLink: "https://github.com/junghanacs/notes.junghanacs.com",
      branch: "v4",
    }),
    Component.TagList(),
    // Component.CategoryList(), // bug in explorer
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        // { Component: Component.ReaderMode() },
      ],
    }),

    // Component.DesktopOnly(Component.RecentNotes({ limit: 5, showTags: false})),
    // Component.DesktopOnly(
    //   Component.RecentNotes({
    //     title: "Recent Update",
    //     limit: 4,
    //     showTags: false,
    //     filter: (f) =>
    //       f.slug!.startsWith("notes/") && f.slug! !== "notes/index" && !f.frontmatter?.noindex,
    //     linkToMore: "notes/" as SimpleSlug,
    //   }),
    // ),

    Component.DesktopOnly(Component.TableOfContents()),
    Component.DesktopOnly(Component.Backlinks()),
  ],
  right: [
    Component.DesktopOnly(Component.Explorer()),
    Component.MobileOnly(Component.Backlinks()),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.DesktopOnly(Component.Explorer()),
  ],
  right: [],
}
