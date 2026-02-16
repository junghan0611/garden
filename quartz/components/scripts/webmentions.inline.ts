function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function sourceLabel(url: string): string {
  if (url.includes("bsky.app")) return "Bluesky"
  if (url.includes("fosstodon.org") || url.includes("mastodon")) return "Mastodon"
  if (url.includes("threads.net")) return "Threads"
  return "Web"
}

interface WebmentionAuthor {
  name?: string
  photo?: string
  url?: string
}

interface Webmention {
  "wm-id": number
  "wm-property": string
  "wm-received": string
  url: string
  author?: WebmentionAuthor
  content?: { text?: string; html?: string }
  published?: string
}

async function fetchWebmentions(target: string): Promise<Webmention[]> {
  const url = `https://webmention.io/api/mentions.jf2?target=${encodeURIComponent(target)}&per-page=100&sort-by=published`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return data.children ?? []
  } catch {
    return []
  }
}

function renderFacepile(mentions: Webmention[], label: string): string {
  if (mentions.length === 0) return ""
  const faces = mentions
    .filter((m) => m.author?.photo)
    .map(
      (m) =>
        `<a href="${m.author!.url ?? m.url}" title="${m.author?.name ?? ""}" target="_blank" rel="noopener">` +
        `<img class="wm-face" src="${m.author!.photo}" alt="${m.author?.name ?? ""}" loading="lazy" />` +
        `</a>`,
    )
    .join("")
  const count = mentions.length
  return `<div><strong>${label} (${count})</strong></div><div class="wm-facepile">${faces}</div>`
}

function renderReplies(mentions: Webmention[]): string {
  if (mentions.length === 0) return ""
  const items = mentions
    .map((m) => {
      const avatar = m.author?.photo
        ? `<img class="wm-avatar" src="${m.author.photo}" alt="${m.author?.name ?? ""}" loading="lazy" />`
        : `<div class="wm-avatar" style="background:var(--lightgray)"></div>`
      const name = m.author?.name ?? "Anonymous"
      const nameLink = m.author?.url
        ? `<a href="${m.author.url}" target="_blank" rel="noopener">${name}</a>`
        : name
      const date = m.published ? formatDate(m.published) : ""
      const text = m.content?.text ?? ""
      const truncated = text.length > 300 ? text.slice(0, 300) + "..." : text
      const source = sourceLabel(m.url)
      return (
        `<div class="wm-reply">` +
        `${avatar}` +
        `<div class="wm-reply-body">` +
        `<div class="wm-reply-meta">${nameLink}<span>${date}</span></div>` +
        `<div class="wm-reply-content">${truncated}</div>` +
        `<div class="wm-reply-source"><a href="${m.url}" target="_blank" rel="noopener">via ${source}</a></div>` +
        `</div></div>`
      )
    })
    .join("")
  return `<h3>Replies</h3><div class="wm-replies">${items}</div>`
}

document.addEventListener("nav", () => {
  const container = document.getElementById("webmentions")
  if (!container) return

  const baseUrl = container.dataset.baseUrl
  const slug = container.dataset.slug
  if (!baseUrl || !slug) return

  // Build target URL (try both with and without trailing slash)
  const target = `https://${baseUrl}/${slug}`

  const mentionsEl = document.getElementById("wm-mentions")
  if (!mentionsEl) return

  mentionsEl.innerHTML = `<div class="wm-loading">Loading...</div>`

  fetchWebmentions(target).then((mentions) => {
    if (mentions.length === 0) {
      mentionsEl.innerHTML = ""
      return
    }

    const likes = mentions.filter((m) => m["wm-property"] === "like-of")
    const reposts = mentions.filter((m) => m["wm-property"] === "repost-of")
    const replies = mentions.filter(
      (m) => m["wm-property"] === "in-reply-to" || m["wm-property"] === "mention-of",
    )

    let html = ""
    html += renderFacepile(likes, "Likes")
    html += renderFacepile(reposts, "Reposts")
    html += renderReplies(replies)

    mentionsEl.innerHTML = html
  })

  // Handle webmention send form
  const form = container.querySelector(".wm-send-form") as HTMLFormElement | null
  if (form) {
    const handler = async (e: Event) => {
      e.preventDefault()
      const btn = form.querySelector("button") as HTMLButtonElement
      btn.disabled = true
      btn.textContent = "Sending..."

      try {
        const res = await fetch(form.action, {
          method: "POST",
          body: new URLSearchParams(new FormData(form) as unknown as Record<string, string>),
        })
        if (res.ok) {
          btn.textContent = "Sent!"
          ;(form.querySelector("input[name=source]") as HTMLInputElement).value = ""
        } else {
          btn.textContent = "Failed"
        }
      } catch {
        btn.textContent = "Error"
      }

      setTimeout(() => {
        btn.disabled = false
        btn.textContent = "Send"
      }, 3000)
    }
    form.removeEventListener("submit", handler)
    form.addEventListener("submit", handler)
  }
})
