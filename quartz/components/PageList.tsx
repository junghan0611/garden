import { FullSlug, isFolderPath, resolveRelative } from "../util/path"
import { QuartzPluginData } from "../plugins/vfile"
import { Date, getDate, getDateCustom } from "./Date"
import { QuartzComponent, QuartzComponentProps } from "./types"
import { GlobalConfiguration } from "../cfg"

export type SortFn = (f1: QuartzPluginData, f2: QuartzPluginData) => number
export type ListingDateType = "created" | "modified"

function getListingDate(
  cfg: GlobalConfiguration,
  data: QuartzPluginData,
  dateType?: ListingDateType,
): globalThis.Date | undefined {
  return dateType ? getDateCustom(cfg, data, dateType) : getDate(cfg, data)
}

export function byDateAndAlphabetical(
  cfg: GlobalConfiguration,
  dateType?: ListingDateType,
): SortFn {
  return (f1, f2) => {
    // Sort by date/alphabetical
    const f1Date = getListingDate(cfg, f1, dateType)
    const f2Date = getListingDate(cfg, f2, dateType)
    if (f1Date && f2Date) {
      // sort descending
      return f2Date.getTime() - f1Date.getTime()
    } else if (f1Date && !f2Date) {
      // prioritize files with dates
      return -1
    } else if (!f1Date && f2Date) {
      return 1
    }

    // otherwise, sort lexographically by title
    const f1Title = f1.frontmatter?.title.toLowerCase() ?? ""
    const f2Title = f2.frontmatter?.title.toLowerCase() ?? ""
    return f1Title.localeCompare(f2Title)
  }
}

export function byDateAndAlphabeticalFolderFirst(
  cfg: GlobalConfiguration,
  dateType?: ListingDateType,
): SortFn {
  return (f1, f2) => {
    // Sort folders first
    const f1IsFolder = isFolderPath(f1.slug ?? "")
    const f2IsFolder = isFolderPath(f2.slug ?? "")
    if (f1IsFolder && !f2IsFolder) return -1
    if (!f1IsFolder && f2IsFolder) return 1

    // If both are folders or both are files, sort by date/alphabetical
    const f1Date = getListingDate(cfg, f1, dateType)
    const f2Date = getListingDate(cfg, f2, dateType)
    if (f1Date && f2Date) {
      // sort descending
      return f2Date.getTime() - f1Date.getTime()
    } else if (f1Date && !f2Date) {
      // prioritize files with dates
      return -1
    } else if (!f1Date && f2Date) {
      return 1
    }

    // otherwise, sort lexographically by title
    const f1Title = f1.frontmatter?.title.toLowerCase() ?? ""
    const f2Title = f2.frontmatter?.title.toLowerCase() ?? ""
    return f1Title.localeCompare(f2Title)
  }
}

type Props = {
  limit?: number
  sort?: SortFn
  showCreated?: boolean
  showDescription?: boolean
  dateType?: ListingDateType
} & QuartzComponentProps

export const PageList: QuartzComponent = ({
  cfg,
  fileData,
  allFiles,
  limit,
  sort,
  showCreated,
  showDescription,
  dateType,
}: Props) => {
  const sorter = sort ?? byDateAndAlphabeticalFolderFirst(cfg, dateType)
  let list = allFiles.sort(sorter)
  if (limit) {
    list = list.slice(0, limit)
  }

  return (
    <ul class="section-ul">
      {list.map((page) => {
        const title = page.frontmatter?.title
        const tags = page.frontmatter?.tags ?? []

        // synthetic folder rows borrow their newest child's created date, so it describes
        // no folder; they carry no description either
        const isFolder = isFolderPath(page.slug ?? "")
        const primaryDate = getListingDate(cfg, page, dateType)
        const created =
          !isFolder && showCreated && dateType !== "created"
            ? getDateCustom(cfg, page, "created")
            : undefined
        const description = !isFolder && showDescription ? page.description : undefined
        const hasMeta = created !== undefined || tags.length > 0

        return (
          <li class="section-li">
            <div class="section">
              <div class="section-head">
                {primaryDate && <Date date={primaryDate} locale={cfg.locale} />}
                <h3>
                  <a href={resolveRelative(fileData.slug!, page.slug!)} class="internal">
                    {title}
                  </a>
                </h3>
              </div>
              {hasMeta && (
                <p class="section-meta">
                  {created && (
                    <>
                      created: <Date date={created} locale={cfg.locale} />
                      {tags.length > 0 && "; "}
                    </>
                  )}
                  {tags.length > 0 && (
                    <>
                      tags:{" "}
                      {tags.map((tag, i) => (
                        <>
                          {i > 0 && ", "}
                          <a
                            class="internal tag-link"
                            href={resolveRelative(fileData.slug!, `tags/${tag}` as FullSlug)}
                          >
                            {tag}
                          </a>
                        </>
                      ))}
                    </>
                  )}
                </p>
              )}
              {description && <p class="section-desc">{description}</p>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

PageList.css = `
.section h3 {
  margin: 0;
}
`
