# Gera sons/gol-torcida.(m4a|mp3): grito de torcida na arquibancada (sintetizado, sem gravação de terceiros).
# Dezenas de vozes gritando "ô/é" (formantes de vogal) + ruído de multidão, crescendo e se espalhando no estádio (reverb).
import numpy as np, subprocess, os, sys
from scipy.signal import butter, sosfilt, fftconvolve
SR = 44100; DUR = 3.6; rng = np.random.default_rng(7)
t = np.arange(int(SR * DUR)) / SR
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)
def env(on, peak, hold, off):
    e = np.zeros_like(t); a = (t >= on) & (t < on + peak); e[a] = ((t[a] - on) / peak) ** 1.5
    b = (t >= on + peak) & (t < on + peak + hold); e[b] = 1
    c = t >= on + peak + hold; e[c] = np.exp(-(t[c] - on - peak - hold) / off); return e
voices = np.zeros_like(t)
VOWELS = [(570, 840, 2410), (530, 1840, 2480), (730, 1090, 2440), (450, 800, 2600)]  # ô, é, á, ó
for i in range(70):
    f0 = rng.uniform(140, 330) if rng.random() < .75 else rng.uniform(230, 420)
    on = rng.uniform(0, .35); peak = rng.uniform(.15, .45); hold = rng.uniform(1.0, 2.0); off = rng.uniform(.35, .8)
    rise = 1 + 0.18 * (1 - np.exp(-np.clip(t - on, 0, None) / 0.25))  # voz sobe no grito
    vib = 1 + 0.012 * np.sin(2 * np.pi * rng.uniform(4.5, 7) * t + rng.uniform(0, 6))
    jit = 1 + 0.01 * np.cumsum(rng.normal(0, 1, len(t))) / np.sqrt(SR) * 4
    ph = 2 * np.pi * np.cumsum(f0 * rise * vib * jit) / SR
    src = sum(np.sin(k * ph) / k ** 1.1 for k in range(1, 18))  # voz rouca (dente de serra suave)
    F = VOWELS[rng.integers(len(VOWELS))]
    v = 1.0 * bp(src, F[0] * .8, F[0] * 1.25) + .55 * bp(src, F[1] * .85, F[1] * 1.2) + .25 * bp(src, F[2] * .9, F[2] * 1.12)
    v += 0.25 * bp(rng.normal(0, 1, len(t)), F[0] * .7, F[1] * 1.3)  # ar da voz
    voices += v * env(on, peak, hold, off) * rng.uniform(.4, 1.0)
crowd = bp(rng.normal(0, 1, len(t)), 250, 3500) * env(0.05, .5, 1.6, .9)
crowd *= 1 + .25 * np.sin(2 * np.pi * 1.7 * t)  # ondas da arquibancada
x = voices / np.abs(voices).max() + 0.18 * crowd / np.abs(crowd).max()
ir_t = np.arange(int(SR * 1.2)) / SR; ir = rng.normal(0, 1, len(ir_t)) * np.exp(-ir_t / 0.3)
wet = fftconvolve(x, ir)[:len(t)]; x = x + 0.35 * wet * np.abs(x).max() / np.abs(wet).max()  # arquibancada: seco + eco do estádio
x = bp(x, 120, 4200, 3)
fade = np.ones_like(t); n = int(SR * .5); fade[-n:] = np.linspace(1, 0, n) ** 2; x *= fade
x = x / np.abs(x).max() * 0.9
st = np.stack([x, np.roll(x, int(SR * .012))], 1)  # leve abertura estéreo
out = os.path.join(os.path.dirname(__file__), '..', '..', 'sons')
wav = '/tmp/gol-torcida.wav'
import wave; w = wave.open(wav, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype('<i2').tobytes()); w.close()
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '96k', os.path.join(out, 'gol-torcida.m4a')], check=True)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '96k', os.path.join(out, 'gol-torcida.mp3')], check=True)
print('ok')
