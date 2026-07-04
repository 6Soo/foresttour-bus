# foresttour-bus

숲길따라 감성여행 도구 모음. GitHub Pages로 배포됩니다 (bus.foresttour.kr).
빌드 과정 없는 순수 정적 사이트입니다 (HTML/CSS/JS).

## 구조

| 파일 | 역할 |
|---|---|
| `index.html` + `script.js` + `styles.css` | 버스 좌석표 도구 (기존) |
| `itinerary.html` + `itinerary.js` + `itinerary.css` | 여행 일정 직접 입력·공유 페이지 (토스 스타일 모바일 UI) |
| `import.html` + `import.js` + `import.css` | 이미지(OCR)·텍스트 → 일정 자동 변환 도구 |
| `parse-rules.js` | **두 일정 페이지가 공유**하는 카테고리 정의(`CATS`)와 파싱 규칙(`PARSE_RULES`) |

- 일정 데이터는 URL 해시(`#d=base64`)로 공유되고 localStorage(`foresttour-itinerary-v1`)에 자동 저장됩니다.
- import 페이지의 결과는 `itinerary.html#d=...` 로 넘겨서 열립니다.
- 버스 페이지와 일정 페이지는 디자인 통일성을 유지할 필요가 없습니다.

## ⭐ 일정 이미지 학습 워크플로 (중요)

사용자는 다음카페에 올리는 일정 이미지(캡처)를 수시로 공유합니다.
**새 일정 이미지를 받으면 아래 순서로 "학습"하세요:**

1. 이미지를 읽고 일정 양식을 파악한다 (일차 표기, 숙박 표기, 항목 유형, 날짜 표기).
2. `parse-rules.js`의 규칙으로 파싱되는지 검토한다:
   - `PARSE_RULES.dayHeaders` — 일차 시작 패턴 (예: `첫날..`, `<제1일>`, `DAY 1`, `1일차`)
   - `PARSE_RULES.stayInline/stayBracket/stayKeyword` — 숙박 패턴 (예: `[숙박- ...]`, `[OO온천호텔]`)
   - `PARSE_RULES.categoryKeywords` — 항목 분류 키워드
   - `PARSE_RULES.dateHints` — 제목 속 날짜 추출 (예: `7월4(토)~9/야마가타`)
3. 새 양식이면 패턴/키워드를 **추가**한다 (기존 패턴은 유지 — 옛 이미지도 계속 파싱돼야 함).
   OCR 오인식 변형도 함께 등록한다 (예: `둘쨋날` → OCR이 `둘짤`로 읽음).
4. 새 항목 유형이 필요하면 `CATS`에 카테고리를 추가한다 (이모지/색상 포함).
   `CATS`는 두 페이지 모두에서 자동 반영된다.
5. 필요하면 일정 카드 디자인(itinerary.css)도 함께 개선한다.
6. 테스트: `node`로 파서 단위 테스트 후 Playwright(사전 설치된 `/opt/pw-browsers/chromium`)로 페이지 확인.
   ```bash
   node -e "const {parseScheduleText}=require('./parse-rules.js'); console.log(JSON.stringify(parseScheduleText(\`첫날..테스트\`),null,2))"
   ```

### 사용자 교정 학습 (런타임)

import 미리보기에서 사용자가 분류를 고치면 `localStorage('foresttour-learned-cats-v1')`에
`{kw, cat}` 형태로 저장되어 다음 분석 때 키워드 규칙보다 우선 적용됩니다 (`classifyText` 참고).

### 지금까지 학습한 이미지 양식

- 국내 일정 (화순·담양·지리산): `첫날..`/`둘쨋날..` 표기, `[숙박- ...+조식]` 표기, `*...*` 안내문
- 일본 일정 (야마가타/니가타): `<제N일>` 표기, `[기본 여행 일정]` 헤더(무시), 숙박이 `[OO온천호텔]`처럼 '숙박' 글자 없이 대괄호만으로 표기됨
- 다음카페 게시글 캡처: 상단 제목줄에 날짜 범위 포함 (예: `7월4(토)~9/야마가타&...`) → 출발일 추출

## 주의

- `tesseract.js` 및 한글 traineddata는 jsdelivr CDN에서 로드됨 — 이 개발 환경에서는 프록시가
  jsdelivr를 차단하므로 OCR 테스트는 npm 패키지 `tesseract.js` + `@tesseract.js-data/kor`를
  로컬 설치해서 node로 수행할 것 (실서비스 브라우저에서는 정상 동작).
- 커밋 메시지는 기존 스타일(`feat:`, `fix:`, `style:`)을 따른다.
