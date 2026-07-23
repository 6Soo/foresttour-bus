# 항공권 예약 도구 — 세션 핸드오프 (판독 엔진 중심)

> 이 문서는 "바이브 항공권 예약"(flight.html) 도구를 한 세션 동안 집중 개발·수정한
> 내용을 새 세션이 이어받도록 남긴 기록이다. 여권 사진에서 탑승자 정보를 읽고,
> 카톡 메시지/화면에서 여정을 뽑아 예약 딥링크를 만드는 엔진이 핵심이다.
> **마지막 배포 자산 버전: `v=20260707s`** (다섯 HTML 공통).

---

## 1. 도구가 하는 일 (사용자 관점)

대장(연세 있는 여행 인솔자)이 **여권 사진** + **날짜·노선이 담긴 메시지/화면 캡처**(예:
`9.23~27 후쿠오카`)를 붙여넣으면:
- 탑승자별 **성(영문)·이름(영문)·생년월일·성별** 카드(값 눌러 수정 + `복사` 버튼) 생성
- **인천→후쿠오카 왕복 N명** 같은 **스카이스캐너·트립닷컴 딥링크** 생성

핵심 원칙: **손으로 타이핑하지 않는다.** 붙여넣기만으로 결과가 나와야 한다.
날짜는 여권에도 가격비교 화면에도 없으므로 **날짜가 적힌 메시지/캡처가 어딘가엔 있어야** 한다.

---

## 2. 두 개의 저장소

| 저장소 | 역할 |
|---|---|
| **6soo/foresttour-bus** (이 저장소) | 정적 사이트. 브라우저 안에서 tesseract.js로 여권/텍스트 OCR (기본, 오프라인). GitHub Pages 배포(bus.foresttour.kr). |
| **6soo/flight_prep** | Python FastAPI 서버. **Gemini 비전**으로 여권/화면을 정확 판독. Render 배포(Docker Blueprint). **선택**: 설정하면 정밀 판독기로 우선 사용. |

**두 저장소의 파싱 규칙은 1:1로 맞춘다** (공항 사전, 인원수, 날짜, 노선 방향 등).
한쪽을 고치면 반드시 다른 쪽도 같이 고칠 것.

---

## 3. 판독 정확도의 근본 구조 (제일 중요)

**브라우저 tesseract는 여권 이름·날짜 정확도에 한계가 명확하다.** 세션 내내 반복된
오류(생일 25→13, 성 `OY ST AL`, 이름 `LINSUNKLLL`, 중복)는 대부분 tesseract OCR 한계다.
**Gemini(서버)는 여권을 사람처럼 정확히 읽는다**(한글 이름까지).

그래서 현재 아키텍처는 **Gemini 우선, tesseract 폴백**이다:
- `flight.js`: 정밀 판독 서버 비밀번호가 저장돼 있으면(⚙️ 설정) 여권 이미지를 **서버(Gemini)로
  보내 정확 판독**. 링크는 클라이언트 파서로 안정 생성. 서버 실패 시 tesseract 자동 폴백.
  서버 미설정이면 tesseract(오프라인, 이미지 전송 없음).

> **다음 세션에게: 정확도를 확실히 올리는 길은 Gemini 서버를 실제로 배포·설정하는 것이다.**
> tesseract 경로는 계속 미세 오류가 난다(그래서 값 수정 기능을 뒀다). tesseract 패치로
> 100%를 좇지 말고, 서버 배포/안정화에 무게를 두는 게 맞다.

