/* Web Audio engine: flute-like tone, metronome clicks, drone, and a beat scheduler. */
(function () {
  const F = (window.Flute = window.Flute || {});

  let ctx = null;
  let master = null;
  let noiseBuffer = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /** One flute-ish note: a few sine partials, delayed vibrato and a little breath noise. */
  function note(freq, t, dur, dest) {
    dur = Math.max(dur, 0.14);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.5, t + 0.04);
    env.gain.setValueAtTime(0.5, t + dur - 0.07);
    env.gain.linearRampToValueAtTime(0, t + dur);
    env.connect(dest || master);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.2;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.setValueAtTime(0, t + Math.min(0.18, dur / 2));
    depth.gain.linearRampToValueAtTime(1, t + Math.min(0.45, dur));
    lfo.connect(depth);
    lfo.start(t);
    lfo.stop(t + dur + 0.02);

    [[1, 1], [2, 0.26], [3, 0.08], [4, 0.025]].forEach(([h, amp]) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq * h;
      const vib = ctx.createGain();
      vib.gain.value = freq * h * 0.0035;
      depth.connect(vib);
      vib.connect(osc.frequency);
      const g = ctx.createGain();
      g.gain.value = amp;
      osc.connect(g);
      g.connect(env);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    });

    const breath = ctx.createBufferSource();
    breath.buffer = noiseBuffer;
    breath.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(freq * 2, 6000);
    bp.Q.value = 0.8;
    const bg = ctx.createGain();
    bg.gain.value = 0.05;
    breath.connect(bp);
    bp.connect(bg);
    bg.connect(env);
    breath.start(t, Math.random() * 0.5);
    breath.stop(t + dur + 0.02);
  }

  function click(t, accent, dest) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = accent ? 1600 : 1050;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(g);
    g.connect(dest || master);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  /* ---------- Drone ---------- */
  let drone = null;

  function stopDrone() {
    if (!drone) return;
    const d = drone;
    drone = null;
    const t = ctx.currentTime;
    d.gain.gain.cancelScheduledValues(t);
    d.gain.gain.setTargetAtTime(0, t, 0.08);
    setTimeout(() => d.oscs.forEach((o) => o.stop()), 500);
  }

  function startDrone(freq) {
    if (!ensure()) return;
    stopDrone();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.16, ctx.currentTime, 0.25);
    gain.connect(master);
    const oscs = [[1, 1, 'sine'], [2, 0.35, 'sine'], [3, 0.12, 'sine']].map(([h, amp, type]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq * h;
      const g = ctx.createGain();
      g.gain.value = amp;
      o.connect(g);
      g.connect(gain);
      o.start();
      return o;
    });
    drone = { gain, oscs };
  }

  /* ---------- Sequence player ---------- */
  let play = null;

  /**
   * opts: { freqs[], bpm(), metronome(), loop(), onStep(index|-1), onCount(n), onEnd() }
   * bpm/metronome/loop are functions so they can change while playing.
   */
  function start(opts) {
    if (!ensure()) return false;
    stop();
    const bus = ctx.createGain();
    bus.connect(master);
    const p = {
      bus,
      opts,
      idx: 0,
      countIn: opts.metronome() ? 4 : 0,
      nextTime: ctx.currentTime + 0.12,
      events: [],
      done: false,
    };
    p.timer = setInterval(() => pump(p), 25);
    p.raf = requestAnimationFrame(function frame() {
      if (play !== p) return;
      while (p.events.length && p.events[0].t <= ctx.currentTime) {
        const e = p.events.shift();
        if (e.type === 'step') opts.onStep(e.i);
        else if (e.type === 'count') opts.onCount(e.n);
        else if (e.type === 'end') {
          stop();
          opts.onEnd();
          return;
        }
      }
      p.raf = requestAnimationFrame(frame);
    });
    play = p;
    pump(p);
    return true;
  }

  function pump(p) {
    const o = p.opts;
    while (!p.done && p.nextTime < ctx.currentTime + 0.15) {
      const beat = 60 / o.bpm();
      const t = p.nextTime;
      if (p.countIn > 0) {
        click(t, true, p.bus);
        p.events.push({ t, type: 'count', n: p.countIn });
        p.countIn--;
        p.nextTime += beat;
        continue;
      }
      const last = p.idx === o.freqs.length - 1;
      const beats = last ? 2 : 1;
      note(o.freqs[p.idx], t, beat * beats * 0.94, p.bus);
      if (o.metronome()) {
        click(t, false, p.bus);
        if (last) click(t + beat, false, p.bus);
      }
      p.events.push({ t, type: 'step', i: p.idx });
      p.nextTime += beat * beats;
      if (last) {
        if (o.loop()) p.idx = 0;
        else {
          p.done = true;
          p.events.push({ t: p.nextTime, type: 'end' });
        }
      } else p.idx++;
    }
  }

  function stop() {
    if (!play) return;
    const p = play;
    play = null;
    clearInterval(p.timer);
    cancelAnimationFrame(p.raf);
    const t = ctx.currentTime;
    p.bus.gain.setTargetAtTime(0, t, 0.02);
    setTimeout(() => p.bus.disconnect(), 300);
  }

  function single(freq, dur) {
    if (!ensure()) return;
    note(freq, ctx.currentTime + 0.02, dur || 0.9);
  }

  F.audio = {
    ensure,
    start,
    stop,
    single,
    startDrone,
    stopDrone,
    isPlaying: () => !!play,
    context: () => ctx,
  };
})();
