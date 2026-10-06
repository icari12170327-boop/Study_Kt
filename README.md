# 🦉 우리 가족 학습 스테이션 (Study_Kt)

첫째(초5), 둘째(초3), 그리고 나(보호자)가 **한 기기에서 프로필만 바꿔** 매일 15~20분씩 공부하는 웹앱(PWA)입니다.
미션을 모두 끝내면 "유튜브 30분 이용권" 같은 보상 쿠폰을 받습니다.

## 앞으로 (기획서 v2)
영어는 단어 시험 대신 **AI 친구와 음성 프리토킹**(OpenAI Realtime `gpt-realtime-2.1-mini`)으로 바꾸고, 적응형 수학 도전, 두뇌 퍼즐, 오늘의 문제 게임과 형제 대결, 과학 실험 카드, 국어 연재 이야기를 차례로 붙인다. 순서는 [작업 보드](docs/tasks/README.md).

## 지금 되는 것 (1단계 MVP)
| 기능 | 내용 |
|---|---|
| 🔢 연산 | 3학년, 5학년 교과 단원별 문제 자동 생성 (세 자리 덧뺄셈, 곱셈, 나눗셈, 혼합 계산, 약수와 배수, 분수, 소수, 어림, 평균). 틀린 문제는 오답노트로 가서 다음에 다시 나옴 |
| 🔤 영어 단어 | 초3, 초5, 비즈니스·AI 표현 단어장. 듣기(TTS), 뜻 고르기, 영어 고르기. Leitner 간격 반복 |
| 🗣️ 따라 말하기 | 문장 듣고 따라 말하면 음성 인식으로 단어별 채점 (Chrome 권장). 아이는 생활 영어, 보호자는 비즈니스 회화 |
| 📚 독서노트 | 요약과 질문/답 카드 작성, 간격 반복 복습 |
| 🎁 보상 | 별, 연속 학습일, 2주 도장 달력, 하루 미션 완료 쿠폰 (보호자 PIN으로 사용 처리) |
| 🔒 보호자 모드 | 아이별 7일 현황, 단원별 정답률, 오답노트, 미션과 단원 설정, 쿠폰 관리, 백업과 복원 |

기록은 이 기기의 브라우저(localStorage)에만 저장됩니다. 보호자 모드에서 주기적으로 백업하세요.

## 실행
```bash
npm ci
npm run dev        # http://localhost:5173
npm run lint       # 경고 없이 린트 통과
npm run typecheck  # TypeScript 타입 검사
npm test           # 단위 테스트
npm run build      # 프로덕션 빌드 (dist/)
npm run format     # Prettier로 파일 포맷 정리
```

## GitHub Pages 배포

배포 주소: [https://icari12170327-boop.github.io/Study_Kt/](https://icari12170327-boop.github.io/Study_Kt/)

1. 저장소 **Settings → Pages → Build and deployment → Source**에서 **GitHub Actions**를 선택합니다.
2. **Settings → Actions → General**에서 GitHub Actions 실행이 허용되어 있는지 확인합니다.
3. PR을 열면 CI가 린트, 타입 검사, 테스트, 빌드를 실행합니다. 실패한 검사는 PR에 표시됩니다.
4. PR을 `main`에 머지하면 배포 워크플로가 같은 검사를 통과한 뒤 `dist/`를 Pages에 배포합니다. **Actions → GitHub Pages 배포**에서 결과와 배포 주소를 확인합니다. 첫 배포가 성공한 뒤 위 주소로 접속할 수 있습니다.

GitHub Free에서는 공개 저장소만 Pages를 사용할 수 있습니다. 비공개 저장소는 GitHub Pro, Team 또는 Enterprise 등 Pages를 지원하는 유료 플랜이 필요합니다.

CI와 배포는 Node 22를 사용하며, `BASE_PATH=/Study_Kt/`로 하위 경로를 빌드합니다. 로컬에서 같은 경로를 확인하려면:

```bash
BASE_PATH=/Study_Kt/ npm run build
BASE_PATH=/Study_Kt/ npm run preview
# http://localhost:4173/Study_Kt/ 접속
```

Chrome 개발자 도구 **Application**에서 Manifest와 Service Workers를 확인합니다. 첫 접속 후 서비스 워커가 준비되면 비행기 모드로 바꾸고 새로고침해 오프라인 동작도 확인할 수 있습니다. 음성 인식은 브라우저와 네트워크 상태에 따라 오프라인에서 제한될 수 있습니다.

## 태블릿 홈 화면에 설치

- **Galaxy Fold4·Android 태블릿(Chrome)**: 배포 주소에 접속하고 메뉴 **⋮ → 홈 화면에 추가 → 설치**(또는 **앱 설치**)를 선택합니다. DeX에서도 Chrome으로 같은 주소를 열 수 있습니다.
- **iPad(Safari)**: 배포 주소에 접속하고 **공유 → 홈 화면에 추가 → 추가**를 선택합니다.

처음에는 인터넷에 연결해 앱을 열어 주세요. 이후 홈 화면 아이콘으로 실행하면 설치된 앱처럼 사용할 수 있습니다. 기록은 기기와 브라우저별로 저장되므로 다른 기기로 옮길 때는 보호자 모드의 백업·복원을 사용하세요.

## 문서
- [기획서](docs/PLAN.md): 목표, 학습 설계, 동기부여, 로드맵
- [개발 흐름](docs/WORKFLOW.md): 기획(Claude Opus) → 구현(Codex) → 리뷰(Claude Sonnet)
- [작업 보드](docs/tasks/README.md): 다음에 구현할 작업 명세서 (T01~)
- [AGENTS.md](AGENTS.md): 구현 에이전트 규칙 · [리뷰 기준](docs/REVIEW.md)
