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
        <details class="wm-send-section">
          <summary>Send a Webmention</summary>
          <form
            class="wm-send-form"
            action={`https://webmention.io/${cfg.baseUrl}/webmention`}
            method="post"
          >
            <input type="hidden" name="target" value={pageUrl} />
            <input
              type="url"
              name="source"
              placeholder="https://your-site.com/response"
              required
            />
            <button type="submit">Send</button>
          </form>
          <p class="wm-form-help">
            No website? Use{" "}
            <a href="https://commentpara.de" target="_blank" rel="noopener">
              commentpara.de
            </a>{" "}
            to leave a comment.
          </p>
        </details>
      </div>
    )
  }

  Webmentions.css = style
  Webmentions.afterDOMLoaded = script

  return Webmentions
}) satisfies QuartzComponentConstructor
