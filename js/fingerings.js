/* Standard Boehm-system fingerings for a C-foot concert flute, C4 to C7.
 *
 * Notation: "<left hand> | <right hand>"
 *   left  : T = thumb on B key, Tb = thumb on B♭ lever, 1 2 3 = fingers, G# = pinky lever
 *   right : 1 2 3 = fingers, lev = B♭ side lever, tr1 / tr2 = trill keys,
 *           Eb / C# / C = pinky keys on the foot joint
 */
(function () {
  const F = (window.Flute = window.Flute || {});

  const LOW = {
    0: ['T 123 | 123 C# C'],
    1: ['T 123 | 123 C#'],
    2: ['T 123 | 123'],
    3: ['T 123 | 123 Eb'],
    4: ['T 123 | 12 Eb'],
    5: ['T 123 | 1 Eb'],
    6: ['T 123 | 3 Eb', 'T 123 | 2 Eb'],
    7: ['T 123 | Eb'],
    8: ['T 123 G# | Eb'],
    9: ['T 12 | Eb'],
    10: ['T 1 | 1 Eb', 'Tb 1 | Eb', 'T 1 | lev Eb'],
    11: ['T 1 | Eb'],
  };
  const ALT_NAMES = {
    6: ['Standard', 'Middle-finger F♯'],
    10: ['One-and-one', 'Thumb B♭', 'Side lever'],
  };

  const CHART = {};
  for (let pc = 0; pc < 12; pc++) {
    CHART[60 + pc] = LOW[pc];
    CHART[72 + pc] = LOW[pc];
  }
  // C and C♯ in the staff, and the two "vented" notes above them.
  CHART[72] = CHART[84] = ['1 | Eb'];
  CHART[73] = CHART[85] = ['| Eb'];
  CHART[74] = ['T 23 | 123'];
  CHART[75] = ['T 23 | 123 Eb'];
  // Third octave.
  CHART[86] = ['T 23 | Eb'];
  CHART[87] = ['T 123 G# | 123 Eb'];
  CHART[88] = ['T 12 | 12 Eb'];
  CHART[89] = ['T 13 | 1 Eb'];
  CHART[90] = ['T 13 | 3 Eb'];
  CHART[91] = ['123 | Eb'];
  CHART[92] = ['23 G# | Eb'];
  CHART[93] = ['T 2 | 1 Eb'];
  CHART[94] = ['T | 1 tr1 Eb'];
  CHART[95] = ['T 13 | tr2 Eb'];
  CHART[96] = ['123 G# | 1'];

  function parse(code) {
    const [left, right] = code.split('|').map((s) => s.trim().split(/\s+/).filter(Boolean));
    const k = { T: 0, Tb: 0, L1: 0, L2: 0, L3: 0, Gs: 0, R1: 0, R2: 0, R3: 0, lev: 0, tr1: 0, tr2: 0, Eb: 0, Cs: 0, C: 0 };
    for (const tok of left) {
      if (tok === 'T') k.T = 1;
      else if (tok === 'Tb') k.T = k.Tb = 1; // the B♭ lever closes the B key too
      else if (tok === 'G#') k.Gs = 1;
      else for (const d of tok) k['L' + d] = 1;
    }
    for (const tok of right) {
      if (tok === 'Eb') k.Eb = 1;
      else if (tok === 'C#') k.Cs = 1;
      else if (tok === 'C') k.C = k.Cs = 1; // the low C roller closes C♯ too
      else if (tok === 'lev' || tok === 'tr1' || tok === 'tr2') k[tok] = 1;
      else for (const d of tok) k['R' + d] = 1;
    }
    return k;
  }

  function options(midi) {
    const codes = CHART[midi] || [];
    const names = codes.length > 1 ? ALT_NAMES[midi % 12] : null;
    return codes.map((c, i) => ({ keys: parse(c), label: names ? names[i] : 'Standard' }));
  }

  function describe(k) {
    const left = [];
    if (k.Tb) left.push('thumb on B♭ lever');
    else if (k.T) left.push('thumb');
    [1, 2, 3].forEach((n) => k['L' + n] && left.push(String(n)));
    if (k.Gs) left.push('pinky G♯');
    const right = [];
    if (k.lev) right.push('side lever');
    if (k.R1) right.push('1');
    if (k.tr1) right.push('1st trill key');
    if (k.R2) right.push('2');
    if (k.tr2) right.push('2nd trill key');
    if (k.R3) right.push('3');
    if (k.C) right.push('pinky low C');
    else if (k.Cs) right.push('pinky low C♯');
    else if (k.Eb) right.push('pinky E♭');
    return {
      left: left.length ? left.join(', ') : 'all open',
      right: right.length ? right.join(', ') : 'all open',
    };
  }

  function tip(midi) {
    if (midi <= 61) return 'Slide the right pinky onto the foot keys. Drop the jaw and aim slow, warm air downward.';
    if (midi === 62) return 'The right pinky lifts off the E♭ key for low D. It goes back down for almost every other note.';
    if (midi === 74 || midi === 75) return 'Lift the left index finger. That open hole is what makes middle D and E♭ speak clearly.';
    if (midi === 72 || midi === 73 || midi === 84 || midi === 85)
      return 'The thumb is off. Balance the flute on the right pinky and the base of the left index finger.';
    if (midi % 12 === 10 && midi < 86) return 'B♭ has three fingerings. Use the swap button to compare them.';
    if (midi <= 71) return 'Low register: relaxed, open lips and slow, warm air.';
    if (midi <= 85) return 'Middle register: same fingers as the octave below. Use faster air and a smaller lip opening.';
    return 'High register: its own fingering. Use fast, focused air and a small lip opening, without pinching.';
  }

  F.fingerings = { options, describe, tip };
})();
