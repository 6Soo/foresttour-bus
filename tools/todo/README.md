# 여행 업무 보드 로컬 Gemini 브리지

`todo.html`은 정적 GitHub Pages 화면이라 Gemini API 키를 브라우저에 넣지 않습니다.
휴대폰은 reserve의 HTTPS Gemini 분석 경로를 우선 사용하고, 데스크톱 개발 환경에서는
로컬 브리지가 보조로 캡처를 받아 저장소의 기존 키 로더를 사용합니다.

## 실행

WSL 기준으로 `foresttour-bus`에서 실행합니다.

```bash
node tools/todo/gemini-capture-bridge.mjs
```

`foresttour` 저장소가 형제 폴더가 아니면 경로만 지정합니다.

```bash
FORESTTOUR_ROOT=/경로/foresttour node tools/todo/gemini-capture-bridge.mjs
```

브리지는 `127.0.0.1:8765`에서만 듣습니다. 따라서 휴대폰에서는 이 주소를 사용하지 않고
reserve HTTPS 경로를 사용합니다. 캡처 원본은 파일이나 DB에 저장하지 않고, Gemini 응답에서
업무 제목·메시지 시각·여행 분류만 반환합니다.

키는 `foresttour/tools/gemini-config.mjs`가 읽는 기존 방식(`GEMINI_API_KEY`,
`GOOGLE_API_KEY`, 저장소 루트 `.env.local`/`.env`)을 그대로 사용합니다.
