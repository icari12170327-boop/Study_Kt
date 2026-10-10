/** 음량만 표본으로 읽고 오디오 파일·녹취는 만들지 않는다. 늦은 권한 응답도 정리한다. */
export function startMicrophoneTest(onVolume: (level: number) => void): { done: Promise<void>; stop: () => void } {
  let stopped = false, frame = 0, timeout: ReturnType<typeof setTimeout> | undefined;
  let stream: MediaStream | undefined, context: AudioContext | undefined, source: MediaStreamAudioSourceNode | undefined;
  let finish: (() => void) | undefined;
  const stop = () => {
    stopped = true; cancelAnimationFrame(frame); clearTimeout(timeout);
    stream?.getTracks().forEach(track => track.stop()); stream = undefined;
    source?.disconnect(); source = undefined;
    const audio = context; context = undefined;
    if (audio && audio.state !== 'closed') void audio.close().catch(() => {});
    finish?.();
  };
  const done = (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (stopped) return;
      context = new AudioContext(); await context.resume();
      if (stopped) return;
      const analyser = context.createAnalyser(); analyser.fftSize = 256;
      source = context.createMediaStreamSource(stream); source.connect(analyser);
      const buffer = new Uint8Array(analyser.fftSize);
      await new Promise<void>(resolve => {
        finish = resolve;
        const sample = () => {
          if (stopped) return;
          analyser.getByteTimeDomainData(buffer);
          const rms = Math.sqrt(buffer.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / buffer.length);
          onVolume(Math.min(1, rms * 4)); frame = requestAnimationFrame(sample);
        };
        sample(); timeout = setTimeout(stop, 3000);
      });
    } finally { stop(); }
  })();
  return { done, stop };
}
