# Motion studio rules

Pasta de vídeo do 7 Estrelas. Pipeline:

```
python3 score.py        # trilha sintetizada -> build/score_raw.wav
python3 beats.py        # mede o grid de batidas -> beats.json
node render.mjs --sheet # 1 frame por batida -> build/sheet.png
node render.mjs         # render final -> out/7estrelas.mp4
```

## Render contract
- Every film is a pure function of time: `window.seek(t)` paints frame t.
- No CSS transitions, no setTimeout, no requestAnimationFrame in render mode,
  no state carried between frames. Seeded noise only (mulberry32), never Math.random.
- Render with `node render.mjs`, encode H.264 yuv420p, CRF 16.

## Look
- Banned defaults: centered title on gradient, everything fading in,
  corner labels and frame borders, glow on UI chrome, generic particle bursts.
- One display face, one UI face. One accent color unless the brief says otherwise.
- Every 2 to 4 seconds something new must happen on screen.

## Sound
- Score and SFX are synthesized in code unless a track is supplied.
- Place hits on the measured beat grid (beats.json). Loudness -14 LUFS.

## Loop before showing anything
1. Render one frame per beat as a contact sheet and LOOK at it.
2. Score it 1-10 on: hook in first 2s, readability at phone size,
   motion quality, variety, brand accuracy, sound sync.
3. Fix the 3 worst problems. Repeat until every score is 8+.
4. Only then do the full render.

## Marca 7 Estrelas
- Display: Poppins 800/900. UI: Inter 500/700 (fontes locais em `fonts/`).
- Fundo `#070a10`, painel `#1a222c`, texto `#f3f6f9`, muted `#8b98a9`,
  gramado `#0e3d24`, acento único `#ffd60a`.
- Só usar finais cuja escalação no `data.js` foi conferida (2019 Liverpool: ok).
