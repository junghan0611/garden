import { Date, getDateCustom } from "./Date"
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import readingTime from "reading-time"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"
import { JSX } from "preact"
import style from "./styles/contentMeta.scss"
import { wikidocsMirrorUrl } from "../util/wikidocsMirror"
import { markdownSidecarSlug } from "../util/markdownSidecar"
// @ts-ignore
import script from "./scripts/contentMeta.inline"

interface ContentMetaOptions {
  showReadingTime: boolean
  showComma: boolean
  repoLink?: string
  branch?: string
}

const defaultOptions: ContentMetaOptions = {
  showReadingTime: true,
  showComma: true,
}

export default ((opts?: Partial<ContentMetaOptions>) => {
  const options: ContentMetaOptions = { ...defaultOptions, ...opts }

  function ContentMetadata({ cfg, fileData, displayClass }: QuartzComponentProps) {
    const text = fileData.text
    const isIndex = fileData.slug === "index"
    const mirrorUrl = isIndex ? undefined : wikidocsMirrorUrl(fileData.slug)
    const markdownSlug = markdownSidecarSlug(fileData.slug, fileData.filePath)

    if (!text && !mirrorUrl) return null

    const segments: (string | JSX.Element)[] = []

    // Created / Modified dates
    if (fileData.dates && !isIndex) {
      const created = getDateCustom(cfg, fileData, "created")
      const modified = getDateCustom(cfg, fileData, "modified")

      if (created) {
        segments.push(
          <span class="dt-published-wrap">
            Created: <Date date={created} locale={cfg.locale} />
          </span>,
        )
      }

      // Only show modified if different from created
      if (modified && created && modified.getTime() !== created.getTime()) {
        segments.push(
          <>
            Modified: <Date date={modified} locale={cfg.locale} />
          </>,
        )
      }
    }

    // Reading time
    if (options.showReadingTime && !isIndex && text) {
      const { minutes } = readingTime(text)
      const displayedTime = i18n(cfg.locale).components.contentMeta.readingTime({
        minutes: Math.ceil(minutes),
      })
      segments.push(<span>{displayedTime}</span>)
    }

    // Source/provenance links, kept to one line on a 360px phone: short labels, ↗ only where the
    // original line had it (History, WikiDocs).
    // WikiDocs stays last and independent of GitHub and MD — it appears only when the committed
    // snapshot maps this page, so the always-present links never shift position.
    const showGitHubLinks = Boolean(options.repoLink && options.branch && !isIndex)
    const markdownHref = markdownSlug ? `/${markdownSlug}.md` : undefined
    const showProvenance = showGitHubLinks || Boolean(markdownHref) || Boolean(mirrorUrl)

    return (
      <div class="contentmeta-container">
        {showProvenance && (
          <p class="content-meta github-links">
            {showGitHubLinks && (
              <>
                <a
                  class="github-link"
                  href={`${options.repoLink}/blob/${options.branch}/${fileData.filePath}`}
                  title="GitHub 원본 (ox-hugo export)"
                >
                  Source
                </a>
                <a
                  class="github-link"
                  href={`${options.repoLink}/blame/${options.branch}/${fileData.filePath}`}
                  title="GitHub blame"
                >
                  Blame
                </a>
                <a
                  class="github-link external"
                  href={`${options.repoLink?.replace("github.com", "github.githistory.xyz")}/commits/${options.branch}/${fileData.filePath}`}
                  title="커밋 히스토리 (githistory.xyz)"
                >
                  History ↗
                </a>
              </>
            )}
            {markdownHref && (
              <>
                <a
                  class="github-link markdown-view"
                  href={markdownHref}
                  type="text/markdown"
                  data-router-ignore
                  title="이 페이지의 Markdown 원문 — 에이전트·LLM용"
                >
                  MD
                </a>
                <a
                  class="github-link markdown-copy"
                  href={markdownHref}
                  data-router-ignore
                  data-markdown-copy
                  aria-live="polite"
                  title="이 페이지를 Markdown으로 클립보드에 복사"
                >
                  CopyMD
                </a>
              </>
            )}
            {mirrorUrl && (
              <a
                class="github-link external"
                href={mirrorUrl}
                title="위키독스에 퍼블리시된 이 페이지"
              >
                WikiDocs ↗
              </a>
            )}
          </p>
        )}
        {segments.length > 0 && (
          <p
            show-comma={options.showComma}
            class={classNames(displayClass, "content-meta")}
          >
            {segments}
          </p>
        )}
        {/* IndieWeb microformats (hidden) */}
        {!isIndex && cfg.baseUrl && fileData.slug && (
          <>
            <a class="u-url" href={`https://${cfg.baseUrl}/${fileData.slug}`} style="display:none"></a>
            <span class="p-author h-card" style="display:none">
              <a class="p-name u-url" href={`https://${cfg.baseUrl}`}>Junghan Kim</a>
            </span>
          </>
        )}
      </div>
    )
  }

  ContentMetadata.css = style
  ContentMetadata.afterDOMLoaded = script
  return ContentMetadata
}) satisfies QuartzComponentConstructor
