---
name: wikidocs-mirror
description: >-
  가든 퍼블리시 때 위키독스 라이브 URL을 스냅샷으로 거둬 WikiDocs ↗ 를 붙인다.
  정본은 가든, garden2wikidocs는 서브. 서브를 열어 링크를 만들지 않는다.
  Triggers: '위키독스 링크', 'WikiDocs ↗', '스냅샷 가져와', 'wikidocs-map',
  '어쏠로그 버튼', 'mapping import'.
---

# 가든 ↔ WikiDocs (가든 면)

정책 SSOT는 `docs/WIKIDOCS_MIRROR.md`. 이 스킬은 **다음 가든 퍼블리시 손잡이**다.

가든이 정본이다. 서브(`garden2wikidocs`)가 가든을 가져가 위키독스 페이지와 `page_id`를
만들어 둔다. 가든은 그 리포를 열어 링크를 만들지 않는다. 다음 텀에 퍼블리시할 때
「만들어 놨네」 하고 스냅샷만 거둬 붙인다.

이번 사이클에 버튼이 없어도 정상이다. 회수·위키독스 동기화는 서브의 다음 판이 한다.

## 퍼블리시 텀에서 하는 일

형제 체크아웃 `~/repos/gh/garden2wikidocs` 의 `mapping.json` + `TOC.md` 를 읽는다.
Netlify는 이 스크립트를 안 돌린다.

```bash
node scripts/sync-wikidocs-map.mjs
node scripts/sync-wikidocs-map.mjs --check
```

확인:

- `_meta.schemaVersion` 이 `2`
- 라이브 TOC만 들어 있다 (본문 + 표지 6). 2238행 풀미러가 다시 오면 실패다
- 표본이 서브의 라이브 URL과 같다. 예: `20230725T102900` → `https://wikidocs.net/419348`

스냅샷이 바뀌었으면 커밋은 GLG 승인 뒤에. 본문 MD는 안 건드린다.
`run.sh` 는 GLG가 본다. 요청 없이 export/빌드 검증을 하지 않는다.

## 버튼이 없어도 가든을 막지 않는다

코어는 `autholog` ∪ `botlog` 다. 저널·서지 개별 글은 위키독스 페이지가 없다.

- 코어가 아니면 버튼 없음이 맞다
- 코어인데 스냅샷에 없으면 서브가 아직 회수하지 않은 것이다. **여기서 회수하지 않는다.**
  다음 퍼블리시 텀에 import 하면 붙는다
- 스냅샷 URL과 사이트가 다르면 import가 낡은 것이다. 다시 거두면 된다

JSON-LD `sameAs` 는 달지 않는다. Org/`content/` 를 미러 때문에 고치지 않는다.

## 하지 말 것

- garden2wikidocs 를 열어 `pages/` 를 고치거나 링크를 만들기
- 이 리포에서 `recover.py` / `status.py` / `build.py` / `WIKIDOCS_TOKEN`
- `mapping.json` 전체(죽은 page_id 포함)를 스냅샷에 넣기
- 위키독스 HTTP HEAD (가든 빌드·Netlify 금지)
- 버튼 없다고 가든 배포를 멈추기
