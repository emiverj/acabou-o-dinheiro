// Efeitos sonoros sintetizados (sem arquivos): martelo, lance, apito, torcida.
// Para trocar por um áudio próprio, coloque o arquivo em /sons e use playFile('sons/arquivo.mp3').
let ctx = null, muted = false;
try { muted = localStorage.getItem('acabou-mute') === '1'; } catch (e) {}
const ac = () => { if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); } if (ctx.state === 'suspended') ctx.resume(); return ctx; };
// o navegador só libera áudio depois de um clique
document.addEventListener('pointerdown', () => { if (!muted) ac(); }, { once: true });

export const isMuted = () => muted;
export function setMuted(m) { muted = !!m; try { localStorage.setItem('acabou-mute', muted ? '1' : '0'); } catch (e) {} }

function noise(c, dur) { const b = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; return s; }
function knock(c, t, vol) {
  const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.18);
  const n = noise(c, 0.06), f = c.createBiquadFilter(), gn = c.createGain(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 3;
  gn.gain.setValueAtTime(vol * 0.9, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.06); n.connect(f).connect(gn).connect(c.destination); n.start(t);
}
const S = {
  // martelo: dou-lhe três!
  gavel(c) { const t = c.currentTime; knock(c, t, 0.9); knock(c, t + 0.16, 0.7); },
  bid(c) { const t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(880, t); o.frequency.setValueAtTime(1320, t + 0.05);
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.14); },
  whistle(c, long) { const t = c.currentTime, dur = long ? 0.9 : 0.35; [0, long ? 0 : 0.45].forEach(d => { const o = c.createOscillator(), l = c.createOscillator(), lg = c.createGain(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = 2900; l.frequency.value = 38; lg.gain.value = 140; l.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.16, t + d + 0.03); g.gain.setValueAtTime(0.16, t + d + dur - 0.05); g.gain.linearRampToValueAtTime(0, t + d + dur);
    o.connect(g).connect(c.destination); o.start(t + d); l.start(t + d); o.stop(t + d + dur); l.stop(t + d + dur); }); },
  goal(c) { const t = c.currentTime, n = noise(c, 2.6), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(900, t + 0.8); f.Q.value = 0.6;
    g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.35); g.gain.setValueAtTime(0.5, t + 1.4); g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    n.connect(f).connect(g).connect(c.destination); n.start(t); },
  ooh(c) { const t = c.currentTime, n = noise(c, 1.2), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'lowpass'; f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(300, t + 1.1);
    g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.2); g.gain.exponentialRampToValueAtTime(0.001, t + 1.2); n.connect(f).connect(g).connect(c.destination); n.start(t); },
  pop(c) { const t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(600, t); o.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.12); },
};
export function play(name, arg) { if (muted) return; const c = ac(); if (!c || !S[name]) return; try { S[name](c, arg); } catch (e) {} }
export function playFile(url, vol = 0.8) { if (muted) return; try { const a = new Audio(url); a.volume = vol; a.play().catch(() => {}); } catch (e) {} }
