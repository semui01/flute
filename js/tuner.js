/* Microphone pitch detection (normalised autocorrelation). */
(function () {
  const F = (window.Flute = window.Flute || {});

  /** Returns the fundamental in Hz, or null when the buffer is too quiet or unpitched. */
  function detectPitch(buf, sampleRate) {
    const n = buf.length;
    let rms = 0;
    for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / n);
    if (rms < 0.012) return null;

    const minLag = Math.floor(sampleRate / 2400); // above the flute's top C
    const maxLag = Math.min(Math.floor(sampleRate / 220), n >> 1); // below low C
    const size = n - maxLag;
    const corr = new Float32Array(maxLag + 2);
    let best = -1;
    let bestLag = -1;
    for (let lag = minLag; lag <= maxLag + 1; lag++) {
      let sum = 0;
      let e1 = 0;
      let e2 = 0;
      for (let i = 0; i < size; i++) {
        const a = buf[i];
        const b = buf[i + lag];
        sum += a * b;
        e1 += a * a;
        e2 += b * b;
      }
      corr[lag] = sum / (Math.sqrt(e1 * e2) || 1);
    }
    // Take the first strong peak so we lock to the fundamental, not a sub-harmonic.
    for (let lag = minLag + 1; lag <= maxLag; lag++) {
      if (corr[lag] > corr[lag - 1] && corr[lag] >= corr[lag + 1]) {
        if (corr[lag] > 0.9) {
          bestLag = lag;
          best = corr[lag];
          break;
        }
        if (corr[lag] > best) {
          best = corr[lag];
          bestLag = lag;
        }
      }
    }
    if (bestLag < 0 || best < 0.8) return null;
    const a = corr[bestLag - 1];
    const b = corr[bestLag];
    const c = corr[bestLag + 1];
    const denom = a - 2 * b + c;
    const shift = denom ? (0.5 * (a - c)) / denom : 0;
    return sampleRate / (bestLag + shift);
  }

  let stream = null;
  let raf = 0;

  async function start(onPitch) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('unsupported');
    const ctx = F.audio.ensure();
    if (!ctx) throw new Error('unsupported');
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    (function loop() {
      analyser.getFloatTimeDomainData(buf);
      onPitch(detectPitch(buf, ctx.sampleRate));
      raf = requestAnimationFrame(loop);
    })();
  }

  function stop() {
    cancelAnimationFrame(raf);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  F.tuner = { start, stop, detectPitch, isOn: () => !!stream };
})();
