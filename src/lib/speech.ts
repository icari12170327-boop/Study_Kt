/** 브라우저 내장 음성 합성(TTS)과 음성 인식(Web Speech API) 래퍼 */

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const prefix = lang.split('-')[0];
  return (
    voices.find((v) => v.lang === lang && /google|samantha|natural/i.test(v.name)) ??
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.startsWith(prefix))
  );
}

export function speak(text: string, opts: { lang?: string; rate?: number } = {}): Promise<void> {
  if (!canSpeak()) return Promise.resolve();
  const lang = opts.lang ?? 'en-US';
  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = opts.rate ?? 0.9;
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => RecognitionLike;

function getRecognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function canRecognize(): boolean {
  return getRecognitionCtor() !== undefined;
}

export interface ListenHandle {
  promise: Promise<string[]>;
  stop: () => void;
}

/** 한 번 듣고 인식 후보 문장 목록을 돌려준다. */
export function listenOnce(lang = 'en-US'): ListenHandle {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return { promise: Promise.reject(new Error('unsupported')), stop: () => {} };
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = 5;
  rec.continuous = false;
  const promise = new Promise<string[]>((resolve, reject) => {
    let done = false;
    rec.onresult = (e) => {
      done = true;
      const first = e.results[0];
      const alts: string[] = [];
      for (let i = 0; i < first.length; i++) alts.push(first[i].transcript);
      resolve(alts);
    };
    rec.onerror = (e) => {
      done = true;
      reject(new Error(e.error));
    };
    rec.onend = () => {
      if (!done) resolve([]);
    };
  });
  rec.start();
  return { promise, stop: () => rec.stop() };
}
