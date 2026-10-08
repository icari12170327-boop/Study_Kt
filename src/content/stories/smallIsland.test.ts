import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SMALL_ISLAND } from './smallIsland';
import type { StoryEpisode, StoryQuestion } from './types';

const manuscript = readFileSync(new URL('../../../docs/stories/small-island.md', import.meta.url), 'utf8');

/** 데이터 생성과 별도로 원고를 줄마다 읽어 빈 줄의 문단 경계도 비교한다. */
function readManuscript(): StoryEpisode[] {
  const episodes: StoryEpisode[] = [];
  let episode: StoryEpisode | undefined, question: StoryQuestion | undefined;
  let quiz = false, paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) episode?.paragraphs.push(paragraph.join('\n'));
    paragraph = [];
  };
  for (const line of manuscript.split('\n')) {
    const heading = line.match(/^## (\d+)화\. (.+)$/);
    if (heading) {
      flush();
      episode = { n: Number(heading[1]), title: heading[2], paragraphs: [], questions: [], teaser: '' };
      episodes.push(episode); quiz = false; question = undefined;
    } else if (!episode || line === '---') continue;
    else if (line === '**문제**') { flush(); quiz = true; }
    else if (line.startsWith('**다음 ')) {
      episode.teaser = line.slice(line.indexOf('**: ') + 4);
    } else if (quiz) {
      const header = line.match(/^[1-3]\. \((내용 확인|추론|낱말 뜻)\) (.+) — 근거 문단: (\d+)$/);
      if (header) {
        question = { type: header[1] === '내용 확인' ? 'fact' : header[1] === '추론' ? 'infer' : 'vocab',
          q: header[2], choices: [], answer: -1, paragraph: Number(header[3]) - 1, explain: '' };
        episode.questions.push(question);
      } else if (question && line.startsWith('   - 해설: ')) question.explain = line.slice('   - 해설: '.length);
      else if (question && line.startsWith('   - ')) {
        let choice = line.slice('   - '.length);
        if (choice.startsWith('✅ ')) { question.answer = question.choices.length; choice = choice.slice(2); }
        question.choices.push(choice);
      }
    } else if (!line) flush();
    else paragraph.push(line);
  }
  flush(); return episodes;
}

describe('승인 원고와 데이터의 글자 일치', () => {
  it('보호자 승인 상태와 이야기 id·제목·대상을 확인한다', () => {
    expect(manuscript).toMatch(/^- 상태: \*\*보호자 승인[^\n]*\*\*$/m);
    expect(manuscript).toContain(`이야기 id: \`${SMALL_ISLAND.id}\``);
    expect(SMALL_ISLAND.title).toBe('작은 섬으로 이사 온 날');
    expect(SMALL_ISLAND.level).toBe('g3');
  });
  it('10화 60문단·30문제·보기·해설·예고가 원고와 한 글자도 다르지 않다', () => {
    const original = readManuscript();
    expect(SMALL_ISLAND.episodes).toHaveLength(10);
    expect(original.flatMap(e => e.paragraphs)).toHaveLength(60);
    expect(SMALL_ISLAND.episodes).toEqual(original);
  });
  it.each(SMALL_ISLAND.episodes)('$n화의 문제 종류·정답·근거 문단이 유효하며 그림은 없다', episode => {
    expect(episode.questions).toHaveLength(3);
    expect(episode.questions.map(q => q.type)).toEqual(['fact', 'infer', 'vocab']);
    expect(episode.image).toBeUndefined();
    for (const q of episode.questions) {
      expect(q.choices).toHaveLength(4);
      expect(Number.isInteger(q.answer)).toBe(true); expect(q.answer).toBeGreaterThanOrEqual(0); expect(q.answer).toBeLessThan(4);
      expect(Number.isInteger(q.paragraph)).toBe(true); expect(q.paragraph).toBeGreaterThanOrEqual(0); expect(q.paragraph).toBeLessThan(episode.paragraphs.length);
      expect(q.choices.join('')).not.toContain('✅');
    }
  });
});
