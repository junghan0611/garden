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
      "@junghan0611": "https://github.com/junghan0611/",
      Threads: "https://www.threads.com/@junghanacs",
      Bluesky: "https://bsky.app/profile/junghanacs.bsky.social",
      Mastodon: "https://fosstodon.org/@junghanacs",
      RSS: "https://notes.junghanacs.com/index.xml",
      Source: "https://github.com/junghanacs/notes.junghanacs.com",
      Homepage: "https://www.junghanacs.com",
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
    Component.DesktopOnly(
      Component.Graph({
        localGraph: {
          depth: 2,
          showTags: false,
          focusOnHover: true,
        },
        globalGraph: {
          showTags: false,
          depth: 0, // disabled — 2000+ nodes too heavy for client
        },
      }),
    ),

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
