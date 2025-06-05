import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [
     Component.Comments({ provider: 'giscus',
       options: {
         // from data-repo
         repo: 'junghanacs/notes.junghanacs.com',
         // from data-repo-id
         repoId: 'R_kgDONUSf5Q',
         // from data-category
         category: 'Announcements',
         // from data-category-id
         categoryId: 'DIC_kwDONUSf5c4Ckkzb',
         reactionsEnabled: true,
         inputPosition: "top",
         themeUrl: "https://notes.junghanacs.com/static/giscus", // corresponds to quartz/static/giscus/
         lightTheme: "light", // corresponds to light-theme.css in quartz/static/giscus/
         darkTheme: "dark", // corresponds to dark-theme.css quartz/static/giscus/
       }
    }),
  ],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/junghanacs/notes.junghanacs.com",
      "Homepage": "https://www.junghanacs.com",
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
    Component.ContentMeta(),
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
        { Component: Component.ReaderMode() },
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
    Component.Explorer(),
  ],
  right: [
    Component.DesktopOnly(
      Component.Graph(),
      Component.Graph({
        localGraph: {
          showTags: false,
          // drag: false,
          // zoom: false,
        },
        globalGraph: {
          showTags: false,
          // drag: false,
          // zoom: false,
        },
      }),
    ),

    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
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
    Component.DesktopOnly(Component.Explorer(),),
  ],
  right: [],
}
