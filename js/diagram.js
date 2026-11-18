/* Flute fingering drawing: a side view of a C-foot Boehm flute (head joint left, foot right),
 * keys in their real order, and every key the player presses filled in.
 * Original inline-SVG artwork; colours come from CSS tokens so it follows the theme. */
(function () {
  const F = (window.Flute = window.Flute || {});

  const TOP = 64; // tube top edge
  const H = 22; // tube height
  const BOT = TOP + H;
  const CY = TOP + 3; // centre line of the key cups, sitting on top of the tube
  const R = 10.5; // finger key radius
  const ROD = BOT - 7; // mechanism rod along the front of the tube

  // Key positions along the flute (viewBox units).
  const X = {
    csCup: 103,
    L1: 124,
    bCup: 147,
    L2: 170,
    L3: 196,
    fsCup: 232,
    lev: 246,
    R1: 268,
    tr1: 289,
    R2: 310,
    tr2: 331,
    R3: 352,
    ebCup: 387,
    fcsCup: 423,
    fcCup: 455,
  };

  // Shared gradients, defined once per document so many diagrams can reference them.
  function installDefs() {
    if (document.getElementById('fl-defs')) return;
    const g = F.glyphs || {};
    document.body.insertAdjacentHTML(
      'afterbegin',
      `<svg id="fl-defs" aria-hidden="true" focusable="false" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden">
        <defs>
          <linearGradient id="fl-tube-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style="stop-color:var(--silver-2)"/>
            <stop offset=".22" style="stop-color:var(--silver-1)"/>
            <stop offset=".55" style="stop-color:var(--silver-mid)"/>
            <stop offset="1" style="stop-color:var(--silver-2)"/>
          </linearGradient>
          <radialGradient id="fl-key-g" cx=".36" cy=".3" r=".8">
            <stop offset="0" style="stop-color:var(--silver-1)"/>
            <stop offset=".55" style="stop-color:var(--silver-mid)"/>
            <stop offset="1" style="stop-color:var(--silver-2)"/>
          </radialGradient>
          <path id="g-clef" d="${g.clef || ''}"/>
          <path id="g-sharp" d="${g.sharp || ''}"/>
          <path id="g-flat" d="${g.flat || ''}"/>
        </defs>
      </svg>`
    );
  }

  /**
   * k: key map from Flute.fingerings (1 = pressed).
   * opts.compact: no text, tighter crop (for the chart). opts.label: accessible description.
   */
  function flute(k, opts) {
    opts = opts || {};
    const compact = !!opts.compact;
    const on = (v) => (v ? ' on' : '');
    const text = (x, y, s, cls, anchor) =>
      compact ? '' : `<text class="${cls || 'fl-lbl'}" x="${x}" y="${y}" text-anchor="${anchor || 'middle'}">${s}</text>`;
    const arm = (x, y, h) => `<rect class="fl-arm" x="${x - 1.2}" y="${y}" width="2.4" height="${h}"/>`;
    const cup = (x, r) =>
      arm(x, CY + r - 1, ROD - CY - r + 2) +
      `<circle class="fl-cup" cx="${x}" cy="${CY}" r="${r}"/><circle class="fl-rim" cx="${x}" cy="${CY}" r="${r - 2}"/>`;
    const key = (x, v, num, perforated) =>
      arm(x, CY + R - 1, ROD - CY - R + 2) +
      `<circle class="fl-key${on(v)}" cx="${x}" cy="${CY}" r="${R}"/>` +
      `<circle class="fl-rim${on(v)}" cx="${x}" cy="${CY}" r="${R - 2.4}"/>` +
      (perforated ? `<circle class="fl-perf${on(v)}" cx="${x}" cy="${CY}" r="3.5"/>` : '') +
      text(x, CY - R - 4, num, 'fl-num');
    const paddle = (x, y, w, v, h) =>
      `<rect class="fl-key${on(v)}" x="${x}" y="${y}" width="${w}" height="${h || 8}" rx="${(h || 8) / 2}"/>`;
    const roller = (x, y, w, v) =>
      paddle(x, y, w, v, 7) +
      `<path class="fl-roll${on(v)}" d="M${x + 9} ${y + 1.6}v3.8M${x + 14} ${y + 1.6}v3.8M${x + 19} ${y + 1.6}v3.8"/>`;
    const trill = (x, v) =>
      arm(x, CY - 14, TOP - CY + 14) +
      `<ellipse class="fl-key${on(v)}" cx="${x}" cy="${CY - 18}" rx="4.2" ry="6.4"/>` +
      text(x, CY - 28, 'tr');

    let s = '';

    // Head joint: crown, tube, lip plate with the embouchure hole.
    s += `<rect class="fl-metal" x="2" y="${TOP + 7}" width="5" height="${H - 14}" rx="1.5"/>`;
    s += `<rect class="fl-metal" x="6" y="${TOP - 2.5}" width="10" height="${H + 5}" rx="3"/>`;
    s += `<rect class="fl-tube" x="15" y="${TOP}" width="62" height="${H}"/>`;
    s += `<ellipse class="fl-plate" cx="42" cy="${TOP + 3}" rx="17" ry="8"/>`;
    s += `<ellipse class="fl-emb" cx="43" cy="${TOP + 2.5}" rx="6.5" ry="3.4"/>`;
    // Body and foot joint tubes, with the tenon rings between them.
    s += `<rect class="fl-tube" x="80" y="${TOP}" width="285" height="${H}"/>`;
    s += `<rect class="fl-tube" x="368" y="${TOP}" width="104" height="${H}"/>`;
    s += `<rect class="fl-ring" x="76" y="${TOP - 1.5}" width="5" height="${H + 3}" rx="1.2"/>`;
    s += `<rect class="fl-ring" x="364" y="${TOP - 1.5}" width="5" height="${H + 3}" rx="1.2"/>`;
    s += `<rect class="fl-ring" x="470" y="${TOP - 1}" width="4" height="${H + 2}" rx="1"/>`;
    // Rods and posts.
    s += `<rect class="fl-rod" x="96" y="${ROD}" width="266" height="3" rx="1.5"/>`;
    s += `<rect class="fl-rod" x="378" y="${ROD}" width="88" height="3" rx="1.5"/>`;
    [96, 158.5, 214, 289, 331, 360, 378, 439, 464].forEach((x) => {
      s += `<rect class="fl-post" x="${x - 1.6}" y="${ROD + 2}" width="3.2" height="${BOT - ROD - 2}"/>`;
    });

    // Levers above the tube: B♭ side lever and the two trill keys.
    s += arm(X.lev + 7, CY - 15, TOP - CY + 15);
    s += paddle(X.lev - 11, CY - 22, 22, k.lev, 7) + text(X.lev, CY - 28, 'B♭');
    s += trill(X.tr1, k.tr1) + trill(X.tr2, k.tr2);

    // Key cups along the top. Plain cups move with the mechanism; only the finger keys are touched.
    s += cup(X.csCup, 6.5);
    s += key(X.L1, k.L1, '1', false);
    s += cup(X.bCup, 8.5);
    s += key(X.L2, k.L2, '2', true);
    s += key(X.L3, k.L3, '3', true);
    s += cup(X.fsCup, 8.5);
    s += key(X.R1, k.R1, '1', true);
    s += key(X.R2, k.R2, '2', true);
    s += key(X.R3, k.R3, '3', true);
    s += cup(X.ebCup, 7.5) + cup(X.fcsCup, 8.5) + cup(X.fcCup, 8.5);

    // Thumb keys under the body: the B key, with the B♭ lever just below it.
    s += arm(146, BOT, 9) + paddle(114, BOT + 8, 38, k.T) + text(157, BOT + 14.5, 'Thumb', 'fl-lbl', 'start');
    s += arm(106, BOT, 19) + paddle(98, BOT + 18, 26, k.Tb, 7) + text(111, BOT + 34, 'B♭');
    // Left pinky G♯ lever.
    s += arm(222, BOT, 9) + paddle(204, BOT + 8, 26, k.Gs) + text(217, BOT + 27, 'G♯');
    // Right pinky cluster on the foot joint: E♭ key, then the C♯ and C rollers.
    s += arm(396, BOT, 9) + paddle(372, BOT + 8, 28, k.Eb) + text(367, BOT + 14.5, 'E♭', 'fl-lbl', 'end');
    s += arm(406, BOT, 18) + roller(380, BOT + 17, 28, k.Cs) + text(375, BOT + 23.5, 'C♯', 'fl-lbl', 'end');
    s += arm(415, BOT, 27) + roller(388, BOT + 26, 28, k.C) + text(383, BOT + 32.5, 'C', 'fl-lbl', 'end');

    if (!compact) {
      s += text((X.L1 + X.L3) / 2, 25, 'LEFT HAND', 'fl-grp') + text((X.R1 + X.R3) / 2, 25, 'RIGHT HAND', 'fl-grp');
    }

    const vb = compact ? '74 40 406 81' : '0 15 480 108';
    const label = opts.label ? ` aria-label="${opts.label}"` : '';
    return `<svg class="fl${compact ? ' fl-compact' : ''}" viewBox="${vb}" role="img"${label}>${s}</svg>`;
  }

  installDefs();
  F.diagram = { flute };
})();
