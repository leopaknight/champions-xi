# Trilha + SFX sintetizados. 120 BPM, Lá menor. Saída: build/score_raw.wav
import os
import numpy as np
import soundfile as sf

SR = 48000
BPM = 120
B = 60 / BPM            # 0.5 s por batida
DUR = 21.5
N = int(SR * DUR)
rng = np.random.default_rng(7)   # ruído determinístico
mix = np.zeros((N, 2))


def add(sig, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N:
        return
    sig = sig[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[i : i + len(sig), 0] += sig * gain * l * 1.414
    mix[i : i + len(sig), 1] += sig * gain * r * 1.414


def env(n, a=0.002, d=0.2):
    t = np.arange(n) / SR
    e = np.minimum(t / a, 1.0) * np.exp(-t / d)
    return e


def kick():
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    click = rng.standard_normal(n) * np.exp(-t / 0.002) * 0.3
    return (np.sin(ph) * np.exp(-t / 0.16) + click) * 0.9


def clap():
    n = int(0.3 * SR); t = np.arange(n) / SR
    nz = rng.standard_normal(n)
    nz = np.diff(np.concatenate([[0], nz]))            # brilho
    e = np.exp(-t / 0.06)
    for k in (0.0, 0.011, 0.022):                      # bater "em grupo"
        e += (t >= k) * np.exp(-np.maximum(t - k, 0) / 0.008) * 0.6
    return nz * e * 0.22


def hat(dec=0.03):
    n = int(0.12 * SR); t = np.arange(n) / SR
    nz = np.diff(np.concatenate([[0], rng.standard_normal(n)]))
    return nz * np.exp(-t / dec) * 0.12


def note(freq, dur, kind="saw", dec=0.25, a=0.004):
    n = int(dur * SR); t = np.arange(n) / SR
    if kind == "sine":
        w = np.sin(2 * np.pi * freq * t)
    elif kind == "pluck":
        w = sum(np.sin(2 * np.pi * freq * k * t) / k ** 1.5 for k in range(1, 7))
    else:
        w = sum(np.sin(2 * np.pi * freq * k * t) / k for k in range(1, 12)) * 0.6
    return w * env(n, a, dec)


def noise_sweep(dur, up=True, gain=0.25):
    n = int(dur * SR); t = np.arange(n) / SR
    nz = rng.standard_normal(n)
    # passa-baixa de 1 polo com corte variável
    lo, hi = (200, 9000) if up else (9000, 200)
    fc = lo * (hi / lo) ** (t / dur)
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.zeros(n); s = 0.0
    for i in range(n):
        s = a[i] * s + (1 - a[i]) * nz[i]
        y[i] = s
    shape = (t / dur) ** 2 if up else np.exp(-t / (dur * 0.35))
    return y * shape * gain * 4


def impact():
    n = int(1.6 * SR); t = np.arange(n) / SR
    f = 32 + 90 * np.exp(-t / 0.08)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.55)
    nz = rng.standard_normal(n) * np.exp(-t / 0.09) * 0.35
    return (boom + nz) * 0.9


def tick():
    n = int(0.03 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * 2400 * t) * np.exp(-t / 0.006) * 0.15


def lock():
    n = int(0.12 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1200 * t) + 0.5 * np.sin(2 * np.pi * 1800 * t)) * np.exp(-t / 0.03) * 0.3


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


# ---- arranjo -------------------------------------------------------------
beats = int(DUR / B)
drop = set(range(20, 24))          # 10.0–12.0 s: tensão, sem bumbo
for b in range(beats):
    t = b * B
    if b < 40 and b not in drop:
        add(kick(), t, 1.0)
        if b % 2 == 1:
            add(clap(), t, 0.9, 0.0)
        add(hat(), t + B / 2, 0.9, 0.3)
        if 8 <= b < 20 or 24 <= b < 36:
            add(hat(0.012), t + B / 4, 0.6, -0.3)
            add(hat(0.012), t + 3 * B / 4, 0.6, -0.3)
    elif b >= 40:
        pass

# baixo: A F C G por compasso (2 s)
roots = [45, 41, 48, 43]
for bar in range(int(DUR / (4 * B))):
    if bar in (5,):                # pausa na tensão
        continue
    r = roots[bar % 4]
    for k in range(8):
        t = bar * 4 * B + k * B / 2
        if t >= 20.0:
            break
        add(note(hz(r - 12), 0.24, "saw", 0.12), t, 0.28)
        add(note(hz(r - 24), 0.24, "sine", 0.18), t, 0.35)

# 0–2 s: roleta (ticks em 1/16) + travas nos dígitos
for k in range(16):
    t = k * B / 4
    if t < 2.0:
        add(tick(), t, 1.0, 0.4 * ((k % 2) * 2 - 1))
for t in (1.25, 1.5, 1.75):
    add(lock(), t, 1.0)
add(impact(), 2.0, 0.55)
add(lock(), 2.0, 1.2)

# 2.25+ letras do clube
for i in range(9):
    add(tick(), 2.25 + i * B / 8, 0.8)
add(noise_sweep(0.35, up=False, gain=0.12), 3.0)

# 4.0 gramado desenha
add(noise_sweep(0.5, up=False, gain=0.18), 4.0)

# 4.5–9.5 jogadores entram: pluck pentatônico subindo
penta = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81]
for i, m in enumerate(penta):
    t = 4.5 + i * B
    add(note(hz(m), 0.6, "pluck", 0.22), t, 0.5, (i % 3 - 1) * 0.4)
    add(noise_sweep(0.3, up=True, gain=0.05), t - 0.3, 1.0)

# 10–12 tensão: riser + botão + toque
add(noise_sweep(2.0, up=True, gain=0.3), 10.0)
for k in range(8):                       # notas subindo em 1/8
    add(note(hz(69 + k), 0.2, "saw", 0.1), 10.0 + k * B / 2, 0.12)
add(note(hz(81), 0.3, "pluck", 0.15), 10.0, 0.4)
add(lock(), 11.0, 1.6)

# 12 e 12.5: placar
add(impact(), 12.0, 1.0)
add(impact(), 12.5, 0.7)
add(note(hz(57), 1.5, "saw", 0.6), 12.0, 0.18)
add(note(hz(64), 1.5, "saw", 0.6), 12.0, 0.14)
add(lock(), 13.0, 0.8); add(lock(), 13.25, 0.8)

# 15.5–17.5 cortes da montagem
for i in range(5):
    t = 15.5 + i * B
    add(noise_sweep(0.18, up=False, gain=0.15), t, 1.0, (i % 2) * 0.6 - 0.3)
    add(note(hz(69 + [0, 3, 5, 7, 10][i]), 0.4, "pluck", 0.18), t, 0.35)

# 18 CTA
add(impact(), 18.0, 1.0)
for m in (57, 64, 69, 72):
    add(note(hz(m), 3.0, "saw", 1.2, 0.01), 18.0, 0.07)
add(lock(), 18.75, 0.7); add(lock(), 19.25, 0.7)
add(note(hz(81), 0.5, "pluck", 0.25), 19.75, 0.4)
for k in range(5):                       # dado quicando
    add(tick(), 20.0 + k * 0.1, 1.6)
add(lock(), 20.5, 1.3)

# master: saturação suave + normalização de pico (LUFS é feito no ffmpeg)
mix = np.tanh(mix * 0.9)
mix /= np.max(np.abs(mix)) / 0.89
os.makedirs("build", exist_ok=True)
sf.write("build/score_raw.wav", mix, SR, subtype="PCM_24")
print("ok", DUR, "s")
