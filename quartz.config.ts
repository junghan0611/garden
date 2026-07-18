import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "junghanacs🧠",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: false,
    analytics: {
      provider: "umami",
      host: "https://analytics.junghanacs.com",
      websiteId: "9ff8435f-c63e-4d20-82b4-1e76654ef202"
    },
    // locale: "en-US",
    locale: "ko-KR",
    baseUrl: "notes.junghanacs.com",
    ignorePatterns: ["test", "private", "tmp", "templates", ".obsidian"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "local",
      cdnCaching: true,
      typography: {
        // header: { name: "IBM Plex Sans KR",
        //           weights: [400, 700],
        //           includeItalic: false,},
        // header: "Hahmlet",
        // title: "42dot Sans",
        header:  "GLG Mono",
        title:  "GLG Mono",
        body:  "GLG Mono",
        code: "GLG Mono",
      },
      colors: {
        lightMode: {
          light: "#faf8f8",
          lightgray: "#e5e5e5",
          gray: "#b8b8b8",
          darkgray: "#4e4e4e",
          dark: "#2b2b2b",
          secondary: "#284b63",
          tertiary: "#84a59d",
          highlight: "rgba(143, 159, 169, 0.15)",
          textHighlight: "#fff23688",
        },
        darkMode: {
          light: "#161618",
          lightgray: "#393639",
          gray: "#646464",
          darkgray: "#d4d4d4",
          dark: "#ebebec",
          secondary: "#7b97aa",
          tertiary: "#84a59d",
          highlight: "rgba(143, 159, 169, 0.15)",
          textHighlight: "#b3aa0288",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      // Plugin.Poetry(),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({
        comments: false,
        highlight: false,
        wikilinks: true,
        callouts: true,
        mermaid: false,
        parseTags: false,
        parseArrows: false,
        parseBlockReferences: false,
        enableInHtmlEmbed: false,
        enableYouTubeEmbed: true,
        enableVideoEmbed: false,
        enableCheckbox: false,
      }),

      // Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.OxHugoFlavouredMarkdown(
        {
          wikilinks: true,
          replaceFigureWithMdImg: true,
        }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents({
        // Heading numbers, not level counts: list H2 and H3, skip H1 and H4+.
        // Body H1 exists in 134 notes and is not a section heading there.
        minDepth: 2,
        maxDepth: 3
        }),
      Plugin.CrawlLinks({ markdownLinkResolution: "absolute",
                          prettyLinks: false }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.CategoryPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
        includeContent: false,
        includeDescription: true,
        includeAbstract: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // CustomOgImages: 폰트 로더는 util/og.tsx의 getOgSocialFonts에
      // 준비되어 있다(42dot Sans를 theme 이름으로 재라벨링). 디자인이 아직
      // 매력적이지 않고 풀빌드 +3~5분이라 기본은 꺼둔다. 필요할 때 주석 해제.
      // Plugin.CustomOgImages(),
    ],
  },
}

export default config
