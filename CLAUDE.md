# XR Apple 10 — Project Context

갤럭시 XR(Android XR) 대상, WebXR 기반 "사과 게임". GitHub Pages 배포.
전체 기획은 `GAME_DESIGN.md` 참고.

## Stack (build-less 원칙)

- **Runtime only, no build step.** 순수 ES Modules + Import Maps (CDN).
- `three` 및 `three/addons/*`은 `esm.sh` 또는 `jsdelivr`에서 import map으로 해결.
- `package.json`, `node_modules`, 번들러(Vite/webpack 등) 사용 금지.
- 이유: GitHub Pages 정적 호스팅이면 충분하고, 토큰·시간·유지보수 비용이 전부 줄어듦.

## Directory Layout

```
xr-test/
├─ index.html            # 엔트리, import map, XR 버튼
├─ src/
│  ├─ main.js            # 부트스트랩
│  ├─ xr/                # WebXR 세션/플레인/핸드/앵커
│  ├─ game/              # 사과/스포너/올가미/점수/오디오
│  └─ ui/                # HUD
├─ assets/               # models(.glb, Draco), sounds, textures
└─ .github/workflows/pages.yml
```

파일 하나의 책임은 이름에서 드러나게. 새 파일 추가 전 기존 파일에 맞는지 먼저 검토.

## Conventions

- **언어**: 사용자와 한국어 대화. 코드 주석은 꼭 필요한 "왜"만 한 줄로, 영어.
- **모듈**: ESM only. `import` 상대경로는 `.js` 확장자 명시 (브라우저 ESM 요구사항).
- **Three.js import**: 항상 `import * as THREE from 'three'` / `from 'three/addons/...'` — import map이 해결.
- **좌표계/단위**: 미터. Y-up.
- **XR 세션**: `immersive-ar`, 필수 feature: `hit-test`, `plane-detection`, `hand-tracking`. 선택 feature는 `optionalFeatures`로.
- **Fallback**: 미지원 기능은 조용히 건너뛰고 게임은 계속. `console.warn` 한 줄로 기록.
- **실험 로그**: 디버그 HUD는 `?debug=1` 쿼리로만 활성화.

## Dev / Serve

WebXR은 HTTPS 또는 localhost 필요.

- 로컬: `python3 -m http.server 8000` 후 `http://localhost:8000`
- 실기기 테스트: GitHub Pages 배포(자동 HTTPS) 또는 `ngrok http 8000`

## Deploy

`main` 브랜치 push → `.github/workflows/pages.yml` 이 Pages에 그대로 업로드.
빌드 스텝 없음 — 파일이 곧 배포물.

## Token/Context Optimization Rules (for Claude)

작업 시 지켜야 할 것:

1. **전체 디렉토리 덤프 금지.** 필요한 파일만 Read. `ls -la` 반복 호출 금지.
2. **에셋 파일(.glb/.png/.mp3) 읽지 말 것.** 바이너리. 경로와 용도만 참조.
3. **CDN lib 내부 코드 탐색 금지.** 필요한 API는 Three.js 공식 문서 지식으로 처리. 모르면 WebFetch 한 번.
4. **파일당 한 가지 책임** — 300줄 넘어가면 분할 검토.
5. **새 의존성 추가 전 먼저 질문** — import map 추가는 신중히 (CDN 실패 시 앱 전체가 죽음).
6. **한 응답 내 여러 독립 작업은 병렬 tool call로.**

## Task Phases

`GAME_DESIGN.md` §8 로드맵 참조: P0 → P7. 현재 단계: **P0 시작 전**.
