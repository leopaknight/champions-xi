# Mede o grid de batidas da trilha e grava beats.json (o filme posiciona hits por ele).
import json
import numpy as np
import librosa

y, sr = librosa.load("build/score_raw.wav", sr=None, mono=True)
tempo, frames = librosa.beat.beat_track(y=y, sr=sr, units="frames", trim=False)
times = librosa.frames_to_time(frames, sr=sr)
onsets = librosa.onset.onset_detect(y=y, sr=sr, units="time", backtrack=False)

tempo = float(np.atleast_1d(tempo)[0])  # estimativa bruta; o bpm gravado vem do ajuste
# ajuste robusto t = offset + k*period: descarta batidas que o tracker perdeu
period = float(np.median(np.diff(times)))
phase = float(times[0])
for _ in range(5):
    k = np.round((times - phase) / period)
    keep = np.abs(times - (phase + k * period)) < 0.04
    period, phase = np.polyfit(k[keep], times[keep], 1)
print(f"usadas {keep.sum()}/{len(times)} batidas no ajuste")
grid = [round(phase + k * period, 4) for k in range(int(21.5 / period) + 1)]

json.dump({"bpm": round(60 / period, 2), "period": round(period, 4), "offset": round(phase, 4),
           "beats": grid, "detected": [round(float(t), 4) for t in times],
           "onsets": [round(float(t), 4) for t in onsets]}, open("beats.json", "w"), indent=1)
print(f"bpm={60 / period:.2f} period={period:.4f} offset={phase:+.4f} detected={len(times)}")
