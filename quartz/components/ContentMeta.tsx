import { Date, getDateCustom } from "./Date"
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import readingTime from "reading-time"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"
import { JSX } from "preact"
import style from "./styles/contentMeta.scss"
import { wikidocsMirrorUrl } from "../util/wikidocsMirror"

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

    if (!text) return null

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
    if (options.showReadingTime && !isIndex) {
      const { minutes } = readingTime(text)
      const displayedTime = i18n(cfg.locale).components.contentMeta.readingTime({
        minutes: Math.ceil(minutes),
      })
      segments.push(<span>{displayedTime}</span>)
    }

    // Source/provenance links
    const showGitHubLinks = options.repoLink && options.branch && !isIndex
    const mirrorUrl = isIndex ? undefined : wikidocsMirrorUrl(fileData.slug)

    return (
      <div class="contentmeta-container">
        {showGitHubLinks && (
          <p class="content-meta github-links">
            <a
              class="github-link"
              href={`${options.repoLink}/blob/${options.branch}/${fileData.filePath}`}
            >
              ᨒ Source
            </a>
            <a
              class="github-link"
              href={`${options.repoLink}/blame/${options.branch}/${fileData.filePath}`}
            >
              ᨒ Blame
            </a>
            <a
              class="github-link external"
              href={`${options.repoLink?.replace("github.com", "github.githistory.xyz")}/commits/${options.branch}/${fileData.filePath}`}
            >
              ᨒ History ↗
            </a>
            {mirrorUrl && (
              <a
                class="github-link external"
                href={mirrorUrl}
                title="한국어 검색과 읽기를 위한 위키독스 발견 미러"
              >
                ᨒ WikiDocs mirror ↗
              </a>
            )}
          </p>
        )}
        <p
          show-comma={options.showComma}
          class={classNames(displayClass, "content-meta")}
        >
          {segments}
        </p>
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
  return ContentMetadata
}) satisfies QuartzComponentConstructor
