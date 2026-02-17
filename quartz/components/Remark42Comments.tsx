import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import style from "./styles/remark42.scss"
// @ts-ignore
import script from "./scripts/remark42.inline"

export default (() => {
  const Remark42Comments: QuartzComponent = ({
    displayClass,
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
        class={classNames(displayClass, "remark42-comments")}
        data-remark-url="https://comments.junghanacs.com"
        data-remark-site-id="notes"
      >
        <hr class="remark42-separator" />
        <h3>Comments</h3>
        <div id="remark42"></div>
      </div>
    )
  }

  Remark42Comments.css = style
  Remark42Comments.afterDOMLoaded = script

  return Remark42Comments
}) satisfies QuartzComponentConstructor
