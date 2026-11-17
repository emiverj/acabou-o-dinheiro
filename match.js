// Campinho 2D da simulação: desenha a partida no minuto informado (visual; o resultado vem do engine)
import { FORMATIONS, getP } from './engine.js';

const hash = (...n) => { let h = 2166136261; for (const x of n) { h ^= Math.floor(x * 1000) | 0; h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; };
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const shortName = n => { const p = String(n).split(' '); return p.length > 1 ? p.slice(-1)[0] : n; };

function light(hex) { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; }

export function createViewer(canvas) {
  const ctx = canvas.getContext('2d');
  let M = null, st = null, H = null, A = null, seed = 1, dpr = 1, W = 0, Hh = 0;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 600; const h = Math.round(w * 68 / 105);
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.height = h + 'px'; }
    W = canvas.width; Hh = canvas.height;
  }
  // posição base (sem bola) de cada jogador
  function basePos(team, side) {
    return FORMATIONS[team.formation].map((s, i) => {
      const depth = s.y / 100, lat = s.x / 100;
      const x = side === 'h' ? 0.045 + 0.47 * depth : 0.955 - 0.47 * depth;
      const y = side === 'h' ? lat : 1 - lat;
      return { id: team.lineup[i], pos: s.pos, x, y };
    });
  }
  // quem está com a bola em cada trecho de ~0,5 minuto
  function phaseAt(min) {
    // eventos com bola (gol, defesa, chance, pênalti perdido) roteirizam o lance
    const evs = M.ev.filter(e => ['gol', 'defesa', 'chance', 'penperdido'].includes(e.t));
    const ev = evs.find(e => min >= e.m - 0.55 && min < e.m + (e.t === 'gol' ? 0.6 : 0.15));
    if (ev) return { ev, side: ev.s, t: Math.min(1, (min - (ev.m - 0.55)) / 0.55), after: min > ev.m };
    const k = Math.floor(min / 0.5); const t = (min / 0.5) - k;
    const side = hash(seed, k) < 0.5 ? 'h' : 'a';
    return { side, k, t };
  }
  function teamPlayers(side, min, ball, attacking) {
    const team = side === 'h' ? H : A, base = basePos(team, side);
    const dir = side === 'h' ? 1 : -1;
    return base.map((p, i) => {
      const push = attacking ? 0.07 : -0.03;
      let x = p.x + dir * push + (ball.x - 0.5) * 0.22 + Math.sin(min * 3.1 + i * 1.7 + seed) * 0.012;
      let y = p.y + (ball.y - p.y) * (p.pos === 'GK' ? 0.15 : 0.18) + Math.cos(min * 2.7 + i * 2.3) * 0.015;
      if (p.pos === 'GK') x = side === 'h' ? 0.03 + Math.max(0, ball.x - 0.7) * 0.05 : 0.97 - Math.max(0, 0.3 - ball.x) * 0.05;
      return { ...p, x: Math.min(0.99, Math.max(0.01, x)), y: Math.min(0.97, Math.max(0.03, y)) };
    });
  }
  function draw(min, ht) {
    if (!M) return;
    resize();
    const g = ctx; g.setTransform(1, 0, 0, 1, 0, 0);
    // gramado
    for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#16542f' : '#185c33'; g.fillRect(i * W / 12, 0, W / 12 + 1, Hh); }
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2 * dpr;
    const P = 0.02; const px = v => v * W, py = v => v * Hh;
    g.strokeRect(px(P), py(P), px(1 - 2 * P), py(1 - 2 * P));
    g.beginPath(); g.moveTo(px(.5), py(P)); g.lineTo(px(.5), py(1 - P)); g.stroke();
    g.beginPath(); g.arc(px(.5), py(.5), Hh * 0.13, 0, Math.PI * 2); g.stroke();
    [[P, 1], [1 - P, -1]].forEach(([x0, d]) => {
      g.strokeRect(Math.min(px(x0), px(x0 + d * .16)), py(.22), px(.16), py(.56));
      g.strokeRect(Math.min(px(x0), px(x0 + d * .055)), py(.37), px(.055), py(.26));
      g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(Math.min(px(x0), px(x0 - d * .012)), py(.44), px(.012), py(.12));
    });
    // bola
    const ph = ht ? { side: 'h', t: 0, k: -1 } : phaseAt(min);
    let ball = { x: .5, y: .5 };
    const atk = ph.side;
    const own = atk === 'h' ? H : A, opp = atk === 'h' ? A : H;
    const goalX = atk === 'h' ? 0.985 : 0.015;
    if (ht) ball = { x: .5, y: .5 };
    else if (ph.ev) {
      const e = ph.ev; const ps = basePos(own, atk);
      const sc = ps.find(p => p.id === e.p) || ps[9];
      const passer = ps.find(p => p.id === e.as) || ps[Math.floor(hash(seed, e.m) * 10) + 1];
      const shotFrom = { x: atk === 'h' ? 0.82 : 0.18, y: 0.38 + hash(seed, e.m, 2) * 0.24 };
      const passFrom = { x: atk === 'h' ? 0.62 : 0.38, y: passer.y };
      let target = { x: goalX, y: 0.47 + hash(seed, e.m, 3) * 0.06 };
      if (e.t === 'chance') target = { x: goalX, y: hash(seed, e.m, 4) < .5 ? 0.36 : 0.64 };
      if (e.t === 'defesa' || e.t === 'penperdido') target = { x: atk === 'h' ? 0.955 : 0.045, y: 0.5 };
      if (e.kind === 'penalti' || e.t === 'penperdido') { const spot = { x: atk === 'h' ? 0.885 : 0.115, y: 0.5 }; ball = ph.t < .7 ? spot : { x: lerp(spot.x, target.x, ease((ph.t - .7) / .3)), y: lerp(spot.y, target.y, ease((ph.t - .7) / .3)) }; }
      else if (e.kind === 'falta') { const spot = { x: atk === 'h' ? 0.74 : 0.26, y: 0.42 }; ball = ph.t < .6 ? spot : { x: lerp(spot.x, target.x, ease((ph.t - .6) / .4)), y: lerp(spot.y, target.y, ease((ph.t - .6) / .4)) - Math.sin((ph.t - .6) / .4 * Math.PI) * 0.08 }; }
      else if (ph.t < .5) ball = { x: lerp(passFrom.x, shotFrom.x, ease(ph.t / .5)), y: lerp(passFrom.y, shotFrom.y, ease(ph.t / .5)) };
      else ball = { x: lerp(shotFrom.x, target.x, ease((ph.t - .5) / .5)), y: lerp(shotFrom.y, target.y, ease((ph.t - .5) / .5)) };
      if (ph.after && e.t === 'gol') ball = { x: atk === 'h' ? 0.993 : 0.007, y: target.y };
    } else {
      const ps = basePos(own, atk).filter(p => p.pos !== 'GK').sort((a, b) => a.x - b.x);
      const i1 = Math.floor(hash(seed, ph.k, 1) * ps.length), i2 = Math.floor(hash(seed, ph.k, 2) * ps.length);
      const p1 = ps[i1], p2 = ps[i2];
      const fwd = (atk === 'h' ? 1 : -1) * 0.08;
      ball = { x: lerp(p1.x + fwd, p2.x + fwd, ease(ph.t)), y: lerp(p1.y, p2.y, ease(ph.t)) };
    }
    const hp = teamPlayers('h', min, ball, atk === 'h'), ap = teamPlayers('a', min, ball, atk === 'a');
    const r = Math.max(5, Hh * 0.026);
    const sameColor = Math.abs(light(H.color) - light(A.color)) < 0.12;
    const drawTeam = (list, team, alt) => list.forEach(p => {
      g.beginPath(); g.arc(px(p.x), py(p.y), p.pos === 'GK' ? r * 1.05 : r, 0, Math.PI * 2);
      g.fillStyle = p.pos === 'GK' ? '#e8e8e8' : (alt ? '#ffffff' : team.color); g.fill();
      g.lineWidth = 2 * dpr; g.strokeStyle = alt ? team.color : 'rgba(0,0,0,.55)'; g.stroke();
    });
    drawTeam(hp, H, false); drawTeam(ap, A, sameColor);
    // nome de quem conduz o lance
    if (ph.ev && !ht) {
      const list = atk === 'h' ? hp : ap; const who = list.find(p => p.id === ph.ev.p);
      if (who) { g.font = `${700} ${Math.round(11 * dpr)}px Archivo, sans-serif`; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 3 * dpr; const n = shortName(getP(st, who.id).n); g.strokeText(n, px(who.x), py(who.y) - r - 4 * dpr); g.fillText(n, px(who.x), py(who.y) - r - 4 * dpr); }
    }
    // cartões
    M.ev.filter(e => (e.t === 'amarelo' || e.t === 'vermelho') && min >= e.m && min < e.m + 0.6).forEach(e => {
      const list = e.s === 'h' ? hp : ap; const who = list.find(p => p.id === e.p); if (!who) return;
      g.fillStyle = e.t === 'amarelo' ? '#ffd400' : '#e0261b'; g.fillRect(px(who.x) + r * .6, py(who.y) - r * 2.2, r * .9, r * 1.25);
    });
    // bola
    g.beginPath(); g.arc(px(ball.x), py(ball.y), r * 0.55, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1.5 * dpr; g.strokeStyle = '#111'; g.stroke();
    // faixa de gol
    const goal = !ht && M.ev.find(e => e.t === 'gol' && min >= e.m && min < e.m + 0.6);
    if (goal) {
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, py(.4), W, py(.2));
      g.font = `400 ${Math.round(Hh * 0.11)}px Anton, Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffc833';
      g.fillText('GOOOL!', px(.5), py(.5)); g.textBaseline = 'alphabetic';
    }
    if (ht) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, py(.42), W, py(.16)); g.font = `400 ${Math.round(Hh * 0.08)}px Anton, Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('INTERVALO', px(.5), py(.5)); g.textBaseline = 'alphabetic'; }
  }
  return {
    setMatch(match, home, away, state) { M = match; H = home; A = away; st = state; seed = (String(home.id) + String(away.id)).split('').reduce((s, c) => s + c.charCodeAt(0), 0) % 997; },
    draw,
  };
}
