// Acabou o dinheiro? — regras, simulação e motor do leilão (roda no navegador do anfitrião)
// Ao mudar qualquer regra aqui, atualize também o livro de regras em rules.js
import { PLAYERS } from './db.js';

export const POS_PT = { GK:'GOL', CB:'ZAG', LB:'LE', RB:'LD', LWB:'ALE', RWB:'ALD', CDM:'VOL', CM:'MC', CAM:'MEI', LM:'ME', RM:'MD', LW:'PE', RW:'PD', ST:'ATA', CF:'SA' };
export const COLORS = ['#ffc833','#ff6b5a','#5ab0ff','#b98cff','#3ddc84','#ff9a3d','#ff7ac6','#7ae0e0','#d4e157','#a1887f'];
export const BOT_NAMES = [['Ressaca EC','Prof. Zeca'],['Bola Murcha FC','Seu Juvenal'],['Canela Seca AC','Dona Cida'],['Real Várzea','Mister Tonhão'],['Atlético Resenha','Pardal'],['Unidos do Churrasco','Tia Neide'],['EC Fominha','Careca do Bar'],['Sport Club Galera','Prof. Xandão']];
export const SPEEDS = { normal:{ open:10, reset:6, after:2200, ai:[500,1700] }, rapido:{ open:7, reset:4, after:1500, ai:[300,1100] } };

/* ---------------- Formações ---------------- */
const BACK4 = [['LB',14,27],['CB',38,22],['CB',62,22],['RB',86,27]];
const BACK3 = [['CB',26,22],['CB',50,19],['CB',74,22]];
const BACK5 = [['LB',9,34],['CB',30,22],['CB',50,19],['CB',70,22],['RB',91,34]];
const GKS = [['GK',50,6]];
const f = (...parts) => parts.flat().map(([pos,x,y]) => ({ pos, x, y }));
export const FORMATIONS = {
  '4-3-3':          f(GKS, BACK4, [['CM',28,50],['CDM',50,42],['CM',72,50],['LW',17,77],['ST',50,85],['RW',83,77]]),
  '4-3-3 Ofensivo': f(GKS, BACK4, [['CM',28,48],['CAM',50,61],['CM',72,48],['LW',17,78],['ST',50,86],['RW',83,78]]),
  '4-4-2':          f(GKS, BACK4, [['LM',13,56],['CM',38,48],['CM',62,48],['RM',87,56],['ST',38,83],['ST',62,83]]),
  '4-2-3-1':        f(GKS, BACK4, [['CDM',37,42],['CDM',63,42],['LM',15,64],['CAM',50,64],['RM',85,64],['ST',50,86]]),
  '4-1-2-1-2 Losango': f(GKS, BACK4, [['CDM',50,38],['CM',28,52],['CM',72,52],['CAM',50,65],['ST',37,85],['ST',63,85]]),
  '3-5-2':          f(GKS, BACK3, [['CDM',37,42],['CDM',63,42],['LM',11,57],['CAM',50,63],['RM',89,57],['ST',37,85],['ST',63,85]]),
  '3-4-3':          f(GKS, BACK3, [['LM',11,54],['CM',37,49],['CM',63,49],['RM',89,54],['LW',19,79],['ST',50,86],['RW',81,79]]),
  '5-3-2':          f(GKS, BACK5, [['CM',28,52],['CDM',50,45],['CM',72,52],['ST',37,84],['ST',63,84]]),
};
export const FORMATION_NAMES = Object.keys(FORMATIONS);

/* ---------------- Jogadores ---------------- */
export function getP(state, id) {
  if (id >= 1000) return state.base[id];
  const p = PLAYERS[id];
  if (state.penal && state.penal[id]) return { ...p, o: p.o - 5, s: p.s.map(x => x - 5), pen: true };
  return p;
}
export const isGK = p => p.p === 'GK';

// funções equivalentes: trocar entre elas não custa rendimento
const EQUIV = { CM:['CDM'], CDM:['CM'], LB:['LWB'], LWB:['LB'], RB:['RWB'], RWB:['RB'], LM:['LW'], LW:['LM'], RM:['RW'], RW:['RM'] };
const LINE = { GK:0, CB:1, LB:1, RB:1, LWB:1, RWB:1, CDM:2, CM:2, CAM:2, LM:2, RM:2, LW:3, RW:3, ST:3, CF:3 };
const NEAR = { LB:['LWB','LM'], RB:['RWB','RM'], LWB:['LB','LM'], RWB:['RB','RM'], CB:['CDM'], CDM:['CM','CB'], CM:['CDM','CAM'],
  CAM:['CM','CF','ST'], LM:['LW','LWB','CM'], RM:['RW','RWB','CM'], LW:['LM','ST'], RW:['RM','ST'], ST:['CF','CAM'], CF:['ST','CAM'] };
export function fit(p, slot) {
  if ((p.p === 'GK') !== (slot === 'GK')) return 0.35;
  if (p.p === slot) return 1;
  if (p.a.includes(slot)) return 0.97;
  const eq = EQUIV[slot] || [];
  if (eq.includes(p.p) || p.a.some(a => eq.includes(a))) return 0.97;
  const near = NEAR[slot] || [];
  if (near.includes(p.p) || p.a.some(a => near.includes(a))) return 0.9;
  const d = Math.abs(LINE[p.p] - LINE[slot]);
  return d === 0 ? 0.82 : d === 1 ? 0.72 : 0.6;
}
export function fitLevel(p, slot) { const v = fit(p, slot); return v >= 0.97 ? 'ok' : v >= 0.88 ? 'near' : 'bad'; }

// pesos [RIT, FIN, PAS, DRI, DEF, FIS] por função (escondidos dos jogadores)
const W = { ST:[.2,.45,.05,.15,0,.15], CF:[.15,.35,.15,.3,0,.05], LW:[.3,.2,.15,.35,0,0], RW:[.3,.2,.15,.35,0,0],
  LM:[.25,.15,.25,.3,.05,0], RM:[.25,.15,.25,.3,.05,0], CAM:[.1,.25,.35,.3,0,0], CM:[.05,.1,.4,.25,.1,.1],
  CDM:[.05,0,.25,.1,.4,.2], LB:[.3,0,.15,.1,.3,.15], RB:[.3,0,.15,.1,.3,.15], LWB:[.3,0,.2,.15,.25,.1], RWB:[.3,0,.2,.15,.25,.1], CB:[.1,0,.05,0,.6,.25] };
export function slotScore(p, slot) {
  if (slot === 'GK') return p.p === 'GK' ? p.o : p.o * 0.35;
  if (p.p === 'GK') return 30;
  const w = W[slot]; let d = 0; for (let i = 0; i < 6; i++) d += w[i] * p.s[i];
  return (0.55 * d + 0.45 * p.o) * fit(p, slot);
}

