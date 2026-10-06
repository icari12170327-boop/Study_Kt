# 개발 흐름 — 기획 · 구현 · 리뷰 분업

| 역할 | 담당 | 하는 일 | 산출물 |
|---|---|---|---|
| 기획 | Claude Opus (Claude Code) | 요구사항 정리, 우선순위, 작업 명세서 작성, 리뷰 결과를 보고 다음 작업 조정 | `docs/PLAN.md`, `docs/tasks/Txx-*.md` |
| 구현 | Codex | 명세서 하나를 받아 구현, 테스트, PR 생성 | 브랜치 `feat/Txx-*`, PR |
| 리뷰 | Claude Sonnet (Claude Code) | PR을 `docs/REVIEW.md` 기준으로 리뷰하고 승인 또는 수정 요청 | PR 리뷰 코멘트 |
| 최종 결정 | 보호자(나) | 머지, 실제 사용 피드백, 우선순위 변경 | 머지, 이슈 |

## 한 작업의 생애
```
[기획] docs/tasks/Txx 작성, 상태: 준비됨
   │
   ▼
[구현] Codex에게 지시:
       "AGENTS.md 규칙대로 docs/tasks/Txx-....md 를 구현하고 PR을 올려줘"
   │   상태: 진행 중
   ▼
[리뷰] Claude Code(Sonnet)에게 지시:
       "PR #n 을 docs/REVIEW.md 기준으로 리뷰해줘"
   │   ├─ 수정 요청 → Codex에게 "PR #n 리뷰 코멘트 반영해줘"
   │   └─ 승인
   ▼
[머지] 보호자가 머지, 아이들과 써 보기
   │
   ▼
[기획] 사용 피드백으로 명세나 백로그 갱신, 상태: 완료
```

## 원칙
- **명세서 하나 = PR 하나.** 크면 기획 단계에서 쪼갠다(반나절~하루 분량).
- **수용 기준이 계약이다.** 구현은 수용 기준을 모두 채우고, 리뷰는 수용 기준을 하나씩 확인한다.
- 리뷰에서 나온 **범위 밖 제안**은 그 PR에서 고치지 않고 `docs/tasks/README.md` 백로그로 보낸다.
- 실제로 써 본 아이들 반응(지루해함, 어려워함, 좋아함)이 가장 중요한 입력이다. 기획 세션을 시작할 때 이것부터 적는다.

## 각 도구에 줄 지시 예시

**Codex (구현)**
```
AGENTS.md를 먼저 읽고, docs/tasks/T01-ci-deploy.md 명세를 구현해줘.
수용 기준을 모두 만족하고 npm run typecheck && npm test && npm run build 가 통과하면
feat/T01-ci-deploy 브랜치로 PR을 올려줘.
```

**Claude Code (리뷰, Sonnet)**
```
PR #3 을 리뷰해줘. 기준은 docs/REVIEW.md 이고, 명세는 docs/tasks/T01-ci-deploy.md 야.
```

**Claude Code (기획, Opus)**
```
이번 주에 아이들이 써 본 결과: 둘째가 나눗셈을 어려워하고, 첫째는 말하기를 건너뛰려고 함.
docs/PLAN.md 와 docs/tasks 를 보고 다음 작업 우선순위를 조정해줘.
```
