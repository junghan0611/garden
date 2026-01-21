# notes.junghanacs.com

힣(glg)의 디지털가든 - 불완전한 창조의 공간

> 지식의 단편으로는 어떤 것도 창조할 수 없다.
> 갈구해온 것은 불완전함 그 자체로의 앎(knowing)이었으며,
> 가야 할 길은 온전한 삶(living) 뿐이다.

## Overview

[Quartz 4](https://quartz.jzhao.xyz/) 기반 디지털가든. Emacs [Denote](https://protesilaos.com/emacs/denote) + [Org-mode](https://orgmode.org/)로 작성한 3,000+ 노트를 멀티 데몬 병렬 처리로 마크다운 변환 후 정적 사이트로 배포.

- **Live**: https://notes.junghanacs.com
- **Author**: Junghan Kim (junghanacs)
- **Dotfiles**: https://github.com/junghan0611/doomemacs-config

## Content Structure

```
content/
├── notes/   # 일반노트 (831 files) - 단어 묶음, 플리팅노트
├── meta/    # 메타노트 (530 files) - 앎의 고리, 태그의 태그
├── bib/     # 서지노트 (654 files) - 삶의 흔적 (Zotero 연동)
├── journal/ # 저널노트 - 데일리 라이프로그
└── index.md # 홈페이지
```

## Tech Stack

| Layer | Tool |
|-------|------|
| Editor | Doom Emacs + Org-mode 9.7 |
| Note System | Denote (파일명 기반 메타데이터) |
| Export | denote-export.sh (멀티 데몬 병렬 처리) |
| Generator | Quartz 4 (TypeScript) |
| Hosting | Netlify + Hostingkr |

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
- **GitHub (Brand)**: https://github.com/junghanacs
- **GitHub (Personal)**: https://github.com/junghan0611
- **Threads**: @junghanacs

## License

Content: CC BY-NC-SA 4.0
Code: MIT (see [LICENSE.txt](LICENSE.txt))
