# AGENTS.md

AI 에이전트를 위한 프로젝트 컨텍스트.

## Project Overview

| Field | Value |
|-------|-------|
| Name | notes.junghanacs.com |
| Type | Quartz 4 디지털가든 |
| Language | Korean (ko-KR) |
| Author | Junghan Kim (@junghanacs) |
| Live URL | https://notes.junghanacs.com |

## Directory Structure

```
.
├── content/           # 마크다운 콘텐츠 (Denote에서 변환됨)
│   ├── notes/         # 일반노트 (~830 files)
│   ├── meta/          # 메타노트 (~530 files)
│   ├── bib/           # 서지노트 (~650 files)
│   ├── journal/       # 저널노트
│   └── index.md       # 홈페이지
├── quartz/            # Quartz 4 소스코드
├── static/            # 정적 파일 (images, fonts)
├── public/            # 빌드 결과물 (.gitignore)
├── quartz.config.ts   # Quartz 설정 (테마, 플러그인)
├── quartz.layout.ts   # 레이아웃 설정
├── flake.nix          # Nix 개발 환경
└── Book.bib           # BibTeX 참고문헌
```

## Content Pipeline

### Source (Org-mode)
- Location: `~/org/` (meta, bib, notes 폴더)
- Format: Denote 파일명 규칙 (`YYYYMMDDTHHMMSS--title__tags.org`)
- Editor: Doom Emacs + Org-mode

### Export
- Tool: `denote-export.sh` (멀티 데몬 병렬 처리)
- Source repo: https://github.com/junghan0611/doomemacs-config
- Output: Hugo-flavored Markdown

### Build
- Generator: Quartz 4
- Plugins: OxHugoFlavouredMarkdown, ObsidianFlavoredMarkdown
- Command: `npx quartz build`

## Key Files

| File | Purpose |
|------|---------|
| `quartz.config.ts` | 사이트 설정, 테마, 플러그인 |
| `quartz.layout.ts` | 레이아웃 컴포넌트 배치 |
| `content/index.md` | 홈페이지 콘텐츠 |
| `flake.nix` | Nix 개발 환경 정의 |
| `Book.bib` | Zotero 내보내기 BibTeX |

## Conventions

### Content
- **파일명**: Denote 형식 (타임스탬프 기반)
- **프론트매터**: YAML (title, date, tags, draft)
- **내부 링크**: Hugo relref 또는 Wikilinks

### Code Style
- TypeScript: Quartz 기본 스타일 따름
- 들여쓰기: 2 spaces
- 세미콜론: 없음

## Common Tasks

### 로컬 개발 서버
```bash
npx quartz build --serve
```

### 빌드
```bash
npx quartz build
```

### 콘텐츠 동기화 (Org → MD)
```bash
# doomemacs-config/bin/ 에서 실행
denote-export.sh all
```

### 린트 (gitleaks)
```bash
./lint.sh
```

## Notes

- `content/` 파일들은 직접 편집하지 않음 (Org에서 내보내기)
- `quartz/` 커스터마이징 시 upstream 업데이트 주의
- 한글 폰트: 42dot Sans, Hahmlet, Nanum Gothic Coding

## Google Search Console 재크롤링 체크리스트

`robots.txt`, `llms.txt`, `sitemap.xml` 등을 수정하고 배포한 뒤에는 Google에 재크롤링을 요청해야 한다.
제미나이는 구글 인덱스에서만 읽으므로, 인덱싱 안 되면 제미나이가 영원히 못 읽는다.

### 절차

1. [Google Search Console](https://search.google.com/search-console) 접속 (junghanacs@gmail.com)
2. 속성(property): `https://notes.junghanacs.com` 선택
3. **robots.txt 재크롤링**:
   - 좌측 메뉴 → 설정 → robots.txt → "제출" 또는 "업데이트 확인"
4. **개별 URL 인덱싱 요청**:
   - 상단 검색창에 URL 입력 (e.g. `https://notes.junghanacs.com/llms.txt`)
   - "인덱싱 요청" 클릭
5. **sitemap 제출**:
   - 좌측 메뉴 → Sitemaps → `sitemap.xml` 제출

### 배포 후 루프

```
커밋/푸시 → Netlify 빌드 완료 → Search Console에서 재크롤링 요청
→ 며칠 후 제미나이 새 세션에서 테스트
```

주의: 빌드 직후는 아직 인덱싱 전이다. 며칠 기다린 후 확인.