### 사용자(사장님)가 해야 하는 것
1. Render에 flight_prep 서비스 배포 + `GEMINI_API_KEY`(구글 AI 스튜디오 무료 키) + `APP_PASSWORD` 설정.
2. flight.html **⚙️ 정밀 판독 서버 설정**에서 서버 주소(예: `https://flight-prep-xxxx.onrender.com`)와 비밀번호 입력.
3. flight_prep에 이번 세션의 수정들(PR #1~#7)이 반영된 최신 이미지로 재배포됐는지 확인.

---

## 4. 파일과 역할

### 클라이언트 (foresttour-bus)
- **`mrz.js`** (신규, 순수 함수, node 테스트 가능): 여권 MRZ(하단 `<<<` 두 줄, ICAO 9303 TD3) 파서
  + 여권 **윗부분 인쇄영역** 파서(`parseVisualPassport`, MRZ가 안 보일 때 폴백).
  - `parseMrz(text, today)`: 체크디지트 검증, 성별 기준 블록 탐색(`parseLine2`, 밀림에 견고),
    이름 채움문자(`<`→글자) 정리(`cleanNamePart`), 발급국 KOR 앵커, 이름 오염 개별 판정
    (`surnameSuspect`/`givenSuspect`).
  - `parseVisualPassport(text)`: 영문 라벨(Surname/Given names/Date of birth/Sex/Date of expiry)
    앵커. 한/영 병기 라벨의 **한글 라벨 누출 방지**(라틴/숫자 있을 때만 값), 이름은 라틴만.
- **`flightprep.js`** (전역 `window.FlightPrep`): 공항사전(AIRPORTS/CODE_TO_CITY), `parseTrips`/
  `buildLinks`(딥링크), `analyzePaste`(서버 호출), `readPassports`(tesseract 판독+dedup+
  여권 아닌 이미지 OCR로 날짜·노선 추출).
- **`flight.js`**: UI 글루. 서버 우선 흐름, 붙여넣기 텍스트/이미지OCR→링크, 탑승자 복사칩(수정 가능),
  입력↔결과 화면 전환.
- **`flight.html`**, **`flight.css`**: 화면/스타일. `<script src="mrz.js">` → `flightprep.js` → `flight.js` 순 로드.

### 서버 (flight_prep)
- `src/flight_prep/parser.py`: 텍스트→Order (인원수 `parse_pax_count`, 공항 `parse_airports`,
  노선 방향, 날짜).
- `src/flight_prep/airports.py`: 공항 사전 (클라이언트와 동일 유지).
- `src/flight_prep/deeplinks.py`: 딥링크 URL.
- `src/flight_prep/vision.py`: Gemini 프롬프트(`_PASSPORT_PROMPT`, `_SCREENSHOT_PROMPT`).
- `app/server.py`: `/api/paste` — 붙여넣기 순서로 여권↔여정 그룹핑, dedup, `_trip_dict`.

---

## 5. 이번 세션에 반영한 수정 (전부 main 병합·배포됨)

**foresttour-bus PR #43~#55, flight_prep PR #1~#7.** 주제별로:

### 판독(여권)
- **MRZ 폰 내 인식** 도입(`mrz.js`) — 서버·비밀번호 없이, 이미지 전송 없이 여권 판독.
- **MRZ 안 보이면 윗부분(인쇄영역) 폴백** — 사진에서 하단이 잘려도 진행.
- **이름 채움문자 오독 정리** — `<`가 L·K로 읽혀 `INSUNKLLL...RL`처럼 붙던 것 → 같은 글자
  3연속 이상이면 그 지점부터 절단. 오염 감지 시 인쇄영역의 깨끗한 이름으로 **그 칸만** 교정.
- **중복 제거(dedup)** — 같은 여권 두 장/펼침면. 다중 키(여권번호·이름·생년+성·given+생년+성별),
  체크디지트 유효 판독본 우선 채택.
- **비주얼 파서 한글 라벨 누출 수정** — `Date of birth/생년월일`에서 한글이 값으로 새어
  탑승자 유실/`성 KIM` 되던 것.
- **이미지 확대·대비 강화 전처리**로 `<` 인식률 개선.
- **Gemini 서버 우선** 흐름 + tesseract 폴백.

### 여정·링크
- **일본 지방공항 20곳** 추가(고마쓰/코마쓰=KMQ, 니가타·야마가타·나고야·센다이·아오모리 등).
- **목적지만 적으면 한국 출발 보완** → 이후 **노선 방향 규칙**으로 발전:
  국외 공항=도착지, 한국 공항=출발지(없으면 ICN). `후쿠오카 인천공항 집결` 역전 수정.
- **괌**처럼 1음절 정식 도시명이 조사와 붙어도 인식(1글자 낱말경계 체크는 `인`에만).
- **맨 IATA 코드**(항공화면의 `ICN`·`FUK`) 인식, `KOREA` 속 `KOR`은 제외.
- **여권 아닌 이미지의 날짜·노선 OCR**(kor+eng) → 손입력 없이 링크. ("메시지 캡처만 넣어도 됨")
- **인원수**: `N명` + 손글씨 번호 나열(`2,3,6번`=3명). 링크 성인 수 = **max(여권 수, 텍스트 인원)**.
- **서버 링크 인원 규칙**도 max로 통일(여권 몇 장 + "6명" → 6인).

### 탑승자 카드
- **눌러서 복사 칩** → **값 수정 가능(contenteditable) + `복사` 버튼**. 생년월일 `1960.03.15`,
  성별 `남성/여성` 표기. 여권 보고 확인·수정 후 복사.

---

## 6. 테스트 방법 (이 환경에서 검증한 방식)

- **파서 단위 테스트(node)**: `node -e '...require("./mrz.js")...'` — 실제 여권 2~3건 MRZ +
  오독/밀림/채움문자 케이스. `flightprep.js`는 `global.window={}` 후 require.
- **실제 tesseract OCR(오프라인)**: CDN(jsdelivr) 차단되므로 npm 로컬 설치로 검증.
  ```
  npm i tesseract.js@5 tesseract.js-core @tesseract.js-data/eng @tesseract.js-data/kor
  # createWorker('eng'|['kor','eng'], 1, { langPath: 로컬 4.0.0 폴더, gzip:true })
  ```
  Playwright 캔버스로 MRZ/인쇄영역/메시지 이미지를 렌더 → 로컬 tesseract로 OCR → 파서 검증.
  (chromium executablePath: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`)
- **브라우저 배선(Playwright)**: `flight.html` 로드 후 `window.FlightPrep.readPassports`/
  `analyzePaste`를 stub해 흐름(복사칩·링크·인원수·폴백) 검증. 실제 OCR은 CDN 필요라 stub.
- **서버(python)**: `pytest tests/`. 단, 이 샌드박스는 `cryptography`(profile.py) import가
  깨져서 `app.server` 전체 import는 실패 → 파서/딥링크는 `src`만 import해 테스트.
  `test_server_paste.py`의 8개 오류는 이 샌드박스 pytest fixture 문제(main에서도 동일), 무시.

---

## 7. 남은 작업 / 코드 검증에서 나온 미처리 항목

전체 코드 검증(강력 리뷰 모델)에서 **높음·중간은 이번에 수정**했고, 아래는 **미처리(주로 낮음
+ 중간 1건)**. 새 세션이 판단해 처리:

- **[중] 여정 2개 이상이면 탑승자 전원 미배정** (`flight.js` `$("go")` — `trips.length===1`
  조건). 텍스트로 여정을 만들면 서버가 여정별로 붙여준 탑승자 그룹이 폐기되고, 여정이 2개면
  아무 여정에도 안 붙어 전부 "여권 정보"로 떨어진다. → 서버가 그룹핑한 경우 그 그룹을 유지하고
  링크만 클라이언트로 재생성하는 경로 필요. (한 번에 두 여정 보내는 케이스는 드물어 이번엔 보류.)
- **[중~높] `betterPax`의 valid=이름 보증 오인** (`flightprep.js`). MRZ `valid`는 생년월일·
  만료일 체크디지트만 검증(이름·여권번호는 검증 안 됨)인데, dedup 병합 때 valid 판독본의
  (미세 오독일 수 있는) 이름을 권위값으로 유지. → 병합 시 이름 필드는 `nameLike`한 값을
  별도로 우선하는 개선 여지. (지금은 값 수정 기능 + per-field 비주얼 교정으로 완화됨.)
- **[낮] 생년 2자리 세기 경계**: `mrz.js toDate` — yy 00~26을 2000년대로 확정 → 1920~1926년생
  오독 가능(체크디지트 통과라 경고 없음). ICAO 슬라이딩 윈도우/만료일 힌트로 세기 보정 여지.
- **[낮] 만료 경고 기준 불일치**: 클라 `오늘+6개월` vs 서버 `귀국일+183일`. 여행일(귀국일)로 통일 권장.
- **[낮] `parseLine2` 성별창 `<` 허용 + 무제한 스캔**: 개인번호 구역의 가짜 블록을 이론상 선택 여지
  (실여권은 KOR·`<`채움으로 대부분 방어).
- **[낮] `cleanNamePart`(3연속 절단) vs `nameCorrupt`(4연속 플래그) 임계 비대칭**: 정확히 3연속
  채움오독이면 이름은 잘리는데 `suspect`가 안 켜져 비주얼 교정이 안 됨.
- **[낮] dedup 규칙 클라(4키) vs 서버(2키) 불일치**: 서버 경로에선 성 오독 동일인이 안 합쳐질 수
  있음. `_pax_key`도 클라 `paxKeys`처럼 다중 키로 맞추면 정합.
- **[정리] `mrz.js` `passOk`는 계산만 하고 안 쓰이는 죽은 값**(valid는 birth/expiry만 사용).

---

## 8. 배포 체크리스트 (반드시 지킬 것)

1. **JS/CSS 수정 시 다섯 HTML의 자산 버전(`?v=YYYYMMDD*`)을 함께 올린다** (Pages+모바일 캐시).
   현재 `v=20260707s` → 다음은 `t`.
   ```
   sed -i 's/v=20260707s/v=20260707t/g' index.html bus.html itinerary.html import.html flight.html
   ```
2. 개발 브랜치: `claude/travel-itinerary-page-cgb9ic`. main에 squash 병합.
   병합 후 브랜치가 옛 커밋 기반이면 `git fetch origin main && git rebase origin/main &&
   git push --force-with-lease`.
3. **Pages 배포 확인**: `actions_list`(branch:main, status:completed) 최신 run의 head_sha가
   방금 병합 커밋이고 `conclusion:success`인지. (출력이 커서 token 초과 → 파일로 저장됨 →
   `python3`로 head_sha/conclusion만 파싱.)
4. **dynamic Pages 워크플로는 rerun(재실행) 금지** — 영원히 queued로 남는다. 실패/지연 시
   다음 실제 변경 커밋으로 새 배포를 트리거.
5. flight_prep(서버)는 Render **자동 재배포**되지만, 안 되면 대시보드 Manual Deploy.
6. 커밋 메시지에 모델 식별자(claude-opus-4-8 등) 넣지 말 것. `feat:`/`fix:`/`style:` 스타일.

---

## 9. 용어

- **가이드 = 대장.** 화면 문구·호칭은 반드시 "대장(님)".
- 이 도구에서 "정밀 판독 서버" = flight_prep(Gemini) 서버.
