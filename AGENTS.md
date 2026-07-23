# AGENTS.md — 어느 에이전트로 열든 먼저 읽으세요

이 저장소는 **숲길따라 감성여행** 정적 도구 모음(버스 좌석표 / 바이브 일정 / 이미지로 일정 /
바이브 항공권 예약)입니다. GitHub Pages로 `bus.foresttour.kr`에 배포됩니다.

## 시작 순서 (필수)
Antigravity·Cursor·기타 에이전트는 `CLAUDE.md`를 자동 로드하지 않습니다. 아래 순서로 읽으세요:
1. **`CLAUDE.md`** — 프로젝트 규칙·구조·파서 학습 기록·배포 체크리스트·용어("가이드=대장").
2. **`LOG.md`의 맨 아래 최신 "세션 핸드오프" 블록** — 마지막 세션이 한 일·배포 상태·미결·함정.
3. 항공권(여권 판독) 작업이면 **`docs/flight-tool-handoff.md`** — 엔진 상세·미처리 항목·테스트법.

## 핵심 사실 (요약)
- **빌드 없음.** 순수 HTML/CSS/JS. main에 push하면 GitHub Pages가 자동 배포.
- **JS/CSS 수정 시 다섯 HTML의 `?v=YYYYMMDD*` 자산 버전을 반드시 함께 올릴 것** (캐시).
  현재 `v=20260707s`.
- **항공권 서버는 별도 저장소** `6soo/flight_prep`(Python/FastAPI, Gemini 비전, Render 배포).
- 화면 문구·호칭은 언제나 **"대장(님)"**.

## Antigravity 등에서 이 세션과 동등한 MCP 설정

이 세션(Claude)이 실제로 쓴 MCP:
- **GitHub MCP** — PR 생성/병합, Actions(Pages 배포) 상태 확인. **이 프로젝트 작업의 핵심.**
- **claude-code-remote** — `send_later`로 배포 성공 자동 확인(스케줄링). Claude 전용, 이전 불가.
- (연결돼 있었으나 이 프로젝트엔 미사용: Gmail·Google Drive·Google Calendar·Figma.)

**Antigravity 설정 위치/형식**
- 설정 파일: `~/.gemini/antigravity/mcp_config.json` — 또는 IDE 에이전트 패널의
  **"···" → MCP Servers → View raw config**.
- 형식(예):
  ```jsonc
  {
    "mcpServers": {
      "github": {                       // 로컬 실행형
        "command": "npx",
        "args": ["-y", "@github/github-mcp-server"],
        "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<PAT>" }
      }
      // 원격형은 { "serverUrl": "...", "headers": { "Authorization": "Bearer ..." } } 형태
    }
  }
  ```

**동등 서버 후보 & 인증 계정**
- **GitHub** → 공식 `github/github-mcp-server`. `6soo` 계정(또는 이 저장소 write 권한 계정)의
  PAT/OAuth로 인증. 이게 있어야 PR·배포확인을 에이전트가 직접 함.
- **Gmail·Drive·Calendar**(이 프로젝트엔 불필요하나, 메일/문서 작업 확장 시) → 구글 공식
  **Google Workspace MCP** 또는 `aaronsb/google-workspace-mcp`. **사장님 업무 구글 계정**으로 OAuth.
- **설정 안 하면**: 코드 작업·로컬 테스트·수동 git push는 되지만, **PR/배포확인·메일/드라이브는
  수동**입니다. (이 프로젝트는 GitHub만 있으면 충분. 산출물은 전부 이 저장소 안 — 별도 초안 없음.)

## 에이전트 간 차이 (넘어가지 않는 것)
- **Claude 전용 기능은 다른 에이전트로 이전되지 않습니다**: 서브에이전트 위임(예: 코드 리뷰를
  opus에 위임), `send_later` 자동 배포확인, Skill 등. 동일 결과가 필요하면 각 에이전트의
  방식(수동 리뷰, 자체 스케줄러 등)으로 대체하세요.
- MCP 서버 자체는 표준(JSON-RPC)이라 위 설정으로 GitHub 등은 동등 동작합니다.

## git 규칙
- 개발은 브랜치에서 → main에 **squash 병합**(PR). `flight_prep`은 **main 직접 push 금지**(브랜치+PR).
- squash 병합 특성상 브랜치 병합 여부는 `git diff origin/main origin/<br>`(내용 0) 또는
  `git cherry`(`-`)로 판정.
