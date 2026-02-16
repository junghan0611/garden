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

    return (
      <div
        class={classNames(displayClass, "webmentions")}
        id="webmentions"
        data-base-url={cfg.baseUrl}
        data-slug={fileData.slug}
      >
      </div>
    )
  }

  Webmentions.css = style
  Webmentions.afterDOMLoaded = script

  return Webmentions
}) satisfies QuartzComponentConstructor
