/* Music theory helpers: keys, note spelling, practice sequences. */
(function () {
  const F = (window.Flute = window.Flute || {});

  const LETTERS = 'CDEFGAB';
  const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11];
  const ACC_SIGN = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

  const TONICS = {
    major: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
    minor: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'],
  };

  // Number of sharps (+) or flats (-) for each major key.
  const MAJOR_SIG = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6 };
  const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
  const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

  const SCALE = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
  };
  // Scale degrees (0-based) used by each practice mode.
  const MODE_DEGREES = {
    scale: { major: [0, 1, 2, 3, 4, 5, 6], minor: [0, 1, 2, 3, 4, 5, 6] },
    pentatonic: { major: [0, 1, 2, 4, 5], minor: [0, 2, 3, 4, 6] },
    arpeggio: { major: [0, 2, 4], minor: [0, 2, 4] },
  };

  function parseName(name) {
    const letter = LETTERS.indexOf(name[0]);
    const acc = name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0;
    return { letter, acc, pc: (NATURAL_PC[letter] + acc + 12) % 12 };
  }

  function pretty(name) {
    return name.replace('#', '♯').replace('b', '♭');
  }

  /** Spell the note `semis` above the tonic as scale degree `degree` (0-based). */
  function spell(tonic, tonicMidi, degree, semis) {
    const letter = (tonic.letter + degree) % 7;
    const midi = tonicMidi + semis;
    let acc = (((midi % 12) - NATURAL_PC[letter]) % 12 + 12) % 12;
    if (acc > 6) acc -= 12;
    const naturalMidi = midi - acc;
    const octave = Math.floor(naturalMidi / 12) - 1;
    return {
      midi,
      letter,
      acc,
      octave,
      name: LETTERS[letter] + ACC_SIGN[acc],
      // Staff position in diatonic steps above the bottom line (E4 = 0).
      pos: (octave - 4) * 7 + letter - 2,
      degree,
      roman: ROMAN[degree],
    };
  }

  function keyInfo(pc, tonality) {
    const raw = TONICS[tonality][pc];
    const tonic = parseName(raw);
    const tonicMidi = 60 + pc; // tonic always sits in C4..B4, the flute's bottom octave
    let sig, relative;
    if (tonality === 'major') {
      sig = MAJOR_SIG[raw];
      relative = spell(tonic, tonicMidi, 5, 9).name + ' minor';
    } else {
      const rel = spell(tonic, tonicMidi, 2, 3);
      sig = MAJOR_SIG[LETTERS[rel.letter] + (rel.acc === 1 ? '#' : rel.acc === -1 ? 'b' : '')];
      relative = rel.name + ' major';
    }
    const order = sig >= 0 ? SHARP_ORDER : FLAT_ORDER;
    const altered = order.slice(0, Math.abs(sig));
    const sign = sig >= 0 ? '♯' : '♭';
    let sigText = 'No sharps or flats';
    if (sig !== 0) {
      const n = Math.abs(sig);
      sigText = n + ' ' + (sig > 0 ? 'sharp' : 'flat') + (n > 1 ? 's' : '');
    }
    return {
      pc,
      tonality,
      tonic,
      tonicMidi,
      name: pretty(raw),
      title: pretty(raw) + (tonality === 'major' ? ' major' : ' minor'),
      sig,
      sigText,
      sigNotes: altered.map((l) => l + sign).join(' '),
      relative,
    };
  }

  /** Build the up-and-down practice sequence for a key. */
  function buildSequence(key, mode, octaves) {
    const degrees = MODE_DEGREES[mode][key.tonality];
    const scale = SCALE[key.tonality];
    const up = [];
    for (let o = 0; o < octaves; o++) {
      for (const d of degrees) up.push(spell(key.tonic, key.tonicMidi, d, scale[d] + 12 * o));
    }
    up.push(spell(key.tonic, key.tonicMidi, 0, 12 * octaves));
    const down = up.slice(0, -1).reverse();
    return up
      .map((n) => Object.assign({ dir: 'up' }, n))
      .concat(down.map((n) => Object.assign({ dir: 'down' }, n)));
  }

  function midiToFreq(midi, a4) {
    return (a4 || 440) * Math.pow(2, (midi - 69) / 12);
  }

  F.theory = { TONICS, keyInfo, buildSequence, midiToFreq, pretty, SHARP_ORDER, FLAT_ORDER };
})();
