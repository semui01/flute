/* UI: state, rendering, and wiring between theory, fingerings, audio and tuner. */
(function () {
  const { theory, fingerings, glyphs, audio, tuner } = window.Flute;
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

  /* ---------- Flute diagram ---------- */
  function fluteSvg(k) {
    const on = (v) => (v ? ' on' : '');
    const hole = (x, v, n) =>
      `<circle class="key${on(v)}" cx="${x}" cy="63" r="10.5"/><text class="num${on(v)}" x="${x}" y="66.8">${n}</text>`;
    const pill = (x, y, w, h, v) =>
      `<rect class="key${on(v)}" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${h / 2}"/>`;
    const arm = (x, y1, y2) => `<line class="arm" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>`;
    const cap = (x, y, t) => `<text class="cap" x="${x}" y="${y}">${t}</text>`;
    const trill = (x, v) =>
      arm(x, 48, 51) + `<ellipse class="key${on(v)}" cx="${x}" cy="42" rx="4.2" ry="6.2"/>` + cap(x, 31, 'tr');
    const bracket = (x1, x2, t) =>
      `<path class="bracket" d="M${x1} 121v4H${x2}v-4"/><text class="group" x="${(x1 + x2) / 2}" y="135">${t}</text>`;
    return `<svg viewBox="0 22 340 116" role="img" aria-label="Flute fingering diagram">
      <defs><linearGradient id="tubeGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style="stop-color:var(--silver-2)"/><stop offset="0.35" style="stop-color:var(--silver-1)"/>
        <stop offset="1" style="stop-color:var(--silver-2)"/></linearGradient></defs>
      <rect class="tube" x="6" y="50" width="328" height="26" rx="6" fill="url(#tubeGrad)"/>
      <rect class="ring" x="46" y="48.5" width="3" height="29" rx="1"/>
      <rect class="ring" x="262" y="48.5" width="3" height="29" rx="1"/>
      <ellipse class="key" cx="25" cy="63" rx="12" ry="9.5"/><ellipse class="hole" cx="25" cy="63" rx="4.5" ry="3.2"/>
      ${arm(78, 76, 88)}${arm(60, 76, 91)}${arm(152, 76, 89)}
      ${pill(60, 96, 15, 10, k.Tb)}${cap(60, 114, 'B♭')}
      <circle class="key${on(k.T)}" cx="78" cy="97" r="9"/><text class="num${on(k.T)}" x="78" y="100.8">T</text>
      ${hole(78, k.L1, 1)}${hole(104, k.L2, 2)}${hole(130, k.L3, 3)}
      ${pill(152, 95, 20, 11, k.Gs)}${cap(152, 114, 'G♯')}
      ${arm(168, 47, 51)}${pill(168, 42, 13, 9, k.lev)}${cap(168, 31, 'B♭')}
      ${hole(186, k.R1, 1)}${trill(199, k.tr1)}${hole(212, k.R2, 2)}${trill(225, k.tr2)}${hole(238, k.R3, 3)}
      ${arm(282, 76, 89)}${arm(302, 76, 89)}${arm(320, 76, 89)}
      ${pill(282, 95, 17, 12, k.Eb)}${cap(282, 114, 'E♭')}
      ${pill(302, 95, 15, 12, k.Cs)}${cap(302, 114, 'C♯')}
      ${pill(320, 95, 15, 12, k.C)}${cap(320, 114, 'C')}
      ${bracket(50, 164, 'LEFT HAND')}${bracket(172, 250, 'RIGHT HAND')}${bracket(270, 330, 'PINKY')}
    </svg>`;
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
    $('fluteDiagram').innerHTML = fluteSvg(f.keys);
    const d = fingerings.describe(f.keys);
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
})();
