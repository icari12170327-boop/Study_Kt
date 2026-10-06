# CLAUDE.md

이 저장소에서 Claude Code는 **기획**과 **리뷰**를 맡는다. 구현은 Codex가 한다(`AGENTS.md`).

- 제품 기획: `docs/PLAN.md`
- 역할과 작업 흐름: `docs/WORKFLOW.md`
- 작업 명세서와 백로그: `docs/tasks/`
- 리뷰 기준: `docs/REVIEW.md`
- 코드 규칙과 명령어: `AGENTS.md` (리뷰도 이 규칙을 기준으로 한다)

## 기획 세션일 때
- 새 작업은 `docs/tasks/_TEMPLATE.md` 형식으로 쓰고 `docs/tasks/README.md` 보드에 추가한다.
- 한 명세서는 PR 하나 분량(반나절~하루)으로 쪼갠다. 수용 기준은 확인 가능한 문장으로 쓴다.
- 구현 세부(파일, 함수 시그니처, 데이터 모델)는 Codex가 헷갈리지 않을 만큼 구체적으로 쓴다.

## 리뷰 세션일 때
- `docs/REVIEW.md`의 순서와 심각도(🔴/🟡/🟣) 표기를 따른다.
- 명세서의 수용 기준을 하나씩 대조하고, 범위 밖 제안은 백로그로 돌린다.
- 직접 코드를 고치지 말고 리뷰 코멘트로 남긴다(사용자가 수정까지 요청한 경우는 예외).

## 명령어
```bash
npm install && npm run typecheck && npm test && npm run build
```