/* Atribuição ótima (Húngaro) de 11 jogadores nas 11 vagas */
function hungarian(cost) {
  const n = cost.length, u = Array(n+1).fill(0), v = Array(n+1).fill(0), p = Array(n+1).fill(0), way = Array(n+1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i; let j0 = 0; const minv = Array(n+1).fill(Infinity), used = Array(n+1).fill(false);
    do {
      used[j0] = true; const i0 = p[j0]; let delta = Infinity, j1 = 0;
      for (let j = 1; j <= n; j++) if (!used[j]) {
        const cur = cost[i0-1][j-1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const res = Array(n); for (let j = 1; j <= n; j++) res[p[j]-1] = j-1; return res; // res[row]=col
}
export function autoLineup(state, squad, formation) {
  const slots = FORMATIONS[formation];
  const ps = squad.map(id => getP(state, id));
  const cost = slots.map(s => ps.map(p => -slotScore(p, s.pos)));
  const a = hungarian(cost);
  return slots.map((s, i) => squad[a[i]]);
}

/* Força por setor */
const SECT = { ST:{a:1}, CF:{a:.9,m:.3}, LW:{a:.85,m:.2}, RW:{a:.85,m:.2}, LM:{a:.4,m:.7,d:.1}, RM:{a:.4,m:.7,d:.1},
  CAM:{a:.55,m:.7}, CM:{a:.15,m:1,d:.2}, CDM:{m:.7,d:.6}, LB:{d:.9,m:.15,a:.1}, RB:{d:.9,m:.15,a:.1},
  LWB:{d:.75,m:.25,a:.15}, RWB:{d:.75,m:.25,a:.15}, CB:{d:1}, GK:{d:.9} };
const BASEVOL = { a:3.1, m:3.6, d:5.3 };
export function strength(state, team) {
  const slots = FORMATIONS[team.formation];
  const acc = { a:[0,0], m:[0,0], d:[0,0] };
  slots.forEach((s, i) => {
    const p = getP(state, team.lineup[i]); const sc = slotScore(p, s.pos);
    for (const k in SECT[s.pos]) { acc[k][0] += SECT[s.pos][k] * sc; acc[k][1] += SECT[s.pos][k]; }
  });
  const r = {};
  for (const k of ['a','m','d']) { const q = acc[k][1] ? acc[k][0]/acc[k][1] : 60; r[k] = q + 5 * (acc[k][1]/BASEVOL[k] - 1); }
  return r;
}
export function bestFormation(state, squad) {
  let best = null;
  for (const name of FORMATION_NAMES) {
    const lineup = autoLineup(state, squad, name);
    const st = strength(state, { formation:name, lineup });
    const tot = st.a + st.m + st.d;
    if (!best || tot > best.tot) best = { name, lineup, tot };
  }
  return best;
}
export function teamOvr(state, team) {
  const ps = team.squad.map(id => getP(state, id)); return ps.reduce((s,p) => s + p.o, 0) / Math.max(1, ps.length);
}

/* ---------------- Utilidades ---------------- */
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const slots = t => 11 - t.squad.length;
// bots e técnicos humanos que caíram há mais de 1 minuto (piloto automático)
export const botLike = t => !!(t.bot || t.auto);
export function setAuto(t, on) { t.auto = !!on; if (on && !t.pers) t.pers = { n: 'Piloto automático', k: 1 }; }
export const hasGK = (state, t) => t.squad.some(id => isGK(getP(state, id)));
export const fieldCount = (state, t) => t.squad.filter(id => !isGK(getP(state, id))).length;
export function needFor(state, t, p) { return isGK(p) ? !hasGK(state, t) : fieldCount(state, t) < 10; }
export const maxAllowed = t => slots(t) > 0 ? t.budget - (slots(t) - 1) : 0;
// piso para craques: 85+ = 5% do orçamento, 89+ = 10% (ex.: R$ 5 e R$ 10 com R$ 100)
export function floorFor(state, p) {
  const b = state.settings.budget;
  return p.o >= 89 ? Math.round(b * 0.10) : p.o >= 85 ? Math.round(b * 0.05) : 1;
}
// menor lance válido deste time no lote atual
export function minBid(state, t) {
  const lot = state.lot, p = PLAYERS[lot.pid];
  const base = lot.leader ? lot.price + 1 : 1;
  return Math.max(base, Math.min(floorFor(state, p), maxAllowed(t)));
}

/* ---------------- Simulação de partidas ---------------- */
function poisson(l) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; }
function wpick(arr) { let r = Math.random() * arr.reduce((s, x) => s + x.w, 0); for (const x of arr) { r -= x.w; if (r <= 0) return x.id; } return arr[arr.length - 1].id; }
function onField(state, team) { return FORMATIONS[team.formation].map((s, i) => ({ id: team.lineup[i], pos: s.pos, p: getP(state, team.lineup[i]) })); }
const hasK = (p, k) => (p.k || []).includes(k) || p.x === k;
function pickScorer(state, team, header) {
  return wpick(onField(state, team).filter(x => x.pos !== 'GK').map(x => {
    let w = ((SECT[x.pos].a || 0) + 0.05) * Math.pow((x.p.p === 'GK' ? 30 : x.p.s[1]) / 80, 4);
    if (header) w = (SECT[x.pos].a || 0.25) * Math.pow((x.p.h || 182) / 182, 6) * Math.pow(x.p.s[5] / 80, 2) * (hasK(x.p, 'Cabeceador') || hasK(x.p, 'Dono do alto') ? 1.8 : 1) + (x.pos === 'CB' ? 0.25 : 0);
    if (!header && (hasK(x.p, 'Decisivo'))) w *= 1.25;
    return { id: x.id, w };
  }));
}
const ASSIST_ROLE = { CAM:1.4, LW:1.3, RW:1.3, LM:1.3, RM:1.3, CM:1, ST:0.8, CF:1, LB:0.7, RB:0.7, LWB:0.8, RWB:0.8, CDM:0.6, CB:0.15, GK:0.02 };
function pickAssist(state, team, scorer) {
  return wpick(onField(state, team).filter(x => x.id !== scorer).map(x => ({ id: x.id, w: (ASSIST_ROLE[x.pos] || 0.5) * Math.pow(x.p.s[2] / 80, 3) * (hasK(x.p, 'Garçom') ? 1.4 : 1) })));
}
function takers(state, team) {
  return onField(state, team).filter(x => x.pos !== 'GK').map(x => ({ id: x.id, v: x.p.s[1] + (hasK(x.p, 'Cobrador') ? 8 : 0) + (x.p.pk ? 15 : 0) })).sort((a, b) => b.v - a.v);
}
const CARD_ROLE = { CB:1.2, CDM:1.5, LB:1, RB:1, LWB:1, RWB:1, CM:0.9, CAM:0.5, LM:0.6, RM:0.6, LW:0.4, RW:0.4, ST:0.5, CF:0.5, GK:0.1 };
function pickCard(state, team) { return wpick(onField(state, team).map(x => ({ id: x.id, w: (CARD_ROLE[x.pos] || 0.5) * (x.p.s[5] / 80) * (hasK(x.p, 'Xerife') || hasK(x.p, 'Pivô') ? 1.5 : 1) }))); }
const gkId = team => team.lineup[FORMATIONS[team.formation].findIndex(s => s.pos === 'GK')];

/* Estilos de jogo (táticas): mexem nos setores, na posse e no ritmo da partida */
export const TACTICS = {
  equilibrado: { n: 'Equilibrado', i: '⚖️', d: 'Sem mudanças: o time joga como foi montado.', a: 0, m: 0, df: 0, pos: 0, sh: 0, fo: 0, off: 0 },
  ofensivo: { n: 'Ofensivo', i: '🔥', d: 'Ataque +3, defesa −3. Mais chutes, mais impedimentos.', a: 3, m: 0, df: -3, pos: 3, sh: 3, fo: 0, off: 0.8 },
  retranca: { n: 'Retranca', i: '🧱', d: 'Defesa +3, ataque −3. Menos posse e menos chances para os dois lados.', a: -3, m: -1, df: 3, pos: -7, sh: -3, fo: 2, off: -0.4 },
  posse: { n: 'Toque de bola', i: '🔁', d: 'Meio +2 e muito mais posse. Sofre contra o contra-ataque.', a: 0, m: 2, df: 0, pos: 9, sh: -1, fo: -2, off: -0.2 },
  contra: { n: 'Contra-ataque', i: '⚡', d: 'Abre mão da bola. Ataque +3 contra quem é ofensivo ou de toque de bola.', a: 0, m: -1, df: 1, pos: -8, sh: 0, fo: 0, off: 0.6 },
  pressao: { n: 'Pressão alta', i: '🏃', d: 'Meio +2 e ataque +1, defesa −1. Mais faltas e cartões; anula o toque de bola.', a: 1, m: 2, df: -1, pos: 3, sh: 1, fo: 4, off: 0.2 },
};
export const TACTIC_NAMES = Object.keys(TACTICS);
const tac = t => TACTICS[t.tactic] || TACTICS.equilibrado;
// bots (e quem está no piloto automático) escolhem o estilo olhando o adversário
function botTactics(state, h, a) {
  for (const [t, o] of [[h, a], [a, h]]) {
    if (!botLike(t)) continue;
    const s = strength(state, t), x = strength(state, o), gap = (s.a + s.m + s.d) - (x.a + x.m + x.d);
    if (Math.random() < 0.25) t.tactic = pick(TACTIC_NAMES);
    else if (gap > 6) t.tactic = s.m >= x.m ? pick(['posse', 'ofensivo']) : 'ofensivo';
    else if (gap < -6) t.tactic = (o.tactic === 'ofensivo' || o.tactic === 'posse') ? 'contra' : pick(['retranca', 'contra']);
    else t.tactic = pick(['equilibrado', 'pressao', 'equilibrado']);
  }
}
// força de cada setor já com o estilo de jogo e o duelo de estilos aplicados
export function matchup(state, h, a) {
  const sh = { ...strength(state, h) }, sa = { ...strength(state, a) };
  const apply = (s, t, o) => {
    const T = tac(t), O = tac(o);
    s.a += T.a; s.m += T.m; s.d += T.df;
    if (t.tactic === 'contra' && (o.tactic === 'ofensivo' || o.tactic === 'posse')) s.a += 3;
    if (t.tactic === 'pressao' && o.tactic === 'posse') s.m += 2;
    if (O && o.tactic === 'retranca' && t.tactic === 'posse') s.a -= 1;
  };
  apply(sh, h, a); apply(sa, a, h);
  return { h: sh, a: sa };
}
const r1 = v => Math.round(v);
export function playMatch(state, h, a, knockout, neutral) {
  const mu = matchup(state, h, a), sh = mu.h, sa = mu.a;
  const pow = s => 0.65 * s.a + 0.35 * s.m, wall = s => 0.7 * s.d + 0.3 * s.m;
  const lh = Math.min(4.2, Math.max(.2, (neutral ? 1.28 : 1.38) * Math.exp(0.1 * (pow(sh) - wall(sa)))));
  const la = Math.min(4.2, Math.max(.2, (neutral ? 1.28 : 1.16) * Math.exp(0.1 * (pow(sa) - wall(sh)))));
  const ev = [], T = { h, a }, O = { h: a, a: h }, L = { h: lh, a: la };
  const minute = () => Math.min(90, Math.max(1, Math.round(rnd(0.5, 90.4)))) + Math.random() * 0.9;
  for (const side of ['h', 'a']) {
    const team = T[side], opp = O[side];
    const g = poisson(L[side]);
    for (let i = 0; i < g; i++) {
      const r = Math.random(); let kind = 'jogada';
      if (r < 0.09) kind = 'penalti'; else if (r < 0.15) kind = 'falta'; else if (r < 0.31) kind = 'cabeca';
      let p, as = null;
      if (kind === 'penalti' || kind === 'falta') { const tk = takers(state, team); p = (kind === 'falta' ? tk.find(x => getP(state, x.id).pk) || tk.find(x => hasK(getP(state, x.id), 'Cobrador')) || tk[0] : tk[0]).id; }
      else p = pickScorer(state, team, kind === 'cabeca');
      if ((kind === 'jogada' || kind === 'cabeca') && Math.random() < 0.78) as = pickAssist(state, team, p);
      ev.push({ m: minute(), t: 'gol', s: side, kind, p, as });
    }
    const pm = poisson(0.06); for (let i = 0; i < pm; i++) ev.push({ m: minute(), t: 'penperdido', s: side, p: takers(state, team)[0].id, gk: gkId(opp) });
    const TS = tac(team), TO = tac(opp), shotK = Math.max(0.5, 1 + (TS.sh - (TO.tactic === 'retranca' ? 1 : 0)) * 0.08);
    const sv = poisson(L[side] * 1.7 * shotK); for (let i = 0; i < sv; i++) ev.push({ m: minute(), t: 'defesa', s: side, p: pickScorer(state, team, false), gk: gkId(opp) });
    const ch = poisson((L[side] * 1.8 + 1) * shotK); for (let i = 0; i < ch; i++) ev.push({ m: minute(), t: 'chance', s: side, p: pickScorer(state, team, Math.random() < .25) });
    const y = poisson(1.5 + TS.fo * 0.15); const booked = new Set();
    for (let i = 0; i < y; i++) { const p = pickCard(state, team); if (booked.has(p)) continue; booked.add(p); ev.push({ m: minute(), t: 'amarelo', s: side, p }); }
    if (Math.random() < 0.035) ev.push({ m: minute(), t: 'vermelho', s: side, p: pickCard(state, team) });
  }
  ev.sort((x, y) => x.m - y.m);
  const hg = ev.filter(e => e.t === 'gol' && e.s === 'h').length, ag = ev.filter(e => e.t === 'gol' && e.s === 'a').length;
  const m = { h: h.id, a: a.id, hg, ag, ev, played: true };
  m.sh = ev.filter(e => e.t === 'gol' && e.s === 'h').map(e => e.p); m.sa = ev.filter(e => e.t === 'gol' && e.s === 'a').map(e => e.p);
  if (knockout && hg === ag) {
    const kp = (t, o) => 0.75 + (strength(state, t).a - strength(state, o).d) * 0.004;
    const th = takers(state, h), ta = takers(state, a); const shoot = []; let ph = 0, pa = 0, i = 0;
    while (true) {
      const kh = Math.random() < kp(h, a), ka = Math.random() < kp(a, h);
      shoot.push({ s: 'h', p: th[i % th.length].id, ok: kh }); if (kh) ph++;
      shoot.push({ s: 'a', p: ta[i % ta.length].id, ok: ka }); if (ka) pa++;
      i++; if (i >= 5 && ph !== pa) break; if (i > 30) { if (ph === pa) { ph++; shoot[shoot.length - 2].ok = true; } break; }
    }
    m.pens = [ph, pa]; m.shoot = shoot;
  }
  m.w = hg > ag ? h.id : ag > hg ? a.id : m.pens ? (m.pens[0] > m.pens[1] ? h.id : a.id) : null;
  // notas dos jogadores
  m.r = {};
  for (const side of ['h', 'a']) {
    const team = T[side], conceded = side === 'h' ? ag : hg, res = m.w === team.id ? 0.35 : m.w ? -0.2 : 0.1;
    onField(state, team).forEach(x => {
      let n = 6.4 + rnd(-0.3, 0.3) + res + (x.p.o - 84) * 0.05;
      ev.forEach(e => {
        if (e.p === x.id && e.t === 'gol') n += 1;
        if (e.as === x.id) n += 0.6;
        if (e.p === x.id && e.t === 'amarelo') n -= 0.3;
        if (e.p === x.id && e.t === 'vermelho') n -= 1.2;
        if (e.gk === x.id && (e.t === 'defesa')) n += 0.25;
        if (e.gk === x.id && e.t === 'penperdido') n += 1;
      });
      if (x.pos === 'GK') n += conceded === 0 ? 0.8 : -0.3 * conceded;
      else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(x.pos)) n += conceded === 0 ? 0.5 : -0.15 * conceded;
      m.r[x.id] = Math.round(Math.min(10, Math.max(3, n)) * 10) / 10;
    });
  }
  m.mvp = +Object.entries(m.r).sort((x, y) => y[1] - x[1])[0][0];
  m.st = matchStats(state, h, a, sh, sa, ev);
  m.cmp = { h: { a: r1(sh.a), m: r1(sh.m), d: r1(sh.d), t: h.tactic || 'equilibrado' }, a: { a: r1(sa.a), m: r1(sa.m), d: r1(sa.d), t: a.tactic || 'equilibrado' } };
  m.why = whyText(state, m, h, a, sh, sa);
  return m;
}

// estatísticas da partida, coerentes com os lances sorteados
function matchStats(state, h, a, sh, sa, ev) {
  const T = { h, a }, S = { h: sh, a: sa }, out = {};
  let pos = 50 + (sh.m - sa.m) * 1.7 + (tac(h).pos - tac(a).pos) * 0.9 + rnd(-3, 3);
  pos = Math.round(Math.min(72, Math.max(28, pos)));
  for (const side of ['h', 'a']) {
    const o = side === 'h' ? 'a' : 'h', team = T[side], st = S[side], my = side === 'h' ? pos : 100 - pos, TS = tac(team);
    const n = t => ev.filter(e => e.s === side && e.t === t).length;
    const gol = n('gol'), sav = n('defesa'), pp = n('penperdido'), miss = n('chance');
    const onT = gol + sav + pp;
    const shots = onT + miss + poisson(1.5 + Math.max(0, TS.sh) * 0.4);
    const passes = Math.round(my * (9.2 + TS.pos * 0.12) + rnd(-25, 25));
    const acc = Math.round(Math.min(93, Math.max(68, 76 + (st.m - 80) * 0.5 + TS.pos * 0.5 + rnd(-2, 2))));
    out[side] = {
      pos: my, shots, onT, passes, acc,
      saves: ev.filter(e => e.s === o && (e.t === 'defesa' || e.t === 'penperdido')).length,
      off: poisson(Math.max(0.3, 1.5 + TS.off)), corners: poisson(Math.max(1, 3 + (st.a - S[o].d) * 0.15 + TS.sh * 0.3)),
      fouls: poisson(11 + TS.fo), ya: n('amarelo'), rc: n('vermelho'),
    };
  }
  return out;
}
// uma frase que explica o resultado
function whyText(state, m, h, a, sh, sa) {
  const T = { h, a }, S = { h: sh, a: sa }, st = m.st;
  const nm = side => T[side].name, o = side => side === 'h' ? 'a' : 'h';
  const winS = m.hg > m.ag ? 'h' : m.ag > m.hg ? 'a' : null;
  const opts = [];
  if (winS) {
    const l = o(winS), W = S[winS], Lo = S[l];
    const atkGap = W.a - Lo.d, midGap = W.m - Lo.m, defGap = W.d - Lo.a;
    if (st[l].shots >= st[winS].shots + 4) opts.push([5, `${nm(l)} chutou mais (${st[l].shots} × ${st[winS].shots}), mas parou no goleiro: ${st[winS].saves} defesas.`]);
    if (midGap >= 3) opts.push([midGap, `O meio-campo do ${nm(winS)} ganhou a briga (${r1(W.m)} × ${r1(Lo.m)}) e ficou com ${st[winS].pos}% de posse.`]);
    if (atkGap >= 3) opts.push([atkGap, `O ataque do ${nm(winS)} foi demais para a defesa do ${nm(l)} (${r1(W.a)} × ${r1(Lo.d)}).`]);
    if (defGap >= 4) opts.push([defGap - 1, `A defesa do ${nm(winS)} segurou o ataque do ${nm(l)} (${r1(W.d)} × ${r1(Lo.a)}).`]);
    const sp = m.ev.filter(e => e.t === 'gol' && e.s === winS && (e.kind === 'penalti' || e.kind === 'falta' || e.kind === 'cabeca')).length;
    if (sp && sp >= Math.abs(m.hg - m.ag)) opts.push([3.5, `A bola parada decidiu: ${sp} ${sp > 1 ? 'gols' : 'gol'} do ${nm(winS)} em falta, pênalti ou cabeçada.`]);
    if (m.ev.some(e => e.t === 'vermelho' && e.s === l)) opts.push([4, `O cartão vermelho complicou a vida do ${nm(l)}.`]);
    if (T[winS].tactic === 'contra' && st[winS].pos < 45) opts.push([4.5, `O contra-ataque funcionou: o ${nm(winS)} venceu com só ${st[winS].pos}% de posse.`]);
    if (W.a + W.m + W.d < Lo.a + Lo.m + Lo.d - 4) opts.push([4.2, `Zebra! No papel o ${nm(l)} era mais forte, mas o ${nm(winS)} foi mais eficiente.`]);
    if (!opts.length) opts.push([1, `Jogo parelho, decidido nos detalhes a favor do ${nm(winS)}.`]);
  } else {
    if (T.h.tactic === 'retranca' || T.a.tactic === 'retranca') { const s = T.h.tactic === 'retranca' ? 'h' : 'a'; opts.push([3, `A retranca do ${nm(s)} funcionou e segurou o empate.`]); }
    if (Math.abs(st.h.shots - st.a.shots) >= 5) { const s = st.h.shots > st.a.shots ? 'h' : 'a'; opts.push([2, `O ${nm(s)} chutou mais (${st[s].shots} × ${st[o(s)].shots}), mas não conseguiu a vitória.`]); }
    opts.push([1, m.hg === 0 ? 'Defesas por cima: ninguém conseguiu furar o bloqueio.' : 'Times equilibrados, empate justo.']);
  }
  return opts.sort((x, y) => y[0] - x[0])[0][1];
}

/* ---------------- Campeonato ---------------- */
function roundRobin(ids, doubleLeg) {
  const arr = shuffle(ids.slice()); if (arr.length % 2) arr.push(null);
  const n = arr.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const ms = [];
    for (let i = 0; i < n / 2; i++) { const x = arr[i], y = arr[n-1-i]; if (x && y) ms.push(r % 2 ? { h:y, a:x } : { h:x, a:y }); }
    rounds.push(ms); arr.splice(1, 0, arr.pop());
  }
  return doubleLeg ? rounds.concat(rounds.map(ms => ms.map(m => ({ h:m.a, a:m.h })))) : rounds;
}
const emptyRow = id => ({ id, j:0, v:0, e:0, d:0, gp:0, gc:0, pts:0 });
export function koName(n) { return ({2:'Final',4:'Semifinal',8:'Quartas de final',16:'Oitavas de final'})[n] || 'Mata-mata'; }
function buildKO(seeded) {
  let size = 1; while (size < seeded.length) size *= 2;
  const arr = seeded.slice(); while (arr.length < size) arr.push(null);
  const ms = []; for (let i = 0; i < size / 2; i++) ms.push({ h: arr[i], a: arr[size-1-i] });
  return ms;
}
export function sortTable(state, rows) {
  return rows.slice().sort((x, y) => y.pts - x.pts || (y.gp - y.gc) - (x.gp - x.gc) || y.gp - x.gp || y.v - x.v
    || teamOvr(state, state.teams.find(t => t.id === y.id)) - teamOvr(state, state.teams.find(t => t.id === x.id)));
}
export function createCup(state) {
  const ids = state.teams.map(t => t.id);
  let format = state.settings.format;
  if (format === 'grupos' && ids.length < 6) format = 'liga';
  const cup = { format, phase: null, ri: 0, ko: [], done: false, live: null, speed: LIVE_DEFAULT };
  if (format === 'liga') { cup.phase = 'liga'; cup.rounds = roundRobin(ids, ids.length <= 4); cup.table = ids.map(emptyRow); }
  else if (format === 'mata') { cup.phase = 'ko'; cup.ko = [buildKO(shuffle(ids.slice()))]; }
  else {
    cup.phase = 'grupos';
    const g = Math.ceil(ids.length / 4), sh = shuffle(ids.slice());
    cup.groups = Array.from({ length: g }, (_, i) => ({ name: 'Grupo ' + 'ABCDEFGH'[i], teams: [] }));
    sh.forEach((id, i) => cup.groups[i % g].teams.push(id));
    cup.groups.forEach(gr => { gr.rounds = roundRobin(gr.teams, false); gr.table = gr.teams.map(emptyRow); });
    cup.groupRounds = Math.max(...cup.groups.map(gr => gr.rounds.length));
  }
  return cup;
}
export function applyTable(table, m) {
  const A = table.find(r => r.id === m.h), B = table.find(r => r.id === m.a);
  A.j++; B.j++; A.gp += m.hg; A.gc += m.ag; B.gp += m.ag; B.gc += m.hg;
  if (m.hg > m.ag) { A.v++; B.d++; A.pts += 3; } else if (m.hg < m.ag) { B.v++; A.d++; B.pts += 3; } else { A.e++; B.e++; A.pts++; B.pts++; }
}
const T = (state, id) => state.teams.find(t => t.id === id);
// partidas da rodada atual (com o grupo anotado)
export function currentRound(state) {
  const cup = state.cup; if (!cup || cup.done) return [];
  if (cup.phase === 'liga') return cup.rounds[cup.ri] || [];
  if (cup.phase === 'grupos') return cup.groups.flatMap(gr => (gr.rounds[cup.ri] || []).map(m => { m.g = gr.name; return m; }));
  return cup.ko[cup.ko.length - 1];
}
export function nextTitle(state) {
  const cup = state.cup; if (!cup || cup.done) return '';
  if (cup.phase === 'liga') return `Rodada ${cup.ri + 1} de ${cup.rounds.length}`;
  if (cup.phase === 'grupos') return `Fase de grupos · rodada ${cup.ri + 1} de ${cup.groupRounds}`;
  return koName(cup.ko[cup.ko.length - 1].length * 2);
}
export function upcoming(state) { return currentRound(state).filter(m => m.h && m.a && !m.played); }

/* Relógio da rodada ao vivo: 1x = 12 minutos reais para 90 minutos (dois tempos de 6 min) */
const RATE_1X = 90 / 720000; export const HT_MS = 3500;
// ritmos: 6x = 2 min por jogo, 12x = 1 min (padrão), 24x = 30 s
export const SPEEDS_LIVE = [6, 12, 24]; export const LIVE_DEFAULT = 12;
export const LIVE_LABEL = { 6: '2 min/jogo', 12: '1 min/jogo', 24: '30 s/jogo' };
function liveParts(l, now) {
  const rate = RATE_1X * l.speed, el = Math.max(0, now - l.at);
  if (l.base < 45) { const t1 = (45 - l.base) / rate; if (el < t1) return { m: l.base + el * rate, ht: false }; if (el < t1 + HT_MS) return { m: 45, ht: true }; return { m: Math.min(90, 45 + (el - t1 - HT_MS) * rate), ht: false }; }
  return { m: Math.min(90, l.base + el * rate), ht: false };
}
export const liveMinute = (l, now) => liveParts(l, now).m;
export const isHalftime = (l, now) => liveParts(l, now).ht;
export function startRound(state, now, speed) {
  const cup = state.cup; if (!cup || cup.done || cup.live) return;
  const ms = currentRound(state);
  ms.forEach(m => {
    if (m.played) return;
    if (!m.h || !m.a) { m.played = true; m.bye = true; m.w = m.h || m.a; return; }
    botTactics(state, T(state, m.h), T(state, m.a));
    Object.assign(m, playMatch(state, T(state, m.h), T(state, m.a), cup.phase === 'ko', cup.phase === 'ko'));
  });
  cup.live = { at: now, base: 0, speed: speed || cup.speed || LIVE_DEFAULT, title: nextTitle(state), endAt: 0 };
}
export function setLiveSpeed(state, now, speed) {
  const l = state.cup && state.cup.live; if (!l) return;
  const pp = liveParts(l, now); l.base = pp.ht ? 45 : pp.m; l.at = now; l.speed = speed; state.cup.speed = speed;
}
export function skipLive(state, now) { const l = state.cup && state.cup.live; if (!l) return; l.base = 90; l.at = now; }
// chamado pelo anfitrião: encerra a rodada ao vivo quando o relógio chega aos 90'
export function tickLive(state, now) {
  const l = state.cup && state.cup.live; if (!l) return false;
  if (liveMinute(l, now) < 90) return false;
  if (!l.endAt) { l.endAt = now; return true; }
  const pens = currentRound(state).some(m => m.pens);
  if (now - l.endAt > (pens ? 6500 : 2500)) { commitRound(state); return true; }
  return false;
}
export function commitRound(state) {
  const cup = state.cup; if (!cup || cup.done) return;
  const ms = currentRound(state);
  if (ms.some(m => !m.played)) { cup.live = cup.live || { at: Date.now(), base: 90, speed: 6 }; ms.forEach(m => { if (!m.played) { if (!m.h || !m.a) { m.played = true; m.bye = true; m.w = m.h || m.a; } else { botTactics(state, T(state, m.h), T(state, m.a)); Object.assign(m, playMatch(state, T(state, m.h), T(state, m.a), cup.phase === 'ko', cup.phase === 'ko')); } } }); }
  cup.last = { title: nextTitle(state), matches: ms.filter(m => !m.bye) };
  cup.live = null;
  if (cup.phase === 'liga') {
    ms.forEach(m => applyTable(cup.table, m)); cup.ri++;
    if (cup.ri >= cup.rounds.length) finishCup(state, sortTable(state, cup.table).map(r => r.id));
    return;
  }
  if (cup.phase === 'grupos') {
    cup.groups.forEach(gr => (gr.rounds[cup.ri] || []).forEach(m => applyTable(gr.table, m)));
    cup.ri++;
    if (cup.ri >= cup.groupRounds) {
      const firsts = [], seconds = [];
      cup.groups.forEach(gr => { const st = sortTable(state, gr.table); firsts.push(st[0]); seconds.push(st[1]); });
      const rank = rows => sortTable(state, rows).map(r => r.id);
      const f1 = rank(firsts), s2 = rank(seconds);
      if (cup.groups.length === 2) cup.ko = [[{ h: f1[0], a: s2.find(id => !sameGroup(cup, id, f1[0])) || s2[1] }, { h: f1[1], a: s2.find(id => !sameGroup(cup, id, f1[1])) || s2[0] }]];
      else cup.ko = [buildKO(f1.concat(s2))];
      cup.phase = 'ko'; cup.ri = 0;
    }
    return;
  }
  if (ms.length === 1) {
    const f = ms[0]; const champ = f.w, vice = f.w === f.h ? f.a : f.h;
    const semis = cup.ko.length > 1 ? cup.ko[cup.ko.length - 2].filter(m => !m.bye).map(m => m.w === m.h ? m.a : m.h) : [];
    const rest = state.teams.map(t => t.id).filter(id => id !== champ && id !== vice && !semis.includes(id));
    finishCup(state, [champ, vice, ...semis, ...rest]);
  } else {
    const w = ms.map(m => m.w), nr = []; for (let i = 0; i < w.length; i += 2) nr.push({ h: w[i], a: w[i+1] });
    cup.ko.push(nr);
  }
}
// simula uma rodada inteira na hora (sem assistir)
export function advanceCup(state) { const now = Date.now(); startRound(state, now, 6); commitRound(state); }
function sameGroup(cup, a, b) { return cup.groups.some(g => g.teams.includes(a) && g.teams.includes(b)); }
function finishCup(state, order) {
  state.cup.done = true; state.cup.final = order; state.phase = 'end';
  // histórico da sala (vale para as próximas partidas na mesma sala)
  const rec = state.record = state.record || {};
  state.teams.forEach(t => { const r = rec[t.id] = rec[t.id] || { name: t.name, coach: t.coach, ed: 0, tit: 0, vice: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }; r.name = t.name; r.coach = t.coach; r.ed++; });
  rec[order[0]].tit++; if (order[1] && rec[order[1]]) rec[order[1]].vice++;
  allMatches(state).forEach(m => {
    const A = rec[m.h], B = rec[m.a]; if (!A || !B) return;
    A.j++; B.j++; A.gp += m.hg; A.gc += m.ag; B.gp += m.ag; B.gc += m.hg;
    if (m.w === m.h) { A.v++; B.d++; } else if (m.w === m.a) { B.v++; A.d++; } else { A.e++; B.e++; }
  });
}
export function allMatches(state) {
  const cup = state.cup; if (!cup) return [];
  const out = [];
  if (cup.rounds) cup.rounds.flat().forEach(m => m.played && out.push(m));
  if (cup.groups) cup.groups.forEach(g => g.rounds.flat().forEach(m => m.played && out.push(m)));
  cup.ko.flat().forEach(m => m.played && !m.bye && out.push(m));
  return out;
}
// estatísticas por jogador (apenas partidas já encerradas, ou até o minuto informado na rodada ao vivo)
export function playerStats(state, upto) {
  const cup = state.cup, st = new Map();
  const liveSet = new Set(cup && cup.live ? currentRound(state) : []);
  const get = (id, team) => { const k = id + '|' + team; if (!st.has(k)) st.set(k, { id, team, j: 0, g: 0, a: 0, gf: 0, gp: 0, gh: 0, ya: 0, rc: 0, sv: 0, ps: 0, cs: 0, nt: 0, mvp: 0 }); return st.get(k); };
  allMatches(state).forEach(m => {
    const live = liveSet.has(m), lim = live ? (upto ?? 0) : 999;
    const tid = s => s === 'h' ? m.h : m.a, oth = s => s === 'h' ? m.a : m.h;
    m.ev.forEach(e => {
      if (e.m > lim) return;
      if (e.t === 'gol') { const r = get(e.p, tid(e.s)); r.g++; if (e.kind === 'falta') r.gf++; if (e.kind === 'penalti') r.gp++; if (e.kind === 'cabeca') r.gh++; if (e.as != null) get(e.as, tid(e.s)).a++; }
      if (e.t === 'amarelo') get(e.p, tid(e.s)).ya++;
      if (e.t === 'vermelho') get(e.p, tid(e.s)).rc++;
      if (e.t === 'defesa') get(e.gk, oth(e.s)).sv++;
      if (e.t === 'penperdido') { const r = get(e.gk, oth(e.s)); r.sv++; r.ps++; }
    });
    if (!live || lim >= 90) {
      for (const side of ['h', 'a']) {
        const team = T(state, tid(side)); if (!team) continue;
        team.lineup.forEach(id => { const r = get(id, team.id); r.j++; if (m.r && m.r[id] != null) r.nt += m.r[id]; });
        const conceded = side === 'h' ? m.ag : m.hg; if (conceded === 0) get(gkId(team), team.id).cs++;
      }
      if (m.mvp != null) { const side = T(state, m.h).lineup.includes(m.mvp) ? m.h : m.a; get(m.mvp, side).mvp++; }
    }
  });
  return [...st.values()];
}
export function topScorers(state, n) { return playerStats(state).filter(r => r.g > 0).sort((a, b) => b.g - a.g || b.a - a.a).slice(0, n); }

/* ---------------- Motor do leilão (anfitrião) ---------------- */
export function newRoomState(code, host, settings) {
  return { v: 0, code, hostId: host.id, phase: 'lobby', settings, teams: [mkTeam(host.id, host.name, host.team, false, 0)],
    lot: null, lotNo: 0, pool: null, log: [], history: [], penal: {}, base: {}, cup: null, lineupEndsAt: 0 };
}
export function mkTeam(id, coach, name, bot, idx) {
  return { id, coach, name: name || ('FC ' + coach), bot, color: COLORS[idx % COLORS.length], budget: 100, squad: [], formation: '4-3-3', tactic: 'equilibrado', lineup: null, ready: false, paid: {}, pers: bot ? botPersona() : null };
}
function botPersona() { return pick([{ n:'Gastador', k:1.3 }, { n:'Pão-duro', k:0.78 }, { n:'Equilibrado', k:1 }, { n:'Caçador de craques', k:0, star:true }, { n:'Apostador', k:0, wild:true }]); }

// Pote da partida: ~25% a mais de jogadores de linha do que as vagas e goleiros de sobra,
// sorteados mantendo a proporção de craques (89+), bons (85–88) e o resto (81–84)
export const SECTORS = [['Goleiros','🧤'], ['Defensores','🛡️'], ['Meio-campistas','⚙️'], ['Atacantes','⚽']];
export const lineOf = p => LINE[p.p] ?? 2;
export function buildPool(nTeams, bySector) {
  const ids = PLAYERS.map((_, i) => i);
  const gks = ids.filter(i => isGK(PLAYERS[i])), fields = ids.filter(i => !isGK(PLAYERS[i]));
  const strat = (list, k) => {
    if (k >= list.length) return list.slice();
    const tiers = [list.filter(i => PLAYERS[i].o >= 89), list.filter(i => PLAYERS[i].o >= 85 && PLAYERS[i].o < 89), list.filter(i => PLAYERS[i].o < 85)];
    const out = []; tiers.forEach(t => { shuffle(t); out.push(...t.slice(0, Math.round(k * t.length / list.length))); });
    const rest = shuffle(list.filter(i => !out.includes(i))); while (out.length < k && rest.length) out.push(rest.pop());
    return out.slice(0, k);
  };
  if (bySector) { // leilão por setor: sobra garantida em cada linha
    const q = { 1: 4.1, 2: 3.7, 3: 2.7 };
    return strat(gks, Math.ceil(nTeams * 1.5) + 1).concat(...[1, 2, 3].map(l => strat(fields.filter(i => lineOf(PLAYERS[i]) === l), Math.ceil(nTeams * q[l] * 1.3))));
  }
  return strat(gks, Math.ceil(nTeams * 1.5) + 1).concat(strat(fields, Math.ceil(nTeams * 10 * 1.25)));
}
// quantos jogadores daquela linha o time ainda quer, pela formação
function lineNeed(state, t, line) {
  if (slots(t) === 0) return 0;
  if (line === 0) return hasGK(state, t) ? 0 : 1;
  const want = FORMATIONS[t.formation].filter(s => LINE[s.pos] === line).length;
  const have = t.squad.map(id => getP(state, id)).filter(q => !isGK(q) && lineOf(q) === line).length;
  return Math.max(0, want - have);
}
export function startAuction(state) {
  const pool = buildPool(state.teams.length, state.settings.order === 'setor');
  state.sector = state.settings.order === 'setor' ? 0 : null;
  state.poolSize = pool.length; state.poolIds = pool.slice();
  state.pool = pool; state.phase = 'auction'; state.lotNo = 0; state.log = []; state.history = []; state.penal = {}; state.base = {};
  state.teams.forEach(t => { t.budget = state.settings.budget; t.squad = []; t.lineup = Array(11).fill(null); t.ready = false; t.paid = {}; });
  if (state.teams.some(t => t.bot)) state.teams.forEach(t => { if (t.bot) t.formation = pick(FORMATION_NAMES); });
  const ovr = PLAYERS.map(p => p.o); state.lo = Math.min(...ovr); state.hi = Math.max(...ovr);
}
export function addLog(state, msg) { state.log.unshift(msg); if (state.log.length > 14) state.log.length = 14; }

function botMax(state, t, p) {
  if (!needFor(state, t, p)) return 0;
  const s = slots(t), per = t.budget / s;
  const r = Math.max(0, (p.o - state.lo) / Math.max(1, state.hi - state.lo));
  const avg = state.settings.budget / 11;
  let v = 1 + Math.pow(r, 2) * avg * 4.2;
  v *= Math.min(1.9, Math.max(.35, per / avg));
  // dinheiro sobrando no fim do leilão: bot fica mais agressivo para não terminar com caixa parado
  if (per > avg) v += (per - avg) * (0.35 + r) * (s <= 4 ? 1.4 : 0.8);
  let k = t.pers.k; if (t.pers.star) k = r >= .6 ? 1.5 : .8; if (t.pers.wild) k = rnd(.65, 1.55);
  v *= k * rnd(.82, 1.2);
  // encaixe na formação do bot
  const slotsF = FORMATIONS[t.formation].map(s => s.pos);
  const bestFit = Math.max(...slotsF.map(sp => fit(p, sp)));
  const sameLine = slotsF.filter(sp => LINE[sp] === LINE[p.p]).length;
  const have = t.squad.map(id => getP(state, id)).filter(q => LINE[q.p] === LINE[p.p]).length;
  if (!isGK(p)) { v *= bestFit >= .97 ? 1.05 : .85; if (have >= sameLine) v *= .55; }
  v = Math.max(v, floorFor(state, p) * (r >= .5 ? 1.15 : 1));
  return Math.max(1, Math.min(Math.round(v), maxAllowed(t)));
}
export function chooseLot(state, now) {
  if (state.teams.every(t => slots(t) === 0)) return false;
  const needGK = state.teams.filter(t => slots(t) > 0 && !hasGK(state, t)).length;
  const needField = state.teams.reduce((s, t) => s + Math.max(0, 10 - fieldCount(state, t)), 0);
  const gks = state.pool.filter(id => isGK(PLAYERS[id])), fields = state.pool.filter(id => !isGK(PLAYERS[id]));
  let wantGK = needGK > 0 && (needField === 0 || Math.random() < needGK / (needGK + needField) * 1.15);
  let cands = wantGK ? gks : fields; if (!cands.length) cands = wantGK ? fields : gks;
  cands = cands.filter(id => state.teams.some(t => slots(t) > 0 && needFor(state, t, PLAYERS[id])));
  // leilão por setor: goleiros → defensores → meias → atacantes; depois, o que faltar sai livre
  if (state.sector != null) {
    while (state.sector < 4) {
      const L = state.sector;
      const sc = state.pool.filter(id => lineOf(PLAYERS[id]) === L && state.teams.some(t => needFor(state, t, PLAYERS[id]) && lineNeed(state, t, L) > 0));
      if (sc.length) { cands = sc; break; }
      state.sector++;
      if (state.sector < 4) addLog(state, `Agora é a vez dos ${SECTORS[state.sector][0].toLowerCase()}`);
    }
  }
  if (!cands.length) return false;
  const pid = pick(cands); state.pool.splice(state.pool.indexOf(pid), 1); state.lotNo++;
  const sp = SPEEDS[state.settings.speed];
  state.lot = { no: state.lotNo, pid, price: 0, leader: null, endsAt: now + sp.open * 1000, status: 'open', passed: [] };
  state._ai = {}; state.teams.forEach(t => { if (botLike(t)) state._ai[t.id] = { max: botMax(state, t, PLAYERS[pid]), next: now + rnd(900, 2600) }; });
  const humansIn = state.teams.filter(t => !botLike(t) && needFor(state, t, PLAYERS[pid]) && maxAllowed(t) >= 1);
  state.lot.auto = humansIn.length === 0;
  if (state.lot.auto) state.lot.endsAt = now + (state.teams.some(t => !botLike(t) && slots(t) > 0) ? 1400 : 700);
  return true;
}
export function placeBid(state, teamId, amount, now) {
  const lot = state.lot; if (!lot || lot.status !== 'open') return 'Lote encerrado';
  const t = state.teams.find(x => x.id === teamId); if (!t) return 'Time inválido';
  const p = PLAYERS[lot.pid];
  if (lot.leader === teamId) return 'Você já está na frente';
  if (!needFor(state, t, p)) return isGK(p) ? 'Você já tem goleiro' : 'Seu elenco de linha está completo';
  const min = minBid(state, t);
  if (amount < min) return 'Lance mínimo: R$ ' + min;
  if (amount > maxAllowed(t)) return 'Acima do seu limite';
  lot.price = amount; lot.leader = teamId; lot.passed = lot.passed.filter(id => id !== teamId);
  const sp = SPEEDS[state.settings.speed];
  lot.endsAt = Math.max(lot.endsAt, now + sp.reset * 1000);
  if (state._ai) for (const id in state._ai) if (id !== teamId && state._ai[id] && state._ai[id].next !== Infinity) state._ai[id].next = Math.max(state._ai[id].next, now + rnd(...sp.ai));
  return null;
}
function aiFor(state, t) {
  state._ai = state._ai || {};
  if (!state._ai[t.id] || state._ai[t.id].max == null) state._ai[t.id] = { max: botMax(state, t, PLAYERS[state.lot.pid]), next: Date.now() + rnd(600, 1500) };
  return state._ai[t.id];
}
function sealed(state) {
  const lot = state.lot, p = PLAYERS[lot.pid]; const bids = [];
  state.teams.forEach(t => {
    if (!botLike(t)) { if (lot.leader === t.id) bids.push({ id: t.id, max: lot.price }); return; }
    if (!needFor(state, t, p)) return;
    const ai = aiFor(state, t);
    const m = Math.min(ai.max, maxAllowed(t));
    const floor = lot.leader === t.id ? lot.price : lot.price + 1;
    if (lot.leader === t.id) bids.push({ id: t.id, max: Math.max(m, lot.price) }); else if (m >= floor) bids.push({ id: t.id, max: m });
  });
  if (!bids.length) return { id: null, price: 0 };
  shuffle(bids).sort((a, b) => b.max - a.max);
  const w = bids[0], floor = lot.leader === w.id ? lot.price : lot.price + 1;
  let price = bids.length === 1 ? Math.max(1, floor) : Math.min(w.max, Math.max(floor, bids[1].max + 1));
  const wt = state.teams.find(t => t.id === w.id);
  price = Math.max(price, Math.min(floorFor(state, p), maxAllowed(wt)));
  return { id: w.id, price: Math.max(1, price) };
}
export function passLot(state, teamId) {
  const lot = state.lot; if (!lot || lot.status !== 'open' || lot.leader === teamId) return;
  if (!lot.passed.includes(teamId)) lot.passed.push(teamId);
}
function closeLot(state, winnerId, price, now) {
  const lot = state.lot, p = PLAYERS[lot.pid];
  lot.status = winnerId ? 'sold' : 'nosale'; lot.winner = winnerId; lot.price = price; lot.closedAt = now;
  state.history.push({ no: lot.no, pid: lot.pid, team: winnerId || null, price: winnerId ? price : 0 });
  if (winnerId) {
    const t = state.teams.find(x => x.id === winnerId); t.budget -= price; t.squad.push(lot.pid); t.paid[lot.pid] = price;
    placeNew(state, t, lot.pid);
    addLog(state, `${p.n} → ${t.name} por R$ ${price}`);
  } else addLog(state, `${p.n} ficou sem lance`);
}
// chamado a cada ~200ms no anfitrião; devolve true se o estado mudou
export function tickAuction(state, now) {
  if (state.phase !== 'auction') return false;
  const lot = state.lot, sp = SPEEDS[state.settings.speed];
  if (!lot || lot.status !== 'open') {
    const fast = state.teams.every(t => botLike(t) || slots(t) === 0);
    if (!lot || now - lot.closedAt > (lot && lot.auto ? (fast ? 500 : 1100) : sp.after)) {
      if (!chooseLot(state, now)) { endAuction(state); }
      return true;
    }
    return false;
  }
  // todos os humanos que podem disputar passaram → resolve na hora
  const humansIn = state.teams.filter(t => !botLike(t) && needFor(state, t, PLAYERS[lot.pid]) && maxAllowed(t) >= 1);
  const allPassed = humansIn.length > 0 && humansIn.every(t => lot.passed.includes(t.id)) && !humansIn.some(t => t.id === lot.leader);
  if (lot.auto || allPassed) {
    if (lot.auto && now < lot.endsAt) return false;
    const r = sealed(state); closeLot(state, r.id, r.price, now); return true;
  }
  // ninguém (além de quem está na frente) tem dinheiro para cobrir → fecha na hora: vende ao líder ou descarta
  const canCover = state.teams.some(t => t.id !== lot.leader && needFor(state, t, PLAYERS[lot.pid]) && maxAllowed(t) >= minBid(state, t));
  if (!canCover) { closeLot(state, lot.leader, lot.price, now); lot.quick = true; return true; }
  let changed = false;
  for (const t of state.teams) {
    if (!botLike(t) || lot.leader === t.id) continue;
    const a = aiFor(state, t); if (now < a.next) continue;
    const min = minBid(state, t), cap = Math.min(a.max, maxAllowed(t));
    if (cap >= min && needFor(state, t, PLAYERS[lot.pid])) {
      let inc = 1; const gap = cap - min;
      if (gap > 10 && Math.random() < .45) inc = pick([2,3,5]);
      if (gap > 22 && Math.random() < .25) inc = pick([5,10]);
      placeBid(state, t.id, Math.min(cap, min + inc - 1), now);
      a.next = now + rnd(...sp.ai) * 1.4; changed = true; break;
    } else a.next = Infinity;
  }
  if (now >= lot.endsAt) { closeLot(state, lot.leader, lot.price, now); return true; }
  return changed;
}
export function skipToEnd(state, now) {
  if (state.lot && state.lot.status === 'open') { const r = sealed(state); closeLot(state, r.id, r.price, now); }
  while (chooseLot(state, now)) { const r = sealed(state); closeLot(state, r.id, r.price, now); }
  endAuction(state);
}
// Vagas em branco: recebem o pior jogador que sobrou na posição (com −5 de rendimento); sem sobra, entra um Cria da Base
export function endAuction(state) {
  let bid = 1000; state.penal = state.penal || {};
  const takeWorst = filter => {
    const c = state.pool.filter(id => filter(PLAYERS[id])).sort((a, b) => PLAYERS[a].o - PLAYERS[b].o);
    if (!c.length) return null; state.pool.splice(state.pool.indexOf(c[0]), 1); return c[0];
  };
  state.teams.forEach(t => {
    if (!t.lineup || t.lineup.length !== 11) t.lineup = arrange(state, t, t.formation);
    const slotsF = FORMATIONS[t.formation];
    while (slots(t) > 0) {
      let id;
      if (!hasGK(state, t)) id = takeWorst(isGK);
      else {
        const free = slotsF.map((s, i) => t.lineup[i] == null && s.pos !== 'GK' ? s.pos : null).filter(Boolean);
        const want = free[0];
        id = want ? (takeWorst(p => !isGK(p) && fit(p, want) >= 0.97) ?? takeWorst(p => !isGK(p))) : takeWorst(p => !isGK(p));
      }
      if (id != null) { state.penal[id] = true; }
      else {
        const gk = !hasGK(state, t);
        state.base[bid] = { n: 'Cria da Base', o: Math.round(rnd(62, 68)), p: gk ? 'GK' : pick(['CB','CM','ST','LB','RB','CDM']), a: [], s: Array(6).fill(62), c: 'Brasil', t: 'Base', base: true };
        id = bid++;
      }
      t.squad.push(id); t.paid[id] = 0; placeNew(state, t, id);
      addLog(state, `${getP(state, id).n} completou o ${t.name} (vaga em branco)`);
    }
    if (t.bot) { const b = bestFormation(state, t.squad); t.formation = b.name; t.lineup = b.lineup; t.ready = true; }
    else { if (t.lineup.some(x => x == null)) t.lineup = autoLineup(state, t.squad, t.formation); t.ready = !!t.auto; }
  });
  state.lot = null; state.phase = 'lineup'; state.lineupEndsAt = Date.now() + 150000;
}
// coloca um jogador novo na melhor vaga livre do campinho
export function placeNew(state, t, id) {
  if (!t.lineup || t.lineup.length !== 11) t.lineup = Array(11).fill(null);
  if (t.lineup.includes(id)) return;
  const slotsF = FORMATIONS[t.formation] || FORMATIONS['4-3-3']; const p = getP(state, id);
  let best = -1, bv = -1;
  slotsF.forEach((s, i) => { if (t.lineup[i] != null) return; const v = fit(p, s.pos); if (v > bv) { bv = v; best = i; } });
  if (best >= 0) t.lineup[best] = id;
}
// reorganiza todo o elenco atual numa formação (mantém vagas vazias para o que falta)
export function arrange(state, t, formation) {
  const res = Array(11).fill(null), slotsF = FORMATIONS[formation];
  const ids = t.squad.slice().sort((a, b) => getP(state, b).o - getP(state, a).o);
  for (const id of ids) { let best = -1, bv = -1; slotsF.forEach((s, i) => { if (res[i] != null) return; const v = fit(getP(state, id), s.pos); if (v > bv) { bv = v; best = i; } }); if (best >= 0) res[best] = id; }
  return res;
}
// troca feita pelo técnico durante o leilão (lineup com vagas null)
export function setArrangement(state, teamId, formation, lineup) {
  const t = state.teams.find(x => x.id === teamId); if (!t || !FORMATIONS[formation] || !Array.isArray(lineup) || lineup.length !== 11) return;
  const ids = lineup.filter(x => x != null);
  if (new Set(ids).size !== ids.length || ids.length !== t.squad.length || !ids.every(id => t.squad.includes(id))) return;
  t.formation = formation; t.lineup = lineup.map(x => x == null ? null : x);
}
export function setLineup(state, teamId, formation, lineup) {
  const t = state.teams.find(x => x.id === teamId); if (!t || !FORMATIONS[formation]) return;
  if (!Array.isArray(lineup) || lineup.length !== 11) return;
  const a = lineup.slice().sort((x, y) => x - y).join(), b = t.squad.slice().sort((x, y) => x - y).join();
  if (a !== b) return;
  t.formation = formation; t.lineup = lineup;
}
export function startCup(state) {
  state.teams.forEach(t => { if (!t.lineup || t.lineup.some(x => x == null)) t.lineup = autoLineup(state, t.squad, t.formation); });
  state.cup = createCup(state); state.phase = 'cup';
}
