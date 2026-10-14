// "CopyMD": fetch this page's Markdown twin and put it on the clipboard. It stays a link — without JS,
// or with a modifier/middle click, it opens the .md. A failure is shown as a failure: a non-2xx answer,
// a network error or a denied clipboard never flashes "Copied". Leaving the page aborts a copy in flight.
const FLASH_MS = 1500

document.addEventListener("nav", () => {
  for (const link of document.querySelectorAll<HTMLAnchorElement>("a[data-markdown-copy]")) {
    const label = link.textContent ?? "CopyMD"
    let timer: number | undefined
    let inFlight: AbortController | undefined

    const flash = (text: string) => {
      link.textContent = text
      window.clearTimeout(timer)
      timer = window.setTimeout(() => (link.textContent = label), FLASH_MS)
    }

    async function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return
      event.preventDefault()
      inFlight?.abort()
      const controller = (inFlight = new AbortController())
      try {
        if (!navigator.clipboard) throw new Error("clipboard API unavailable (insecure context)")
        const response = await fetch(link.href, { signal: controller.signal })
        if (!response.ok) throw new Error(`${link.href} returned ${response.status}`)
        const markdown = await response.text()
        if (controller.signal.aborted) return
        await navigator.clipboard.writeText(markdown)
        flash("Copied")
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("[copy-md]", error)
        flash("Failed")
      }
    }

    link.addEventListener("click", onClick)
    window.addCleanup(() => {
      inFlight?.abort()
      link.removeEventListener("click", onClick)
      window.clearTimeout(timer)
      link.textContent = label
    })
  }
})
