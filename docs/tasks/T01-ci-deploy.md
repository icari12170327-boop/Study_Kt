# T01 — CI와 GitHub Pages 자동 배포, 린트

- 상태: 준비됨
- 단계: 1.5
- 선행 작업: 없음
- 예상 분량: 반나절

## 목표
PR마다 타입 검사, 테스트, 빌드가 자동으로 돌고, `main`에 머지하면 GitHub Pages에 앱이 자동 배포되어 태블릿에서 주소로 접속하고 홈 화면에 설치할 수 있다.

## 배경
리뷰어(Claude Sonnet)가 PR의 품질을 판단하려면 CI 결과가 필요하다. 아이들이 실제로 쓰려면 배포 주소가 필요하다.

## 범위
**포함**
- `.github/workflows/ci.yml`: PR과 `main` push에서 `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build`
- `.github/workflows/deploy.yml`: `main` push에서 빌드 후 GitHub Pages 배포 (`actions/upload-pages-artifact`, `actions/deploy-pages`)
- 빌드 시 `BASE_PATH=/${{ github.event.repository.name }}/` 환경변수 지정 (`vite.config.ts`가 이미 읽음)
- ESLint(flat config, `typescript-eslint`, `eslint-plugin-react-hooks`) + Prettier 설정, `npm run lint`와 `npm run format` 스크립트
- 기존 코드가 린트를 통과하도록 최소 수정
- `README.md`에 배포 주소, Pages 설정 방법(Settings → Pages → Source: GitHub Actions), 태블릿 홈 화면 설치 방법

**제외**
- 기능 변경, 리팩터링
- 프리뷰 배포(PR별 주소)

## 설계
- Node 22 사용 (`actions/setup-node`, `cache: npm`).
- `index.html`의 `href="/icon.svg"`는 BASE_PATH 아래에서 깨질 수 있으니 `%BASE_URL%icon.svg` 또는 상대 경로로 바꾼다.
- `react-hooks/exhaustive-deps` 규칙: 세션 화면의 `useMemo(..., [round])`처럼 **의도적으로 한 번만 만드는 곳**은 규칙을 끄는 주석에 이유를 함께 적는다.
- `eslint-plugin-react-hooks` 최신 버전의 React Compiler 관련 규칙이 기존 코드와 충돌하면 `recommended` 수준만 켠다.

## 수용 기준
- [ ] PR을 열면 CI가 돌고, 실패하면 PR에 빨간불이 뜬다.
- [ ] `main`에 머지하면 `https://<계정>.github.io/<저장소>/`에서 앱이 열리고, 새로고침, 오프라인(PWA)에서도 동작한다.
- [ ] 배포된 앱에서 아이콘, manifest, service worker 경로가 404 없이 로드된다.
- [ ] `npm run lint`가 경고 0, 에러 0으로 통과한다.
- [ ] README에 설정과 설치 방법이 있다.
- [ ] `npm run typecheck && npm test && npm run build` 통과

## 테스트
- `BASE_PATH=/Study_Kt/ npm run build && npx vite preview`로 하위 경로 동작 확인
- Chrome 개발자 도구 Application 탭에서 manifest와 service worker 확인

## 리뷰 포인트
- workflow 권한이 최소한인지 (`contents: read`, 배포 job만 `pages: write`, `id-token: write`)
- 비공개 저장소면 Pages가 유료 플랜에서만 되므로 README에 안내가 있는지
