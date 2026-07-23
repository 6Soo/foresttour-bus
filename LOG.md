# LOG — 세션 핸드오프 기록

> 새 세션/에이전트(Claude, Antigravity, 기타)는 **`AGENTS.md` → `CLAUDE.md` → 이 파일의
> 맨 아래 최신 핸드오프 블록** 순으로 읽고 시작하세요. 항공권 도구 상세는
> `docs/flight-tool-handoff.md`.

---

## 2026-07-23 세션 핸드오프 — 항공권(여권 판독) 엔진 집중

### 이번 세션에 한 일 (파일·결정 단위)
- **`mrz.js` 신설**: 여권 MRZ(TD3) 파서 + 인쇄영역 파서. 체크디지트 검증, 성별 기준 블록
  탐색(밀림에 견고), 이름 채움문자(`<`→글자) 정리, KOR 앵커, 이름 오염 개별 판정
  (`surnameSuspect`/`givenSuspect`), 인쇄영역 폴백(`parseVisualPassport`)에서 한글 병기 라벨
  누출 방지. **순수 함수 → node로 단위 테스트.**
- **`flightprep.js`**: `readPassports`(tesseract 판독 → 중복제거 → 여권 아닌 이미지 kor+eng
  OCR로 날짜·노선 텍스트 추출), 공항 사전에 일본 지방공항 20곳 추가, 노선 방향 규칙
  (국외=도착·한국=출발, 없으면 ICN), 맨 IATA 코드 인식, 인원수(N명/번호나열), 다중키 dedup.
- **`flight.js`**: **서버(Gemini) 우선 → tesseract 폴백** 흐름, 붙여넣기 텍스트/이미지OCR→링크,
  탑승자 **수정 가능 복사칩**, 화면 전환.
