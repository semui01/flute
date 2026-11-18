/* UI: state, rendering, and wiring between theory, fingerings, audio and tuner. */
(function () {
  const { theory, fingerings, glyphs, diagram, audio, tuner } = window.Flute;
  const $ = (id) => document.getElementById(id);

  const STORE = 'flute-scale-studio';
  const state = {
    pc: 0,
    tonality: 'major',
    mode: 'scale',
    octaves: 1,
    bpm: 80,
    metronome: true,
    loop: false,
    drone: false,
    alt: {}, // preferred alternate fingering per pitch class
    chartReg: 0, // register shown in the fingering chart
  };
  try {
    Object.assign(state, JSON.parse(localStorage.getItem(STORE) || '{}'), { drone: false });
  } catch (e) {}
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify(state));
    } catch (e) {}
  }

  let key, seq;
  let current = 0;
  const hits = new Set();

  const MODE_BLURB = {
    scale: 'All seven notes of the key, up and back down',
    pentatonic: 'Five notes of the key, with no half steps',
    arpeggio: 'The chord tones: degrees 1, 3 and 5',
  };

  /* ---------- Fingering lookup ---------- */
  function fingeringFor(midi) {
    const opts = fingerings.options(midi);
    const i = Math.min(state.alt[midi % 12] || 0, opts.length - 1);
    return { opts, i, f: opts[i] };
  }

  /* ---------- Fingering chart ---------- */
  const LETTERS = 'CDEFGAB';
  const ACC_SIGN = { '-1': '♭', 0: '', 1: '♯' };
  // How each pitch class is written in the chart: [letter index, accidental], plus its other name.
  const CHART_SPELL = [[0, 0], [0, 1], [1, 0], [2, -1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [6, -1], [6, 0]];
  const ENHARMONIC = { 1: 'D♭', 3: 'D♯', 6: 'G♭', 8: 'A♭', 10: 'A♯' };
  const REGISTERS = [
    [60, 71],
    [72, 83],
    [84, 96],
  ];

  function chartNote(midi) {
    const pc = midi % 12;
    const [letter, acc] = CHART_SPELL[pc];
    const octave = Math.floor(midi / 12) - 1;
    return { midi, acc, octave, pos: (octave - 4) * 7 + letter - 2, name: LETTERS[letter] + ACC_SIGN[acc], other: ENHARMONIC[pc] };
  }

  /** A small treble staff holding one whole note. lo/hi are the staff steps the drawing must cover. */
  function miniStaff(n, lo, hi) {
    const step = 3;
    const pad = 3;
    const w = 52;
    const nx = 38;
    const y = (pos) => (hi - pos) * step + pad;
    const h = (hi - lo) * step + pad * 2;
    const k = (2 * step) / 250; // glyph units per staff space
    const ny = y(n.pos);
    let s = `<svg class="mini-staff" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">`;
    for (let l = 0; l <= 8; l += 2) s += `<line class="line" x1="0" x2="${w}" y1="${y(l)}" y2="${y(l)}"/>`;
    for (let p = -2; p >= n.pos; p -= 2) s += `<line class="line" x1="${nx - 7}" x2="${nx + 7}" y1="${y(p)}" y2="${y(p)}"/>`;
    for (let p = 10; p <= n.pos; p += 2) s += `<line class="line" x1="${nx - 7}" x2="${nx + 7}" y1="${y(p)}" y2="${y(p)}"/>`;
    s += `<use href="#g-clef" class="ink" transform="translate(1 ${y(0)}) scale(${k} ${-k})"/>`;
    if (n.acc > 0) s += `<use href="#g-sharp" class="ink" transform="translate(${nx - 13} ${ny + 3.1}) scale(${k} ${-k})"/>`;
    if (n.acc < 0) s += `<use href="#g-flat" class="ink" transform="translate(${nx - 12} ${ny + 2.4}) scale(${k} ${-k})"/>`;
    s += `<ellipse class="ink" cx="${nx}" cy="${ny}" rx="4.3" ry="3"/>`;
    s += `<ellipse class="whole-in" cx="${nx}" cy="${ny}" rx="2.1" ry="1.6" transform="rotate(-40 ${nx} ${ny})"/>`;
    return s + '</svg>';
  }

  function renderChart() {
    const [a, b] = REGISTERS[state.chartReg] || REGISTERS[0];
    const notes = [];
    for (let m = a; m <= b; m++) notes.push(chartNote(m));
    const lo = Math.min(-3.6, Math.min.apply(null, notes.map((n) => n.pos)) - 1.5);
    const hi = Math.max(11.1, Math.max.apply(null, notes.map((n) => n.pos)) + 1.5);
    $('chartGrid').innerHTML = notes
      .map((n) => {
        const opts = fingerings.options(n.midi);
        const flutes = opts
          .map((o) => {
            const d = fingerings.describe(o.keys);
            const name = opts.length > 1 ? `<span class="fc-opt-name">${o.label}</span>` : '';
            const label = (opts.length > 1 ? o.label + ': ' : '') + 'left hand ' + d.left + '; right hand ' + d.right;
            return `<span class="fc-opt">${name}${diagram.flute(o.keys, { compact: true, label })}</span>`;
          })
          .join('');
        const other = n.other ? `<span class="fc-other">${n.other}<sub>${n.octave}</sub></span>` : '';
        return (
          `<button type="button" class="fc" data-midi="${n.midi}">` +
          `<span class="fc-note">${miniStaff(n, lo, hi)}<span class="fc-name">${n.name}<sub>${n.octave}</sub></span>${other}</span>` +
          `<span class="fc-opts">${flutes}</span></button>`
        );
      })
      .join('');
    document.querySelectorAll('[data-reg]').forEach((btn) => btn.setAttribute('aria-pressed', +btn.dataset.reg === state.chartReg));
  }

  function miniDots(k) {
    const xs = [3, 9, 15, 22, 28, 34];
    const vals = [k.L1, k.L2, k.L3, k.R1, k.R2, k.R3];
    return (
      '<svg viewBox="0 0 37 6" width="30" height="5" aria-hidden="true">' +
      xs.map((x, i) => `<circle class="${vals[i] ? 'dot-on' : 'dot-off'}" cx="${x}" cy="3" r="2.1"/>`).join('') +
      '</svg>'
    );
  }

  /* ---------- Staff ---------- */
  const SIG_POS = { sharp: [8, 5, 9, 6, 3, 7, 4], flat: [4, 7, 3, 6, 2, 5, 1] };

  function staffSvg() {
    const maxPos = Math.max.apply(null, seq.map((n) => n.pos));
    const y0 = Math.max(62, maxPos * 5 + 16);
    const y = (pos) => y0 - pos * 5;
    const nSig = Math.abs(key.sig);
    const sigX = 40;
    const firstX = sigX + nSig * 10 + 26;
    const gap = 36;
    const width = firstX + seq.length * gap;
    const height = y0 + 44;
    const glyph = (name, x, yy) => `<path class="ink" transform="translate(${x} ${yy}) scale(0.04 -0.04)" d="${glyphs[name]}"/>`;

    let out = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${key.title} ${state.mode} on the staff">`;
    let notes = '';
    seq.forEach((n, i) => {
      const x = firstX + i * gap;
      const yy = y(n.pos);
      let g = `<g class="n" data-i="${i}"><rect class="band" x="${x - 15}" y="2" width="30" height="${height - 4}" rx="8"/>`;
      for (let p = -2; p >= n.pos; p -= 2) g += `<line class="line" x1="${x - 10}" x2="${x + 10}" y1="${y(p)}" y2="${y(p)}"/>`;
      for (let p = 10; p <= n.pos; p += 2) g += `<line class="line" x1="${x - 10}" x2="${x + 10}" y1="${y(p)}" y2="${y(p)}"/>`;
      g += `<ellipse class="ink" cx="${x}" cy="${yy}" rx="6.3" ry="4.4" transform="rotate(-20 ${x} ${yy})"/>`;
      g += n.pos < 4
        ? `<line class="stem" x1="${x + 5.7}" x2="${x + 5.7}" y1="${yy - 1.5}" y2="${yy - 33}"/>`
        : `<line class="stem" x1="${x - 5.7}" x2="${x - 5.7}" y1="${yy + 1.5}" y2="${yy + 33}"/>`;
      g += `<text class="lbl" x="${x}" y="${height - 8}">${n.name}</text></g>`;
      notes += g;
    });
    out += notes;
    for (let l = 0; l < 5; l++) out += `<line class="line" x1="0" x2="${width}" y1="${y(l * 2)}" y2="${y(l * 2)}"/>`;
    out += `<line class="line" x1="0.5" x2="0.5" y1="${y(8)}" y2="${y0}"/>`;
    out += `<line class="line" x1="${width - 5}" x2="${width - 5}" y1="${y(8)}" y2="${y0}"/>`;
    out += `<rect class="ink" x="${width - 3}" y="${y(8)}" width="3" height="40"/>`;
    out += glyph('clef', 6, y0);
    const kind = key.sig > 0 ? 'sharp' : 'flat';
    for (let i = 0; i < nSig; i++) out += glyph(kind, sigX + i * 10 - 2, y(SIG_POS[kind][i]) + 5);
    return out + '</svg>';
  }

  /* ---------- Rendering ---------- */
  function rebuild() {
    audio.stop();
    setPlayingUi(false);
    key = theory.keyInfo(state.pc, state.tonality);
    seq = theory.buildSequence(key, state.mode, state.octaves);
    current = 0;
    hits.clear();

    $('keyTitle').textContent = key.title;
    document.title = key.title + ' · Flute Scale Studio';
    $('sigMain').textContent = key.sigText;
    $('sigSub').textContent =
      (key.sigNotes ? key.sigNotes + ' · ' : '') + 'Relative ' + (state.tonality === 'major' ? 'minor' : 'major') + ': ' + key.relative;
    $('droneSub').textContent = 'Holds ' + key.name + ' to play in tune against';
    $('modeBlurb').textContent = MODE_BLURB[state.mode];
    $('octBtn').textContent = state.octaves === 1 ? '1 octave' : '2 octaves';
    $('metBtn').setAttribute('aria-pressed', state.metronome);
    $('loopBtn').setAttribute('aria-pressed', state.loop);
    $('bpmOut').textContent = state.bpm + ' BPM';

    document.querySelectorAll('[data-tonality]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tonality === state.tonality));
    document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === state.mode));

    $('keyGrid').innerHTML = theory.TONICS[state.tonality]
      .map((n, pc) => `<button type="button" data-pc="${pc}" aria-pressed="${pc === state.pc}">${theory.pretty(n)}</button>`)
      .join('');

    renderChips();
    $('staff').innerHTML = staffSvg();
    $('staffScroll').scrollLeft = 0;
    renderCurrent();
    if (state.drone) audio.startDrone(theory.midiToFreq(key.tonicMidi - 12));
    save();
  }

  function renderChips() {
    const row = (dir, label) =>
      `<p class="dir">${label}</p><div class="chip-row">` +
      seq
        .map((n, i) =>
          n.dir !== dir
            ? ''
            : `<button type="button" class="chip${n.degree === 0 ? ' tonic' : ''}" data-i="${i}" aria-label="${n.name}${n.octave}">` +
              `<span>${n.name}</span>${miniDots(fingeringFor(n.midi).f.keys)}</button>`
        )
        .join('') +
      '</div>';
    $('chips').innerHTML = row('up', 'Going up') + row('down', 'Coming down');
  }

  function renderCurrent() {
    const n = seq[current];
    const { opts, i, f } = fingeringFor(n.midi);
    $('degreeLabel').textContent = 'Degree ' + n.roman + ' · octave ' + n.octave;
    $('noteName').textContent = n.name;
    const d = fingerings.describe(f.keys);
    $('fluteDiagram').innerHTML = diagram.flute(f.keys, {
      label: 'Fingering for ' + n.name + n.octave + ': left hand ' + d.left + '; right hand ' + d.right,
    });
    $('leftText').textContent = d.left;
    $('rightText').textContent = d.right;
    $('tipText').textContent = fingerings.tip(n.midi);
    $('stepCount').textContent = current + 1 + ' / ' + seq.length;
    const alt = $('altBtn');
    alt.hidden = opts.length < 2;
    if (opts.length > 1) alt.textContent = '↻ ' + f.label + ' ' + (i + 1) + '/' + opts.length;

    document.querySelectorAll('.chip').forEach((c) => {
      const idx = +c.dataset.i;
      c.classList.toggle('current', idx === current);
      c.classList.toggle('hit', hits.has(idx));
    });
    const scroller = $('staffScroll');
    document.querySelectorAll('#staff .n').forEach((g) => {
      const is = +g.dataset.i === current;
      g.classList.toggle('current', is);
      if (is) {
        const x = g.querySelector('.band').x.baseVal.value;
        const target = x - scroller.clientWidth / 2 + 15;
        if (x < scroller.scrollLeft + 40 || x > scroller.scrollLeft + scroller.clientWidth - 70) {
          scroller.scrollTo({ left: Math.max(0, target), behavior: audio.isPlaying() ? 'auto' : 'smooth' });
        }
      }
    });
  }

  function go(i, sound) {
    current = (i + seq.length) % seq.length;
    renderCurrent();
    if (sound && !audio.isPlaying()) audio.single(theory.midiToFreq(seq[current].midi), 0.8);
  }

  /* ---------- Playback ---------- */
  function setPlayingUi(on, label) {
    $('playIcon').setAttribute('d', on ? 'M7 7h10v10H7z' : 'M8 5.5v13l11-6.5z');
    $('playLabel').textContent = label || (on ? 'Stop' : 'Play');
    $('playBtn').setAttribute('aria-label', on ? 'Stop' : 'Play');
  }

  function togglePlay() {
    if (audio.isPlaying()) {
      audio.stop();
      setPlayingUi(false);
      return;
    }
    const ok = audio.start({
      freqs: seq.map((n) => theory.midiToFreq(n.midi)),
      bpm: () => state.bpm,
      metronome: () => state.metronome,
      loop: () => state.loop,
      onCount: (n) => setPlayingUi(true, String(n)),
      onStep: (i) => {
        setPlayingUi(true);
        current = i;
        renderCurrent();
      },
      onEnd: () => {
        setPlayingUi(false);
        go(0);
      },
    });
    if (ok) setPlayingUi(true);
  }

  /* ---------- Tuner ---------- */
  const PC_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  let heldSince = 0;
  let quietSince = 0;

  function onPitch(freq) {
    const dot = $('meterDot');
    const now = performance.now();
    if (!freq) {
      heldSince = 0;
      if (!quietSince) quietSince = now;
      if (now - quietSince > 400) {
        dot.className = 'meter-dot';
        dot.style.left = '50%';
        $('tunerRead').textContent = 'Play ' + seq[current].name + seq[current].octave;
      }
      return;
    }
    quietSince = 0;
    const n = seq[current];
    const cents = 1200 * Math.log2(freq / theory.midiToFreq(n.midi));
    const shown = Math.max(-50, Math.min(50, cents));
    dot.style.left = 50 + shown * 0.9 + '%';
    const good = Math.abs(cents) <= 12;
    dot.className = 'meter-dot live' + (good ? ' good' : '');
    const read = $('tunerRead');
    if (Math.abs(cents) > 50) {
      const heard = Math.round(69 + 12 * Math.log2(freq / 440));
      read.textContent =
        heard === n.midi
          ? 'Nearly ' + n.name + ', keep adjusting'
          : 'Hearing ' + PC_NAMES[((heard % 12) + 12) % 12] + (Math.floor(heard / 12) - 1) + '. Aim for ' + n.name + n.octave;
    } else if (good) read.textContent = 'In tune';
    else if (cents < 0) read.textContent = Math.round(-cents) + ' cents flat. Speed up the air or roll out a little';
    else read.textContent = Math.round(cents) + ' cents sharp. Aim the air lower or roll in a little';

    if (Math.abs(cents) < 35 && !audio.isPlaying()) {
      if (!heldSince) heldSince = now;
      else if (now - heldSince > 350) {
        heldSince = 0;
        hits.add(current);
        if (current === seq.length - 1) {
          renderCurrent();
          read.textContent = 'Pattern complete';
        } else go(current + 1);
      }
    } else heldSince = 0;
  }

  async function toggleMic() {
    const btn = $('micBtn');
    if (tuner.isOn()) {
      tuner.stop();
      btn.setAttribute('aria-checked', 'false');
      $('tuner').hidden = true;
      return;
    }
    try {
      await tuner.start(onPitch);
      btn.setAttribute('aria-checked', 'true');
      $('tuner').hidden = false;
      hits.clear();
      renderCurrent();
    } catch (e) {
      $('tunerSub').textContent =
        e && e.message === 'unsupported'
          ? 'The microphone is not available in this view. Open the app in a regular browser tab.'
          : 'Microphone access was blocked. Allow it for this site, or open the app in a regular browser tab.';
    }
  }

  /* ---------- Events ---------- */
  function set(patch) {
    Object.assign(state, patch);
    rebuild();
  }

  document.querySelectorAll('[data-tonality]').forEach((b) => b.addEventListener('click', () => set({ tonality: b.dataset.tonality })));
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => set({ mode: b.dataset.mode })));
  $('keyGrid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pc]');
    if (b) set({ pc: +b.dataset.pc });
  });
  $('chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (b) go(+b.dataset.i, true);
  });
  $('staff').addEventListener('click', (e) => {
    const g = e.target.closest('[data-i]');
    if (g) go(+g.dataset.i, true);
  });
  $('playBtn').addEventListener('click', togglePlay);
  $('octBtn').addEventListener('click', () => set({ octaves: state.octaves === 1 ? 2 : 1 }));
  $('metBtn').addEventListener('click', () => {
    state.metronome = !state.metronome;
    $('metBtn').setAttribute('aria-pressed', state.metronome);
    save();
  });
  $('loopBtn').addEventListener('click', () => {
    state.loop = !state.loop;
    $('loopBtn').setAttribute('aria-pressed', state.loop);
    save();
  });
  function bpm(delta) {
    state.bpm = Math.max(40, Math.min(208, state.bpm + delta));
    $('bpmOut').textContent = state.bpm + ' BPM';
    save();
  }
  $('bpmDown').addEventListener('click', () => bpm(-4));
  $('bpmUp').addEventListener('click', () => bpm(4));
  $('droneBtn').addEventListener('click', () => {
    state.drone = !state.drone;
    $('droneBtn').setAttribute('aria-checked', state.drone);
    if (state.drone) audio.startDrone(theory.midiToFreq(key.tonicMidi - 12));
    else audio.stopDrone();
  });
  $('altBtn').addEventListener('click', () => {
    const n = seq[current];
    const count = fingerings.options(n.midi).length;
    state.alt[n.midi % 12] = ((state.alt[n.midi % 12] || 0) + 1) % count;
    save();
    renderChips();
    renderCurrent();
  });
  $('hearBtn').addEventListener('click', () => audio.single(theory.midiToFreq(seq[current].midi), 1.2));
  $('prevBtn').addEventListener('click', () => go(current - 1, true));
  $('nextBtn').addEventListener('click', () => go(current + 1, true));
  $('micBtn').addEventListener('click', toggleMic);
  document.querySelectorAll('[data-reg]').forEach((b) =>
    b.addEventListener('click', () => {
      state.chartReg = +b.dataset.reg;
      save();
      renderChart();
    })
  );
  $('chartGrid').addEventListener('click', (e) => {
    const card = e.target.closest('.fc');
    if (!card) return;
    audio.single(theory.midiToFreq(+card.dataset.midi), 1);
    card.classList.remove('ringing');
    void card.offsetWidth; // restart the flash
    card.classList.add('ringing');
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.code === 'Space') {
      if (e.target.closest('button')) return; // the button's own click handles it
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'ArrowRight') go(current + 1, true);
    else if (e.code === 'ArrowLeft') go(current - 1, true);
  });

  rebuild();
  renderChart();
})();
