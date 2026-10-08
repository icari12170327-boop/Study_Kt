import { STORIES } from '../../content/stories';
import { answerKey, answerRate, initialStoryProgress, openNext, QUESTION_TYPE_LABEL } from '../../content/stories/progress';
import { useStore } from '../../store/StoreContext';
import type { ProfileId } from '../../types';
import { useStoryDate } from './useStoryDate';

export function StoryOverview({ profileId }: { profileId: ProfileId }) {
  const { state, update } = useStore();
  const today = useStoryDate();
  return <section className="story-overview">
    <h3>📖 이야기 · 자유 놀이</h3>
    {STORIES.map(story => {
      const progress = state.data[profileId].stories?.[story.id] ?? initialStoryProgress();
      return <div key={story.id}>
        <h4>{story.title}</h4><p>읽기 완료 {progress.finished} / {story.episodes.length}화 · 열린 화 {progress.unlocked}화</p>
        <details><summary>문제별 정답률 · 재도전 포함</summary>
          <table className="story-stats"><caption>{story.title} 문제별 기록</caption><thead><tr><th scope="col">문제</th><th scope="col">정답 / 시도</th><th scope="col">정답률</th></tr></thead>
            <tbody>{story.episodes.flatMap(episode => episode.questions.map((q, i) => {
              const rate = answerRate(progress.answers[answerKey(episode.n, i)] ?? []);
              return <tr key={answerKey(episode.n, i)}><th scope="row">{episode.n}화 {i + 1}번 · {QUESTION_TYPE_LABEL[q.type]}</th><td>{rate.correct} / {rate.total}</td><td>{rate.total ? `${rate.percent}%` : '—'}</td></tr>;
            }))}</tbody>
          </table>
        </details>
        <button className="btn btn-soft" disabled={progress.unlocked >= story.episodes.length} onClick={() => {
          if (!confirm(`「${story.title}」의 다음 화를 오늘 미리 열까요?`)) return;
          update(draft => {
            const records = draft.data[profileId].stories ??= {};
            records[story.id] = openNext(records[story.id] ?? initialStoryProgress(), today, story.episodes.length, true);
          });
        }}>다음 화 미리 열기</button>
        <p className="small muted">보호자는 문제를 다 풀기 전에도 한 화씩 미리 열 수 있어요.</p>
      </div>;
    })}
  </section>;
}