- **`flight.html`/`flight.css`**: 문구(폰 내 판독/정밀 판독 서버), 복사칩 스타일, `mrz.js` 로드.
- **서버 저장소 `6soo/flight_prep`**: 공항 사전·인원수·노선 방향·링크 인원(max) 규칙을
  클라이언트와 1:1로 맞춤(PR #1~#7). vision 프롬프트 확장(카톡/메모도 전사).
- **전체 코드 검증(강력 리뷰 모델 위임)** 후 실사용 버그 수정: 비주얼 파서 한글라벨 누출,
  노선 방향 역전(`후쿠오카 인천공항 집결`), `괌` 조사 미검출, 서버 링크 인원 max 통일.
- **문서**: `docs/flight-tool-handoff.md`(항공권 엔진 상세), `CLAUDE.md`(구조표+버전),
  이 `LOG.md`, `AGENTS.md`.

### 현재 배포/런타임 상태
- **클라이언트(foresttour-bus)**: GitHub **Pages**(dynamic 워크플로) → **bus.foresttour.kr**,
  소스 브랜치 **main**. 마지막 코드 배포 커밋 `53f1d2b`(success), 이후 문서 커밋 `e66dfa8`.
  **자산 버전 `v=20260707s`**(다섯 HTML: index/bus/itinerary/import/flight). CNAME 파일 있음.
- **서버(flight_prep)**: **Render**(Docker Blueprint, `render.yaml`), 소스 브랜치 **main**,
  자동 재배포. **무료 플랜 → 첫 접속 ~30초 콜드스타트**. 필요한 시크릿(Render 대시보드 입력):
  `GEMINI_API_KEY`(구글 AI 스튜디오 무료 키), `APP_PASSWORD`, `APP_USERNAME=admin`,
  `FLIGHT_PREP_REQUIRE_AUTH=1`, `FLIGHT_PREP_CORS_ORIGINS`(예: `https://bus.foresttour.kr`).
- **클라↔서버 연결**: `flight.js` 기본 서버 URL `https://flight.foresttour.kr`(DNS 미연결일 수
  있음 — Render 기본주소를 화면 **⚙️ 정밀 판독 서버 설정**에서 넣고 비밀번호 저장하면 그걸 씀).
- **정적 사이트**라 런타임 DB·크론 없음. 세션 자동 점검엔 claude-code-remote `send_later`
  (Pages 배포 성공 확인)만 사용 — Claude 전용, 다른 에이전트로 안 넘어감.

### 미결 · 다음 할 일 (바로 이어받을 수 있게)
1. **[사장님/사용자 액션] Gemini 정밀 판독 서버 실제 배포·연결** — 정확도의 근본 해법.
   Render에 flight_prep 배포 + 시크릿 설정 → 화면 ⚙️에서 서버주소·비밀번호 입력. 안 하면
   tesseract(폰 내 OCR)로 동작하나 이름·날짜에 미세 오류가 남(그래서 값 수정 기능 있음).
2. **[중] 여정 2개 이상일 때 탑승자 전원 미배정** (`flight.js` `$("go")`의 `trips.length===1`
   조건). 서버가 여정별로 붙여준 탑승자 그룹을 유지하도록 개선 필요.
3. **[중~높] `betterPax`의 valid=이름 보증 오인** (`flightprep.js`): MRZ valid는 생년/만료
   체크디지트만 검증. 병합 시 이름은 `nameLike`한 값을 별도 우선하는 개선 여지.
4. **[낮] 생년 2자리 세기 경계**(`mrz.js toDate`, 1920~26년생 오독), **만료 경고 기준**(클라
   오늘+6개월 vs 서버 귀국일+183일 통일), **dedup 클라(4키)/서버(2키) 불일치**, `passOk`
   죽은 값 정리 — `docs/flight-tool-handoff.md §7` 참조.
5. **[별개 저장소, 미병합]** `foresttour-bus` 원격 브랜치
   **`claude/bus-seating-diagram-check-ylbsym`** 에 **main에 없는 고유 커밋 1개**
   (`8e59ed0 fix: correct 24/28-seat Coaster layout and add guide seat visual distinction`,
   2026-06-30) 존재. 버스 좌석표(Coaster 24/28인승 배치 + 가이드석 구분) 수정이 **미병합**.
   단, 그 브랜치는 main보다 **89커밋 뒤처져** 있어 그대로 merge 금지 → 필요하면 이 커밋의
   **의도만 최신 `script.js`/`styles.css`에 재이식**할 것. (버스 도구 담당 세션이 판단.)

### 이번 세션에 발견한 함정 · 비자명한 사실
- **tesseract는 여권 정확도에 한계.** `<` 채움문자가 L·K로 읽혀 이름이 깨지고, 날짜 한 자리
  오독(25→13)이 남. 근본 해결은 Gemini(서버). tesseract 패치로 100% 좇지 말 것.
- **날짜는 여권·가격비교 화면 어디에도 없다.** `9.23~27 후쿠오카` 같은 **날짜 메시지/캡처가
  입력에 반드시 있어야** 링크가 나옴. 이번에 "여권 아닌 이미지도 OCR(kor+eng)"로 이 문제 완화.
- **squash 병합은 브랜치에 고유 SHA를 남긴다** → `rev-list --count`만 보면 병합됐어도 0이 아님.
  병합 판정은 **`git diff origin/main origin/<br>`(내용 0)** 또는 **`git cherry`(`-`)** 로 할 것.
- **GitHub Pages dynamic 워크플로는 rerun 금지**(영원히 queued). 실패/지연 시 다음 커밋으로
  새 배포 트리거. 배포 확인은 `actions_list`(branch:main, status:completed) head_sha 대조.
- `actions_list` 출력이 커서 tool이 token 초과 → 파일로 저장됨 → `python3`로 필드만 파싱.
- **개발 환경 프록시가 jsdelivr(CDN) 차단** → tesseract OCR 테스트는 npm 로컬 설치로 검증
  (`@tesseract.js-data/eng|kor` + `tesseract.js-core`, `langPath` 로컬 지정). 실서비스 브라우저는 정상.
- **flight_prep pytest**: 이 샌드박스에선 `cryptography`(profile.py) import가 깨져 `app.server`
  전체 import 실패 → 파서/딥링크는 `src`만 import해 테스트. `test_server_paste.py` 8개 오류는
  샌드박스 fixture 문제(main에서도 동일), 무시.
- **flight_prep main 직접 push 금지**(분류기 차단) → 반드시 브랜치+PR.

### 새 컨테이너 / 에이전트 부트스트랩 체크리스트
git에 없어 다시 세워야 하는 것 (작업 성격별):
- **코드/파서만 만질 때**: 추가 세팅 불필요. `node`로 `mrz.js`/`flightprep.js`(`global.window={}`
  후 require) 단위 테스트 가능.
- **OCR E2E 테스트할 때**: `npm i tesseract.js@5 tesseract.js-core @tesseract.js-data/eng
  @tesseract.js-data/kor` (모두 `.gitignore`됨). Chromium: `/opt/pw-browsers/chromium-1194/
  chrome-linux/chrome`. (Claude 환경 기준 — 다른 환경은 Playwright/Chromium 별도 설치.)
- **서버(flight_prep) 돌릴 때**: Python + FastAPI + google-genai. `.env`/Render 시크릿
  (`GEMINI_API_KEY` 등, git에 없음). 로컬 실행은 `uvicorn`.
- **배포**: GitHub Pages는 main push 시 자동. Render는 flight_prep main push 시 자동(시크릿은
  Render 대시보드에만 있음, git에 없음).
- **인증/커넥터**: GitHub 접근(PR·Actions)은 이 세션에선 MCP로 했음. 다른 에이전트는
  `AGENTS.md`의 "MCP 동등 설정" 참조. Gemini 키는 사장님 구글 계정 소유.
- **Claude 전용 기능 미이전**: 서브에이전트 위임(Agent tool, opus 코드리뷰), `send_later`
  자동 배포확인 등은 Antigravity/타 에이전트로 넘어가지 않음 — 수동/각 에이전트 방식으로 대체.
