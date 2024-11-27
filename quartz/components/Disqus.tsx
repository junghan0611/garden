import { FunctionComponent } from "preact"
interface DisqusProps {
  slug: string
}
const Disqus: FunctionComponent<DisqusProps> = ({ slug }) => {
  return (
    <div id="disqus_thread" data-slug={slug} style="color-scheme: normal"></div>
  )
}
export const disqusScript = `
  var disqus_config = function () {
    this.page.url = window.location.href;
    this.page.identifier = document.getElementById('disqus_thread').dataset.slug;
  };
  setTimeout(function() {
    var d = document, s = d.createElement('script');
    s.src = 'https://idencosmos.disqus.com/embed.js';
    s.setAttribute('data-timestamp', +new Date());
    (d.head || d.body).appendChild(s);
  }, 500);  // 0.5초 후에 로드
`

export default Disqus

