import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import style from "./styles/webmentions.scss"
// @ts-ignore
import script from "./scripts/webmentions.inline"

export default (() => {
  const Webmentions: QuartzComponent = ({
    displayClass,
    cfg,
    fileData,
  }: QuartzComponentProps) => {
    const disableComment: boolean =
      typeof fileData.frontmatter?.comments !== "undefined" &&
      (!fileData.frontmatter?.comments || fileData.frontmatter?.comments === "false")
    if (disableComment) {
      return <></>
    }

    const pageUrl = `https://${cfg.baseUrl}/${fileData.slug}`

    return (
      <div
        class={classNames(displayClass, "webmentions")}
        id="webmentions"
        data-base-url={cfg.baseUrl}
        data-slug={fileData.slug}
      >
        <hr class="wm-separator" />
        <h3>Webmentions</h3>
        <div class="wm-cta">
          <a
            href={`https://bsky.app/intent/compose?text=${encodeURIComponent(pageUrl)}`}
            target="_blank"
            rel="noopener"
          >
            Reply via Bluesky
          </a>
          <a
            href={`https://fosstodon.org/share?text=${encodeURIComponent(pageUrl)}`}
            target="_blank"
            rel="noopener"
          >
            Reply via Mastodon
          </a>
        </div>
        <div id="wm-mentions"></div>
      </div>
    )
  }

  Webmentions.css = style
  Webmentions.afterDOMLoaded = script

  return Webmentions
}) satisfies QuartzComponentConstructor
