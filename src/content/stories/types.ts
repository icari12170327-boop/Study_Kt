export interface StoryQuestion {
  type: 'fact' | 'infer' | 'vocab';
  q: string;
  choices: string[];
  answer: number;
  /** 원고의 근거 문단 번호에서 1을 뺀 인덱스. */
  paragraph: number;
  explain: string;
}
export interface StoryEpisode {
  n: number;
  title: string;
  paragraphs: string[];
  image?: string;
  questions: StoryQuestion[];
  teaser: string;
}
export interface Story {
  id: string;
  title: string;
  level: 'g3' | 'g5';
  episodes: StoryEpisode[];
}
export interface StoryProgress {
  unlocked: number;
  finished: number;
  /** 새 화를 열거나 현재 화를 처음 완주한 날. 늦게 완주해도 다음 날을 기다린다. */
  lastUnlockDate?: string;
  /** 키는 화 번호:문제 인덱스, 값은 재도전을 포함한 정오답 이력. */
  answers: Record<string, boolean[]>;
}
