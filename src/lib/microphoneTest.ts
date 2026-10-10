/** 음량만 표본으로 읽고 오디오 파일·녹취는 만들지 않는다. 늦은 권한 응답도 정리한다. */
export function startMicrophoneTest(onVolume: (level: number) => void): { done: Promise<void>; stop: () => void } {
  let stopped = false, sampled = false, frame = 0, timeout: ReturnType<typeof setTimeout> | undefined;
  let stream: MediaStream | undefined, context: AudioContext | undefined, source: MediaStreamAudioSourceNode | undefined;
  let resolveDone!: () => void, rejectDone!: (error: unknown) => void;
  const done = new Promise<void>((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });
  const closeTracks = (audio: MediaStream) => audio.getTracks().forEach(track => { try { track.stop(); } catch { /* 나머지 트랙도 닫는다. */ } });
  const finish = (error?: unknown) => {
    if (stopped) return;
    stopped = true; cancelAnimationFrame(frame); clearTimeout(timeout);
    if (stream) { closeTracks(stream); stream = undefined; }
    try { source?.disconnect(); } catch { /* 이미 끊어진 연결도 종료 알림을 막지 않는다. */ }
    source = undefined;
    const audio = context; context = undefined;
    try { if (audio && audio.state !== 'closed') void audio.close().catch(() => {}); } catch { /* 오디오 API 실패와 관계없이 종료를 알린다. */ }
    if (error !== undefined) rejectDone(error); else resolveDone();
  };
  try {
    // iOS에서도 사용자 클릭의 실행 중에 오디오 컨텍스트를 만들고 재개한다.
    context = new AudioContext();
    const resumed = context.resume();
    void resumed.catch(finish);
    const acquired = navigator.mediaDevices.getUserMedia({ audio: true }).then(received => {
      if (stopped) { closeTracks(received); return; }
      stream = received;
      // 재개가 끝나지 않아도 마이크를 연 뒤 3초 안에 자원을 정리한다.
      timeout = setTimeout(() => finish(sampled ? undefined : new Error('audio-timeout')), 3000);
    });
    void Promise.all([resumed, acquired]).then(() => {
      if (stopped || !context || !stream) return;
      const analyser = context.createAnalyser(); analyser.fftSize = 256;
      source = context.createMediaStreamSource(stream); source.connect(analyser);
      const buffer = new Uint8Array(analyser.fftSize);
      const sample = () => {
        if (stopped) return;
        try {
          analyser.getByteTimeDomainData(buffer);
          const rms = Math.sqrt(buffer.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / buffer.length);
          sampled = true; onVolume(Math.min(1, rms * 4)); frame = requestAnimationFrame(sample);
        } catch (error) { finish(error); }
      };
      sample();
    }).catch(finish);
  } catch (error) { finish(error); }
  return { done, stop: () => finish() };
}
