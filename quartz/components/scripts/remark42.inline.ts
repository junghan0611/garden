function destroyRemark42() {
  if (typeof window !== "undefined" && (window as any).REMARK42) {
    (window as any).REMARK42.destroy()
  }
  // Remove previously loaded embed script
  const old = document.getElementById("remark42-script")
  if (old) old.remove()
}

function getCurrentTheme(): string {
  return document.documentElement.getAttribute("saved-theme") ?? "light"
}

const changeTheme = (e: CustomEventMap["themechange"]) => {
  if (typeof window !== "undefined" && (window as any).REMARK42) {
    ;(window as any).REMARK42.changeTheme(e.detail.theme)
  }
}

document.addEventListener("nav", () => {
  const container = document.querySelector(".remark42-comments")
  if (!container) return

  const remarkHost = container.getAttribute("data-remark-url")
  const siteId = container.getAttribute("data-remark-site-id")
  if (!remarkHost || !siteId) return

  // Destroy previous instance on SPA navigation
  destroyRemark42()

  // Denote identifier의 T를 대문자로 복원 (호스팅이 URL을 소문자로 변환하므로)
  // /bib/20240301t072554 → /bib/20240301T072554
  const pageUrl = window.location.href
    .replace(/#.*$/, "")
    .replace(/\/$/, "")
    .replace(/(\d{8})t(\d{6})/g, "$1T$2")

  ;(window as any).remark_config = {
    host: remarkHost,
    site_id: siteId,
    url: pageUrl,
    theme: getCurrentTheme(),
    components: ["embed"],
    show_email_subscription: false,
  }

  // Dynamically load embed.js
  const script = document.createElement("script")
  script.id = "remark42-script"
  script.src = `${remarkHost}/web/embed.js`
  script.async = true
  script.defer = true
  document.head.appendChild(script)

  // Listen for theme changes
  document.addEventListener("themechange", changeTheme)
  window.addCleanup(() => document.removeEventListener("themechange", changeTheme))
})
