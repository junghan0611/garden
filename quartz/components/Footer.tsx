import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/footer.scss"
import { version } from "../../package.json"
import { i18n } from "../i18n"
// @ts-ignore
import script from "./scripts/footerButtons.inline"

interface Options {
  links: Record<string, string>
}

export default ((opts?: Options) => {
  const Footer: QuartzComponent = ({ displayClass, cfg }: QuartzComponentProps) => {
    const year = new Date().getFullYear()
    const links = opts?.links ?? []
    return (
      <footer class={`${displayClass ?? ""} footer`}>
        <p>
          {i18n(cfg.locale).components.footer.createdWith}{" "}
          <a href="https://quartz.jzhao.xyz/">Quartz v{version}</a> © {year}
        </p>
        <ul>
          {Object.entries(links).map(([text, link]) => (
            <li>
              <a href={link}>{text}</a>
            </li>
          ))}
        </ul>
        <div class="h-card footer-hcard" style="display:none">
          <a class="p-name u-url" rel="me" href={`https://${cfg.baseUrl}`}>Junghan Kim</a>
          <span class="p-nickname">junghanacs</span>
          <a class="u-url" rel="me" href="https://bsky.app/profile/junghanacs.bsky.social">Bluesky</a>
          <a class="u-url" rel="me" href="https://fosstodon.org/@junghanacs">Mastodon</a>
        </div>
        <ul class="footer-actions">
          <li>
            <a id="scroll-to-top" href="#">
              Scroll to top ↑
            </a>
          </li>
          <li>
            <a id="random-page-button">
              Random Page 🎲
            </a>
          </li>
        </ul>
      </footer>
    )
  }

  Footer.css = style
  Footer.afterDOMLoaded = script
  return Footer
}) satisfies QuartzComponentConstructor
