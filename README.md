# Flute Scale Studio

A small web app for learning flute scales, pentatonics and arpeggios in every major and minor key.

- **Fingering diagram**: a side view of the whole flute, with each key in its real place and the keys to press filled in red (C4–C7, closed-G♯ flute with a C foot)
- **Fingering chart**: every note from low C to high C, grouped by register, showing each alternative where a note has more than one (B♭, F♯, high B)
- **Staff notation** with the key signature, following along as the pattern plays
- **Playback** with a flute-like tone, metronome with count-in, tempo, loop, and one or two octaves
- **Drone** on the tonic for intonation practice
- **Listen to me**: uses the microphone to show how sharp or flat you are and moves to the next note when you play the right one

## Run it

No build step. Serve the folder with any static server, for example:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. The microphone feature needs `localhost` or HTTPS.

## Layout

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Page markup and theme (light and dark) |
| `js/theory.js` | Keys, note spelling, practice sequences |
| `js/fingerings.js` | Fingering data and playing tips |
| `js/diagram.js` | The flute drawing used by the diagram and the chart |
| `js/audio.js` | Web Audio tone, metronome, drone, scheduler |
| `js/tuner.js` | Microphone pitch detection |
| `js/app.js` | Rendering and event wiring |
| `js/glyphs.js` | Clef and accidental outlines from Noto Music (SIL OFL 1.1) |
