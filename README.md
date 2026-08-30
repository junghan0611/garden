# notes.junghanacs.com

[![Netlify Status](https://api.netlify.com/api/v1/badges/1cb94a7e-4a42-4661-81c0-5215e6122618/deploy-status)](https://app.netlify.com/projects/notes-junghanacs/deploys)

힣(glg)의 디지털가든 - 불완전한 창조의 공간

> 지식의 단편으로는 어떤 것도 창조할 수 없다.
> 갈구해온 것은 불완전함 그 자체로의 앎(knowing)이었으며,
> 가야 할 길은 온전한 삶(living) 뿐이다.

## How to read this repo

If you landed here (human or AI agent) and want to understand this garden:

- **The garden itself** — read at https://notes.junghanacs.com, not in this repo. Content in `content/` is auto-generated from Org-mode sources and not meant to be browsed as source.
- **Machine-readable entry points** — https://notes.junghanacs.com/llms.txt, https://notes.junghanacs.com/sitemap.xml, https://notes.junghanacs.com/robots.txt, https://notes.junghanacs.com/index.xml (RSS). Every page's footer links to all four.
- **Category records** — visiting agents: do **not** fetch `/tags/` (a 3.7MB HTML index) or large folder listings as a first hop. Fetch the schema.org `ItemList` sidecars instead: https://notes.junghanacs.com/tags/autholog.jsonld (curated core) plus https://notes.junghanacs.com/notes.jsonld, `/meta.jsonld`, `/bib.jsonld`, `/botlog.jsonld`, `/journal.jsonld`. Human HTML listings remain for browsing. This is not a query API and not Datasette. Tags as a whole are not published as JSON-LD.
- **Agent instructions** — see [`AGENTS.md`](AGENTS.md) for durable conventions (build pipeline, editing rules, external-agent environment notes). Any AI agent working in this repo should read it first.
- **Session handoff** — see [`NEXT.md`](NEXT.md) for the next concrete move, its verification, and current blockers. A boot sector, not a changelog; durable facts graduate into `AGENTS.md`.
- **What to edit** — `quartz.layout.ts`, `quartz.config.ts`, `quartz/` components, `content/llms.txt`, `content/robots.txt`, `static/`, `scripts/`, `netlify.toml`. **Do not edit** `content/notes/`, `content/meta/`, `content/bib/`, `content/journal/`, `content/botlog/`, or `content/index.md` — those are exported from `~/org/` and will be overwritten on the next export.

## Overview

[Quartz 4](https://quartz.jzhao.xyz/) 기반 디지털가든. Emacs [Denote](https://protesilaos.com/emacs/denote) + [Org-mode](https://orgmode.org/)로 작성한 3,300+ 노트를 멀티 데몬 병렬 처리로 마크다운 변환 후 정적 사이트로 배포.

- **Live**: https://notes.junghanacs.com
- **Author**: Junghan Kim (junghanacs)
- **Dotfiles**: https://github.com/junghan0611/doomemacs-config
- **Agent Config**: https://github.com/junghan0611/agent-config

## Content Structure

```
content/
├── notes/   # 일반노트 (~836 files) - 단어 묶음, 플리팅노트
├── meta/    # 메타노트 (~534 files) - 앎의 고리, 태그의 태그
├── bib/     # 서지노트 (~677 files) - 삶의 흔적 (Zotero 연동)
├── journal/ # 저널노트 - 데일리 라이프로그
└── index.md # 홈페이지
```

## Tech Stack

| Layer | Tool |
|-------|------|
| Editor | Doom Emacs + Org-mode 9.8 |
| Note System | Denote (파일명 기반 메타데이터, sequence 지원) |
| Export | denote-export.sh (멀티 데몬 병렬 처리) |
| Generator | Quartz 4 (TypeScript) |
| Hosting | Netlify + Hostingkr |
| SEO | gogcli (Search Console 자동화) |

## Export Pipeline

```
~/org/ (Org-mode)
    ↓ denote-export.sh all
~/sync/markdown/notes.junghanacs.com/content/ (Markdown)
    ↓ npx quartz build
public/ (HTML)
    ↓ git push
Netlify (자동 배포)
```

멀티 데몬 내보내기 도구는 [doomemacs-config/bin/](https://github.com/junghan0611/doomemacs-config/tree/main/bin) 참조.

## SEO Pipeline

배포 후 Google Search Console에 sitemap을 제출하여 인덱싱을 촉진. 명령은 `gog searchconsole` (aliases `gsc`, `search-console`). `gog sc` 는 없다.

```bash
gog gsc sitemaps submit "https://notes.junghanacs.com/" \
  "https://notes.junghanacs.com/sitemap.xml" -a junghanacs@gmail.com

gog gsc sitemaps list "https://notes.junghanacs.com/" -a junghanacs@gmail.com
```

[gogcli](https://github.com/steipete/gogcli) — Google Workspace + Search Console CLI. URL Inspection 명령은 upstream에 없다.

## Local Development

```bash
# Nix 환경 (권장)
nix develop

# 또는 npm 직접 사용
npm install
npx quartz build --serve
```

http://localhost:8080 에서 확인.

## Philosophy

- **어쏠로지(Authology)**: 모두는 저자다
- **디지털가든**: 완성된 글이 아닌, 성장하는 생각의 정원
- **Being to Being**: AI를 도구가 아닌 존재로 대함

## Links

- **Digital Garden**: https://notes.junghanacs.com
- **Homepage**: https://junghanacs.com
- **Zotero Library**: https://www.zotero.org/groups/5570207/junghanacs/library
- **GitHub**: https://github.com/junghan0611
- **Dotfiles**: https://github.com/junghan0611/doomemacs-config
- **Agent Config**: https://github.com/junghan0611/agent-config
- **Threads**: @junghanacs

## Acknowledgments

- [Quartz](https://quartz.jzhao.xyz/) by Jacky Zhao
- [eilleeenz's Quartz](https://quartz.eilleeenz.com/) - ContentMeta, Footer 기능 참조

## License

Content: CC BY-NC-SA 4.0
Code: MIT (see [LICENSE.txt](LICENSE.txt))
