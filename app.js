// Acabou o dinheiro? — interface e sincronização
import * as E from './engine.js';
import { PLAYERS, setBase, BASE_NAMES, MODES, ovrRange } from './db.js';
import { openChannel, ONLINE, track } from './net.js';
import { play, isMuted, setMuted, playAcabou } from './sound.js';
import { resultImage } from './share.js';
import { rulesHTML } from './rules.js';
import { jerseySVG } from './kits.js';
import { specialIcon } from './traits.js';
import { createViewer } from './match.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const fmt = n => 'R$ ' + n;
const app = $('#app');

/* ---------- identidade ---------- */
function loadMe() {
  let id = null; try { id = sessionStorage.getItem('acabou-id'); } catch (e) {}
  if (!id) { id = Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem('acabou-id', id); } catch (e) {} }
  let saved = {}; try { saved = JSON.parse(localStorage.getItem('acabou-me') || '{}'); } catch (e) {}
  return { id, name: saved.name || '', team: saved.team || '' };
}
const me = loadMe();
const saveMe = () => { try { localStorage.setItem('acabou-me', JSON.stringify({ name: me.name, team: me.team })); } catch (e) {} };

/* ---------- estado global ---------- */
let ch = null, state = null, isHost = false, offset = 0, lastSeen = 0, code = null;
let loopIv = null, hbIv = null, joinIv = null, lobbyCh = null, view = null, lastStampKey = '';
const rooms = new Map();
const ui = { asel: null, settings: { base: 'europa', order: 'livre', budget: '100', max: '8', format: 'liga', speed: 'normal', hide: '0', pub: '1' }, sel: null, draft: null };

const P = id => E.getP(state, id);
const myTeam = () => state && state.teams.find(t => t.id === me.id);
const teamById = id => state.teams.find(t => t.id === id);
const hostNow = () => Date.now() + offset;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2200); }
function strip(s) { return JSON.parse(JSON.stringify(s, (k, v) => k === '_ai' ? undefined : v)); }
function genCode() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 5; i++) c += a[Math.floor(Math.random() * a.length)]; return c; }
const tn = id => { const t = teamById(id); return t ? `<span style="color:${t.color}">●</span> ${esc(t.name)}` : '<span style="color:var(--muted)">folga</span>'; };
const posLabel = p => E.POS_PT[p.p] || p.p;
function statusTag(t) {
  if (t.bot) return '';
  if (t.auto) return ' · <span class="st-off">piloto automático</span>';
  if (t.offSince) { const left = Math.max(0, Math.ceil((t.offSince + 60000 - hostNow()) / 1000)); return ` · <span class="st-off">reconectando ${left}s</span>`; }
  return '';
}
function setHTML(el, html) { if (el && el._h !== html) { el.innerHTML = html; el._h = html; } }

function updateBadge() {
  const b = $('#netbadge');
  if (!ONLINE) { b.className = 'netbadge warn'; b.textContent = 'modo local'; return; }
  if (state && !isHost && Date.now() - lastSeen > 7000) { b.className = 'netbadge warn'; b.textContent = 'sem sinal do anfitrião'; return; }
  b.className = 'netbadge on'; b.textContent = code ? 'online · sala ' + code : 'online';
}

/* ---------- rede ---------- */
function publish() {
  if (!isHost || !state) return;
  if (state.phase === 'end' && state.cup && !state.cup.tracked) {
    state.cup.tracked = true; const ch0 = teamById(state.cup.final[0]);
    track('campeonato_finalizado', { sala: code, formato: state.cup.format, tecnicos: state.teams.length, humanos: state.teams.filter(t => !t.bot).length, campeao_bot: !!(ch0 && ch0.bot) });
  }
  state.v++; state.hostNow = Date.now();
  if (ch) ch.send('state', strip(state));
  try { localStorage.setItem('acabou-host-' + code, JSON.stringify(state)); } catch (e) {}
  render();
}
function heartbeat() {
  if (!isHost || !state || !ch) return;
  state.hostNow = Date.now(); ch.send('state', strip(state));
  if (state.settings.pub && lobbyCh && state.phase === 'lobby') {
    lobbyCh.send('room', { code, name: state.teams[0].name, host: state.teams[0].coach, count: state.teams.length, max: state.settings.max, base: state.settings.base || 'europa', ts: Date.now() });
  }
}
let othersSeenAt = 0, pendingResume = null;
function onMsg(ev, p) {
  if (ev === 'react') { showReaction(p); return; }
  if (ev === 'action' && !isHost) { if (p && p.id !== me.id) othersSeenAt = Date.now(); return; }
  if (ev === 'state' && isHost) {
    // dois anfitriões ao mesmo tempo: fica o de "mandato" mais novo (empate: menor id)
    if (!p || p.code !== code || p.hostId === me.id) return;
    const mine = state.epoch || 0, theirs = p.epoch || 0;
    if (theirs > mine || (theirs === mine && String(p.hostId) < String(me.id))) stepDown(p);
    return;
  }
  if (ev === 'state' && !isHost) {
    if (!p || p.code !== code) return;
    if (state && p.hostNow < state.hostNow) return;
    const prevPhase = state && state.phase;
    if (p.rebind && p.rebind.from === me.id) { me.id = p.rebind.to; try { sessionStorage.setItem('acabou-id', me.id); } catch (e) {} toast('Você voltou para o seu time!'); }
    state = p; setBase(p.settings && p.settings.base); offset = p.hostNow - Date.now(); lastSeen = Date.now();
    if (state.teams.some(t => t.id === me.id)) { try { localStorage.setItem('acabou-member-' + code, me.id); } catch (e) {} }
    if (joinIv && (state.teams.some(t => t.id === me.id) || state.phase !== 'lobby')) { clearInterval(joinIv); joinIv = null; }
    if (prevPhase !== state.phase) { ui.sel = null; ui.draft = null; }
    render();
  } else if (ev === 'action' && isHost) handleAction(p);
}
function stepDown(p) {
  isHost = false; clearInterval(loopIv); clearInterval(hbIv);
  state = p; setBase(p.settings && p.settings.base); offset = p.hostNow - Date.now(); lastSeen = Date.now();
  if (ch) ch.send('action', { type: 'join', id: me.id, name: me.name, team: me.team });
  toast('Outro técnico está conduzindo a sala'); render();
}
// Anfitrião substituto: se o anfitrião some, o primeiro técnico conectado da lista assume a sala
function takeOver() {
  const old = state.hostId, off = offset, now = Date.now();
  const sh = v => (typeof v === 'number' && v > 1e12) ? v - off : v;
  if (state.lot) { state.lot.endsAt = Math.max(sh(state.lot.endsAt), now + 4000); state.lot.closedAt = sh(state.lot.closedAt); }
  if (state.cup && state.cup.live) { state.cup.live.at = sh(state.cup.live.at); state.cup.live.endAt = sh(state.cup.live.endAt); }
  state.lineupEndsAt = sh(state.lineupEndsAt);
  state.teams.forEach(t => { if (t.offSince) t.offSince = sh(t.offSince); });
  state.seen = {}; state.teams.forEach(t => state.seen[t.id] = now);
  const ot = teamById(old); if (ot && !ot.bot) { ot.offSince = now; state.seen[old] = now - 20000; }
  state.hostId = me.id; state.epoch = (state.epoch || 0) + 1; state._ai = {};
  if (!state.pool && state.phase === 'auction') { const used = new Set([...state.teams.flatMap(t => t.squad), ...(state.history || []).map(h => h.pid)]); state.pool = (state.poolIds || PLAYERS.map((_, i) => i)).filter(i => !used.has(i) && (!state.lot || state.lot.pid !== i)); }
  if (state.log) E.addLog(state, `${(myTeam() || {}).coach || me.name} assumiu a sala como anfitrião`);
  isHost = true; offset = 0; clearInterval(joinIv); joinIv = null;
  try { localStorage.setItem('acabou-member-' + code, me.id); } catch (e) {}
  startHostLoops(); publish(); toast('O anfitrião caiu: você está conduzindo a sala agora');
}
setInterval(() => {
  if (isHost || !state || !ch || !code || pendingResume || !navigator.onLine) return;
  const silent = Date.now() - lastSeen; if (silent < 9000) return;
  const humans = state.teams.filter(t => !t.bot && !t.auto && !t.offSince && t.id !== state.hostId);
  const rank = humans.findIndex(t => t.id === me.id); if (rank < 0) return;
  // só assume se tiver sinal de que a própria conexão está boa (ou se não houver mais ninguém)
  if (humans.length > 1 && Date.now() - othersSeenAt > 9000) return;
  if (silent > 9000 + rank * 6000) takeOver();
}, 1000);
function act(a) { a.id = me.id; if (isHost) handleAction(a); else if (ch) ch.send('action', a); }

const GRACE = 60000, OFFLINE_AFTER = 10000;
function handleAction(a) {
  if (!state || !a) return;
  const now = Date.now();
  state.seen = state.seen || {};
  // reconexão de outro aparelho/aba: assume o time antigo se ele estiver desconectado
  if (a.type === 'join' && a.claim && a.claim !== a.id) {
    const old = teamById(a.claim);
    if (old && !old.bot && old.id !== state.hostId && now - (state.seen[old.id] || 0) > 6000) {
      state.rebind = { from: a.id, to: old.id, at: now };
      state.seen[old.id] = now; old.offSince = null; E.setAuto(old, false);
      publish(); return;
    }
  }
  if (teamById(a.id)) {
    state.seen[a.id] = now;
    const tt = teamById(a.id);
    if (tt.offSince || tt.auto) { tt.offSince = null; if (tt.auto) { E.setAuto(tt, false); if (state.phase === 'lineup') tt.ready = false; } publish(); }
  }
  const t = teamById(a.id);
  switch (a.type) {
    case 'ping': break;
    case 'join': {
      if (!t) {
        if (state.phase !== 'lobby' || state.teams.length >= state.settings.max) { heartbeat(); return; }
        const used = state.teams.map(x => x.color); const idx = E.COLORS.findIndex(c => !used.includes(c));
        const nt = E.mkTeam(a.id, String(a.name || 'Técnico').slice(0, 18), String(a.team || '').slice(0, 22), false, Math.max(0, idx));
        state.teams.push(nt); state.seen[a.id] = now;
      } else if (state.phase === 'lobby') { t.coach = String(a.name || t.coach).slice(0, 18); if (a.team) t.name = String(a.team).slice(0, 22); }
      publish(); break;
    }
    case 'leave': if (t && state.phase === 'lobby' && a.id !== state.hostId) { state.teams = state.teams.filter(x => x !== t); publish(); } break;
    case 'tactic': if (t && E.TACTICS[a.tactic] && !(state.cup && state.cup.live)) { t.tactic = a.tactic; publish(); } break;
    case 'formation': if (t && E.FORMATIONS[a.formation] && (state.phase === 'lobby' || state.phase === 'auction')) { t.formation = a.formation; if (state.phase === 'auction') t.lineup = E.arrange(state, t, a.formation); publish(); } break;
    case 'arrange': if (t && state.phase === 'auction') { E.setArrangement(state, a.id, a.formation, a.lineup); publish(); } break;
    case 'bid': if (t && state.phase === 'auction' && state.lot && state.lot.no === a.lotNo) { const err = E.placeBid(state, a.id, +a.amount, now); if (!err) publish(); } break;
    case 'pass': if (t && state.phase === 'auction' && state.lot && state.lot.no === a.lotNo) { E.passLot(state, a.id); publish(); } break;
    case 'lineup': if (t && state.phase === 'lineup') { E.setLineup(state, a.id, a.formation, a.lineup); publish(); } break;
    case 'ready': if (t && state.phase === 'lineup') { t.ready = !!a.ready; publish(); } break;
  }
}
function presenceCheck(now) {
  let changed = false; state.seen = state.seen || {};
  for (const t of state.teams.slice()) {
    if (t.bot || t.id === state.hostId) continue;
    if (!state.seen[t.id]) state.seen[t.id] = now;
    const last = state.seen[t.id];
    if (now - last > OFFLINE_AFTER) {
      if (!t.offSince) { t.offSince = last; changed = true; }
      if (now - t.offSince > GRACE) {
        if (state.phase === 'lobby') { state.teams = state.teams.filter(x => x !== t); changed = true; }
        else if (!t.auto) { E.setAuto(t, true); if (state.phase === 'lineup') t.ready = true; if (state.phase === 'auction') E.addLog(state, `${t.name} entrou no piloto automático`); changed = true; }
      }
    }
  }
  return changed;
}
function hostLoop() {
  if (!state) return;
  const now = Date.now(); let changed = presenceCheck(now);
  try { localStorage.setItem('acabou-alive-' + code, String(now)); } catch (e) {}
  if (state.phase === 'auction') changed = E.tickAuction(state, now) || changed;
  else if (state.phase === 'cup') changed = E.tickLive(state, now) || changed;
  else if (state.phase === 'lineup') {
    const humans = state.teams.filter(t => !E.botLike(t));
    if (humans.every(t => t.ready) || now > state.lineupEndsAt) { E.startCup(state); changed = true; }
  }
  if (changed) publish();
}
function startHostLoops() {
  clearInterval(loopIv); clearInterval(hbIv);
  loopIv = setInterval(hostLoop, 200); hbIv = setInterval(heartbeat, 2000);
}
async function ensureLobby() {
  if (lobbyCh) return;
  try {
    lobbyCh = await openChannel('lobby', (ev, p) => { if (ev === 'room' && p && p.code) { rooms.set(p.code, p); if (view === 'home') renderRooms(); } });
  } catch (e) { lobbyCh = null; }
}

/* ---------- criar / entrar ---------- */
function readNames() {
  const n = ($('#f-name') || {}).value, t = ($('#f-team') || {}).value;
  me.name = (n || '').trim().slice(0, 18); me.team = (t || '').trim().slice(0, 22); saveMe();
  if (!me.name) { toast('Digite seu nome'); $('#f-name') && $('#f-name').focus(); return false; }
  return true;
}
async function createRoom() {
  if (!readNames()) return;
  code = genCode();
  const s = ui.settings;
  const settings = { budget: +s.budget, max: +s.max, format: s.format, speed: s.speed, hideOvr: s.hide === '1', pub: s.pub === '1', base: s.base, order: s.order };
  setBase(settings.base);
  state = E.newRoomState(code, me, settings); isHost = true;
  try { ch = await openChannel('room-' + code, onMsg); } catch (e) { toast(e.message); state = null; isHost = false; return; }
  try { history.replaceState(null, '', '?sala=' + code); } catch (e) {}
  try { localStorage.setItem('acabou-member-' + code, me.id); } catch (e) {}
  startHostLoops(); publish();
  track('sala_criada', { sala: code, base: settings.base, formato: settings.format, orcamento: settings.budget, publica: settings.pub });
}
async function joinRoom(c, auto) {
  c = String(c || '').trim().toUpperCase();
  if (c.length < 4) { toast('Código inválido'); return; }
  if (!auto && !readNames()) return;
  code = c;
  let saved = null; try { saved = JSON.parse(localStorage.getItem('acabou-host-' + code) || 'null'); } catch (e) { saved = null; }
  try { ch = await openChannel('room-' + code, onMsg); } catch (e) { toast(e.message); code = null; return; }
  try { history.replaceState(null, '', '?sala=' + code); } catch (e) {}
  let member = null, alive = 0;
  try { member = localStorage.getItem('acabou-member-' + code); alive = +(localStorage.getItem('acabou-alive-' + code) || 0); } catch (e) {}
  // anfitrião reabrindo a sala em outra aba (se nenhuma outra aba estiver rodando a sala)
  if (saved && member && saved.hostId === member && saved.hostId !== me.id && Date.now() - alive > 5000) { me.id = member; try { sessionStorage.setItem('acabou-id', me.id); } catch (e) {} }
  if (saved && saved.hostId === me.id) {
    pendingResume = saved; isHost = false; state = null; renderConnecting();
    setTimeout(() => {
      const sv = pendingResume; pendingResume = null;
      if (state) { ch.send('action', { type: 'join', id: me.id, name: me.name, team: me.team }); toast('A sala continuou com outro anfitrião'); return; }
      state = sv; setBase(sv.settings && sv.settings.base); isHost = true; const n = Date.now(); state.seen = {}; state.teams.forEach(t => state.seen[t.id] = n);
      try { localStorage.setItem('acabou-member-' + code, me.id); } catch (e) {} startHostLoops(); publish();
    }, 2500);
    return;
  }
  isHost = false; state = null; renderConnecting();
  if (!me.name) { me.name = 'Técnico ' + me.id.slice(0, 3); }
  const claim = member && member !== me.id ? member : null;
  const send = () => ch.send('action', { type: 'join', id: me.id, name: me.name, team: me.team, claim });
  send(); clearInterval(joinIv); joinIv = setInterval(send, 1500);
  setTimeout(() => { if (!state && code === c) { clearInterval(joinIv); joinIv = null; renderNotFound(); } }, 12000);
}
function leaveRoom() {
  if (state && !isHost && state.phase === 'lobby') act({ type: 'leave' });
  setTimeout(() => { location.href = location.pathname; }, 150);
}

/* ---------- render principal ---------- */
function render() {
  updateBadge();
  setBase(state ? state.settings && state.settings.base : ui.settings.base);
  if (!state) return renderHome();
  // elenco fechado (vale também quando a última compra encerra o leilão)
  const mt0 = myTeam();
  if (mt0 && (state.phase === 'auction' || state.phase === 'lineup')) {
    const left = mt0.squad.length ? E.slots(mt0) : 11;
    if (ui.lastSlots != null && ui.lastSlots > 0 && left === 0) { playAcabou(); setTimeout(() => toast('Elenco fechado! Acabou o dinheiro?'), 1300); }
    ui.lastSlots = left;
  } else ui.lastSlots = null;
  const fn = { lobby: renderLobby, auction: renderAuction, lineup: renderLineup, cup: renderCup, end: renderEnd }[state.phase];
  fn && fn();
}
function seg(key, opts, cls) {
  // opts: [valor, rótulo, ícone (html), legenda]
  return `<div class="seg ${cls || ''}" data-k="${key}">${opts.map(([v, l, ic, sub]) => `<button data-v="${v}" class="${ui.settings[key] === v ? 'on' : ''}">${ic ? `<span class="ic">${ic}</span>` : ''}${ic || sub ? `<span class="tx"><b>${l}</b>${sub ? `<small>${sub}</small>` : ''}</span>` : l}</button>`).join('')}</div>`;
}
const SVG = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ICON = {
  liga: SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 4v16"/>'),
  mata: SVG('<path d="M3 5h5v4H3zM3 15h5v4H3zM8 7h3v10H8M11 12h4M15 10h6v4h-6z"/>'),
  grupos: SVG('<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="13" width="7" height="7" rx="1.5"/><path d="M10 7.5h3v9h-3M13 12h3"/><path d="M16 9h5v6h-5z"/>'),
  normal: SVG('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>'),
  rapido: SVG('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  pub: SVG('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>'),
  priv: SVG('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  shuffle: SVG('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
  sector: SVG('<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="1.6" fill="currentColor"/><circle cx="13" cy="12" r="1.6" fill="currentColor"/><circle cx="18" cy="18" r="1.6" fill="currentColor"/>'),
  book: SVG('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7M8 11h5"/>'),
};
const miniCard = t => `<span class="mini-card">${t}</span>`;
function renderHome() {
  view = 'home';
  app.innerHTML = `
  <div class="hero">
    <div>
      <div class="kicker">Leilão de futebol com os amigos</div>
      <h1>R$ 100.<br>Onze titulares.<br><em>Acabou o dinheiro?</em></h1>
      <figure class="quote"><img src="marcio.jpg" alt="Ilustração em pixel art de um dirigente de cabelos brancos e óculos numa coletiva"><figcaption><b>“Acabou o dinheiro!”</b><span>Márcio Braga, 2009</span></figcaption></figure>
    </div>
    <div class="panel">
      <h2>Quem é você?</h2>
      <div class="lead">Seu nome aparece para os outros técnicos.</div>
      <div class="field"><label>Seu nome</label><input type="text" id="f-name" maxlength="18" placeholder="Ex.: Marcos" value="${esc(me.name)}"></div>
      <div class="field"><label>Nome do time</label><input type="text" id="f-team" maxlength="22" placeholder="Ex.: Belford Roxo FC" value="${esc(me.team)}"></div>
      ${!ONLINE ? `<div class="banner-info">Modo local: o servidor ainda não foi configurado, então a sala só funciona entre abas deste navegador. Dá para testar contra bots normalmente.</div>` : ''}
    </div>
  </div>
  <div class="setup">
    <div class="panel">
      <h2>Criar sala</h2>
      <div class="lead">Você vira o anfitrião: deixe esta aba aberta até o fim da partida.</div>
      <div class="field"><label>Modo</label>${seg('base', Object.entries(MODES).map(([k, m]) => { const [lo, hi] = ovrRange(k); return [k, m.name, `<img src="${m.icon}" alt="" width="46" height="46">`, `${m.list.length} jogadores · OVR ${lo}–${hi}`]; }), 'tiles modes')}</div>
      <div class="grid2">
        <div class="field"><label>Orçamento</label>${seg('budget', [['100','R$ 100'],['150','R$ 150'],['200','R$ 200']])}</div>
        <div class="field"><label>Máx. de técnicos</label><select id="f-max">${[2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}" ${+ui.settings.max === n ? 'selected' : ''}>${n} técnicos</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Campeonato</label>${seg('format', [['liga','Pontos corridos',ICON.liga],['mata','Mata-mata',ICON.mata],['grupos','Grupos + mata',ICON.grupos]], 'tiles')}</div>
      <div class="field"><label>Ordem do leilão</label>${seg('order', [['livre','Sorteada',ICON.shuffle,'Qualquer posição a qualquer hora'],['setor','Por setor',ICON.sector,'Goleiros → defesa → meio → ataque']], 'tiles row')}</div>
      <div class="grid2">
        <div class="field"><label>Velocidade do leilão</label>${seg('speed', [['normal','Normal',ICON.normal],['rapido','Rápido',ICON.rapido]], 'tiles')}</div>
        <div class="field"><label>Overall no leilão</label>${seg('hide', [['0','Visível',miniCard('88')],['1','Escondido',miniCard('?')]], 'tiles')}</div>
      </div>
      <div class="field"><label>Sala</label>${seg('pub', [['1','Pública',ICON.pub,'Aparece em "Salas abertas"'],['0','Privada',ICON.priv,'Só entra quem tem o código']], 'tiles row')}</div>
      <button class="cta" id="create">Criar sala</button>
    </div>
    <div class="panel">
      <h2>Entrar numa sala</h2>
      <div class="lead">Digite o código que o anfitrião mandou.</div>
      <div class="field"><input type="text" class="code" id="f-code" maxlength="6" placeholder="ABCDE"></div>
      <button class="cta" id="join" style="background:var(--chalk)">Entrar</button>
      <h2 style="margin-top:24px;font-size:20px">Salas abertas</h2>
      <ul class="rooms" id="rooms"></ul>
    </div>
  </div>
  <button class="rules-link" id="home-rules">${ICON.book}<span><b>Livro de regras</b><small>Tudo o que você precisa saber antes do martelo bater</small></span><em>Abrir</em></button>
  ${sponsorHTML()}`;
  $('#home-rules').onclick = showRules;
  fillMail();
  app.querySelectorAll('.seg').forEach(sg => sg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    ui.settings[sg.dataset.k] = b.dataset.v; sg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    if (sg.dataset.k === 'base') setBase(b.dataset.v);
  }));
  $('#f-max').onchange = e => ui.settings.max = e.target.value;
  $('#create').onclick = createRoom;
  $('#join').onclick = () => joinRoom($('#f-code').value);
  $('#f-code').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom($('#f-code').value); });
  renderRooms(); ensureLobby();
}
function renderRooms() {
  const el = $('#rooms'); if (!el) return;
  const now = Date.now(); const list = [...rooms.values()].filter(r => now - r.ts < 9000);
  el.innerHTML = list.length ? list.map(r => `<li><span><b>${esc(r.name)}</b><br><small>${esc(r.host)} · ${esc(BASE_NAMES[r.base] || 'Europa')} · ${r.count}/${r.max} técnicos</small></span><button class="ghost" data-code="${esc(r.code)}">Entrar</button></li>`).join('')
    : '<li class="empty" style="border:0;background:none">Nenhuma sala pública agora. Crie a sua!</li>';
  el.querySelectorAll('button[data-code]').forEach(b => b.onclick = () => joinRoom(b.dataset.code));
}
setInterval(() => { if (view === 'home') renderRooms(); updateBadge(); }, 3000);
// cliente avisa o anfitrião que continua conectado
setInterval(() => { if (ch && state && !isHost && code) ch.send('action', { type: 'ping', id: me.id }); }, 4000);
window.addEventListener('online', () => { if (ch && code && !isHost) ch.send('action', { type: 'ping', id: me.id }); });
function renderConnecting() { view = 'connecting'; app.innerHTML = `<div class="panel" style="margin-top:30px;text-align:center"><h2>Entrando na sala ${esc(code)}…</h2><div class="lead">Esperando o anfitrião responder.</div></div>`; }
function renderNotFound() { view = 'nf'; app.innerHTML = `<div class="panel" style="margin-top:30px;text-align:center"><h2>Sala não encontrada</h2><div class="lead">Confira o código, ou peça para o anfitrião deixar a aba da sala aberta.</div><button class="gold" id="back">Voltar</button></div>`; $('#back').onclick = () => location.href = location.pathname; }

/* ---------- LOBBY ---------- */
function formationSelect(id, value) {
  return `<select id="${id}">${E.FORMATION_NAMES.map(f => `<option ${f === value ? 'selected' : ''}>${f}</option>`).join('')}</select>`;
}
function renderLobby() {
  const mt = myTeam();
  if (view !== 'lobby') {
    view = 'lobby';
    app.innerHTML = `
    <div class="ah"><h2>Sala de espera</h2><button class="ghost" id="leave">Sair da sala</button></div>
    <div class="lgrid">
      <div class="panel">
        <div class="lbl" style="margin-bottom:8px">Código da sala</div>
        <div class="codebox"><div class="code-big" id="codebig" title="Clique para mostrar">${esc(code)}</div><button class="gold" id="copy">Copiar convite</button></div>
        <div class="streamer-note">Modo streamer: o código está escondido. Clique nele para mostrar só para você, ou use “Copiar convite”.</div>
        <div class="lead" style="margin-top:10px">Mande o código ou o link para os amigos. ${state.settings.pub ? 'A sala também aparece em "Salas abertas".' : 'Sala privada.'}</div>
        <h3 class="lbl" style="margin:16px 0 8px">Técnicos</h3>
        <div class="plist" id="plist"></div>
        <div class="ctrl" id="hostctrl"></div>
      </div>
      <div class="panel">
        <h2>Sua formação inicial</h2>
        <div class="lead">Serve de norte no leilão. Depois do leilão você pode trocar.</div>
        <div class="field" id="fsel"></div>
        <div id="fprev"></div>
        <div class="banner-info" id="rules"></div>
      </div>
    </div>
    <div id="lobby-record"></div>
    <button class="rules-link" id="rulebook">${ICON.book}<span><b>Livro de regras</b><small>Leia antes de começar: vale para todos nesta sala</small></span><em>Abrir</em></button>
    ${sponsorHTML()}`;
    $('#leave').onclick = leaveRoom;
    fillMail();
    $('#codebig').onclick = () => $('#codebig').classList.toggle('peek');
    $('#copy').onclick = async () => { const link = location.origin + location.pathname + '?sala=' + code; try { await navigator.clipboard.writeText(`Bora pro leilão no "Acabou o dinheiro?" 💸 Código: ${code} — ${link}`); toast('Convite copiado!'); } catch (e) { toast('Código: ' + code); } };
  }
  const s = state.settings;
  $('#rulebook').onclick = showRules;
  $('#lobby-record').innerHTML = recordHTML();
  const nT = state.teams.length, poolEst = Math.ceil(nT * 1.5) + 1 + Math.ceil(nT * 12.5);
  $('#rules').innerHTML = `<b>Pote desta partida:</b> ${poolEst} jogadores sorteados para ${nT * 11} vagas.<br><b>Regras da sala:</b> base ${BASE_NAMES[s.base] || 'Europa'} · orçamento ${fmt(s.budget)} · ${{ liga:'pontos corridos', mata:'mata-mata', grupos:'grupos + mata-mata' }[s.format]} · leilão ${s.order === 'setor' ? 'por setor, ' : ''}${s.speed === 'rapido' ? 'rápido' : 'normal'} · overall ${s.hideOvr ? 'escondido' : 'visível'} · até ${s.max} técnicos`;
  $('#plist').innerHTML = state.teams.map(t => `<div class="prow2">
      <span class="dot" style="background:${t.color};width:14px;height:14px"></span>
      <div><div class="nm">${esc(t.name)}${t.id === me.id ? ' (você)' : ''}</div><small>${esc(t.coach)} · ${esc(t.formation)}${t.bot ? ' · ' + esc(t.pers.n) : ''}${statusTag(t)}</small></div>
      <span>${t.id === state.hostId ? '<span class="tag host">anfitrião</span>' : t.bot ? '<span class="tag bot">bot</span>' : '<span class="tag ok">pronto</span>'}</span>
      <span>${isHost && t.id !== state.hostId ? `<button class="x" data-kick="${esc(t.id)}" title="Remover">×</button>` : ''}</span>
    </div>`).join('');
  app.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => { state.teams = state.teams.filter(t => t.id !== b.dataset.kick); publish(); });
  const hc = $('#hostctrl');
  if (isHost) {
    const bots = state.teams.filter(t => t.bot).length;
    hc.innerHTML = `<button class="ghost" id="addbot" ${state.teams.length >= s.max || bots >= 8 ? 'disabled' : ''}>+ Adicionar bot</button>
      <button class="gold" id="startA" ${state.teams.length < 2 ? 'disabled' : ''}>Começar o leilão</button>
      ${state.teams.length < 2 ? '<span class="lead" style="margin:0;align-self:center">Precisa de pelo menos 2 técnicos (pode ser bot).</span>' : ''}`;
    $('#addbot').onclick = () => {
      const usedN = state.teams.map(t => t.name); const opt = E.BOT_NAMES.find(([n]) => !usedN.includes(n)); if (!opt) return;
      const used = state.teams.map(x => x.color); const idx = E.COLORS.findIndex(c => !used.includes(c));
      state.teams.push(E.mkTeam('bot-' + Math.random().toString(36).slice(2, 7), opt[1], opt[0], true, idx)); publish();
    };
    $('#startA').onclick = () => { if (state.teams.length < 2) return; E.startAuction(state); publish(); track('leilao_iniciado', { sala: code, tecnicos: state.teams.length, humanos: state.teams.filter(t => !t.bot).length }); };
  } else hc.innerHTML = `<span class="lead" style="margin:0">Aguardando o anfitrião começar o leilão…</span>`;
  if (mt) {
    if (!$('#fsel select')) { $('#fsel').innerHTML = formationSelect('form', mt.formation); $('#form').onchange = e => act({ type: 'formation', formation: e.target.value }); }
    if ($('#form').value !== mt.formation) $('#form').value = mt.formation;
    $('#fprev').innerHTML = pitchHTML(E.FORMATIONS[mt.formation].map(() => null), mt.formation, {});
  } else { $('#fsel').innerHTML = '<div class="lead">Você está assistindo esta sala.</div>'; $('#fprev').innerHTML = ''; }
}

/* ---------- campo ---------- */
function pitchHTML(lineup, formation, o) {
  const slots = E.FORMATIONS[formation];
  return `<div class="field-pitch">${slots.map((s, i) => {
    const id = lineup[i];
    if (id == null) return `<div class="fslot empty ${o.click ? 'click' : ''} ${o.sel === i ? 'sel' : ''}" data-i="${i}" style="left:${s.x}%;bottom:${s.y}%"><div class="sp">${E.POS_PT[s.pos]}</div><div class="sn">—</div></div>`;
    const p = P(id); const lv = E.fitLevel(p, s.pos);
    const sub = o.prices ? (o.prices[id] != null ? fmt(o.prices[id]) : '') : '';
    return `<div class="fslot ${lv} ${o.click ? 'click' : ''} ${o.sel === i ? 'sel' : ''}" data-i="${i}" style="left:${s.x}%;bottom:${s.y}%">
      <div class="sp">${E.POS_PT[s.pos]}${p.p !== s.pos ? ' · ' + posLabel(p) : ''}${o.ovr ? ' · ' + p.o : ''}</div><div class="sn">${esc(p.n)}</div>${sub ? `<div class="sv">${sub}</div>` : ''}${p.pen ? '<div class="sv pen">fora de ritmo</div>' : ''}</div>`;
  }).join('')}</div>`;
}
function previewAssign(team) {
  const slots = E.FORMATIONS[team.formation]; const res = Array(11).fill(null);
  const ids = team.squad.slice().sort((a, b) => P(b).o - P(a).o);
  for (const id of ids) {
    let best = -1, bv = -1;
    slots.forEach((s, i) => { if (res[i] != null) return; const v = E.fit(P(id), s.pos); if (v > bv) { bv = v; best = i; } });
    if (best >= 0) res[best] = id;
  }
  return res;
}

/* ---------- LEILÃO ---------- */
function cardHTML(p, hide) {
  const tier = hide ? 'neutral' : p.o >= 89 ? 'elite' : p.o >= 85 ? 'gold' : 'silver';
  const alt = p.a.length ? p.a.map(a => E.POS_PT[a] || a).join(' · ') : 'só ' + posLabel(p);
  const hw = p.h ? `${(p.h / 100).toFixed(2).replace('.', ',')} m${p.w ? ` · ${p.w} kg` : ''}` : '—';
  return `<div class="pcard ${tier}">
    <div class="pc-head"><div><div class="pc-ovr${hide ? ' q' : ''}">${hide ? '?' : p.o}</div><div class="pc-pos">${posLabel(p)}</div></div><div class="pc-nat">${flagImg(p)}<span>${esc(p.c)}</span></div></div>
    <div class="pc-shirt">${jerseySVG(p.t, p.n)}</div>
    <div class="pc-name">${esc(p.n)}</div>
    <div class="pc-club">${esc(p.t)}</div>
    <div class="pc-traits">${p.x ? `<span class="special" title="Especial${p.l ? ' de lenda' : ''}"><i>${p.xi || specialIcon(p.x)}</i> ${esc(p.x)}</span>${p.l ? '<span class="legend" title="Lenda: jogador histórico">👑 Lenda</span>' : ''}` : p.o < 85 ? '' : (p.k && p.k[0] ? `<span>${esc(p.k[0])}</span>` : '')}</div>
    <div class="pc-foot"><div><span>Posições</span><b>${posLabel(p)}${p.a.length ? ' · ' + alt : ''}</b></div><div><span>${p.w ? 'Altura · peso' : 'Altura'}</span><b>${hw}</b></div></div>
  </div>`;
}
let lastCardNo = -1;
const flagImg = p => p.f ? `<img class="flag" src="flags/${p.f}.svg" alt="" width="28" height="21">` : '';
function renderAuction() {
  if (view !== 'auction') {
    view = 'auction'; lastStampKey = ''; lastCardNo = -1; ui.asel = null;
    app.innerHTML = `
    <div class="ah"><h2>Leilão ao vivo</h2><div class="prog" id="a-prog"></div></div>
    <div class="sectors" id="a-sectors"></div>
    <div class="agrid">
      <div class="lot" id="lot">
        <div class="lot-top"><span class="lotno" id="l-no"></span><span class="lotno" id="l-floor"></span></div>
        <div class="lot-body">
          <div id="l-card"></div>
          <div class="lot-right">
            <div class="board">
              <div><div class="lbl">Lance atual</div><div class="price" id="l-price">R$ 0</div></div>
              <div><div class="lbl">Na frente</div><div class="leader" id="l-leader"></div></div>
            </div>
            <div class="timer"><div class="bar" id="l-bar"></div></div>
            <div class="call" id="l-call"></div>
            <div id="bidzone">
              <div class="bids four">
                <button class="bid" data-inc="1">+1<small></small></button>
                <button class="bid" data-inc="5">+5<small></small></button>
                <button class="bid" data-inc="10">+10<small></small></button>
                <button class="bid max" id="l-max">Máx.<small></small></button>
              </div>
              <div class="custom"><input type="number" id="l-custom" min="1" placeholder="Valor em R$"><button class="ghost" id="l-send">Dar lance</button><button class="pass" id="l-pass">Passar</button></div>
            </div>
            <div class="hint" id="l-hint"></div>
            ${reactBar()}
          </div>
        </div>
        <div class="ffbar" id="ffbar"><span>Todos os times humanos estão completos. O resto roda sozinho.</span><button class="gold" id="ff">Pular para o fim</button></div>
        <div class="stamp" id="stamp"></div>
      </div>
      <div class="side">
        <div class="tlist"><h3>Técnicos</h3><div id="tlist"></div></div>
      </div>
    </div>
    ${sponsorHTML('strip')}
    <div class="lower">
      <div class="panel" style="padding:14px">
        <div class="pitch-h" style="margin-bottom:10px"><h3 id="my-title">Seu time</h3><div style="width:200px" id="a-fsel"></div></div>
        <div id="mypitch"></div>
        <div class="legend"><span><i style="background:var(--green)"></i>na posição</span><span><i style="background:var(--gold)"></i>adaptado</span><span><i style="background:var(--red)"></i>fora de posição</span></div>
        <div class="hint">Toque em dois lugares do campinho para trocar jogadores de posição.</div>
      </div>
      <div class="side">
        <div class="box"><h3>Top 10 lances do leilão</h3><ol class="tline" id="top10"></ol></div>
        <div class="box"><h3>Últimos 5 leiloados</h3><ol class="tline" id="last5"></ol></div>
      </div>
    </div>`;
    app.querySelectorAll('.bid[data-inc]').forEach(b => b.onclick = () => bidInc(+b.dataset.inc));
    $('#l-max').onclick = () => { const mt = myTeam(); if (mt) bidAmount(E.maxAllowed(mt)); };
    $('#l-pass').onclick = () => state.lot && act({ type: 'pass', lotNo: state.lot.no });
    $('#l-send').onclick = () => { const v = parseInt($('#l-custom').value, 10); if (v > 0) { bidAmount(v); $('#l-custom').value = ''; } };
    $('#l-custom').addEventListener('keydown', e => { if (e.key === 'Enter') $('#l-send').click(); });
    $('#ff').onclick = () => { if (isHost) { E.skipToEnd(state, Date.now()); publish(); } };
    const mt = myTeam();
    if (mt) { $('#a-fsel').innerHTML = formationSelect('aform', mt.formation); $('#aform').onchange = e => { ui.asel = null; act({ type: 'formation', formation: e.target.value }); }; }
    fillMail();
  }
  const lot = state.lot, mt = myTeam(), sold = state.teams.reduce((a, t) => a + t.squad.length, 0);
  const secEl = $('#a-sectors');
  if (secEl) { const cur = state.sector; secEl.style.display = cur == null ? 'none' : ''; if (cur != null) secEl.innerHTML = E.SECTORS.map(([n, ic], i) => `<span class="${i === cur ? 'on' : i < cur ? 'done' : ''}">${ic} ${n}</span>`).join('<i>›</i>') + (cur >= 4 ? '<span class="on">🔀 Vagas restantes</span>' : ''); }
  $('#a-prog').textContent = `Lote ${state.lotNo} · ${sold}/${state.teams.length * 11} vagas preenchidas · ${Math.max(0, (state.poolSize || 0) - (state.history || []).length - (lot && lot.status === 'open' ? 1 : 0))} de ${state.poolSize || '?'} jogadores ainda no pote`;
  if (lot) {
    const p = PLAYERS[lot.pid];
    $('#l-no').textContent = 'LOTE ' + lot.no;
    const fl = E.floorFor(state, p);
    $('#l-floor').textContent = fl > 1 ? `lance mínimo R$ ${fl}` : '';
    if (lastCardNo !== lot.no) { lastCardNo = lot.no; $('#l-card').innerHTML = cardHTML(p, state.settings.hideOvr); }
    $('#l-price').textContent = fmt(lot.leader ? lot.price : 0);
    const L = lot.leader && teamById(lot.leader);
    $('#l-leader').innerHTML = L ? `<i class="dot" style="background:${L.color}"></i>${esc(L.name)}${L.id === me.id ? ' (você)' : ''}` : '<span style="color:var(--muted)">Ninguém ainda</span>';
    const bk = lot.no + ':' + lot.price + ':' + lot.leader;
    if (lot.leader && lot.status === 'open' && bk !== ui.lastBidKey) play('bid');
    ui.lastBidKey = bk;
    const key = lot.no + lot.status, st = $('#stamp');
    if (lot.status !== 'open' && key !== lastStampKey) {
      lastStampKey = key;
      const w = lot.winner && teamById(lot.winner);
      st.innerHTML = w ? `Vendido<small>${esc(w.name)} · ${fmt(lot.price)}</small>` : 'Sem lances<small>jogador fora do leilão</small>';
      st.className = 'stamp show' + (w ? (w.id === me.id ? ' mine' : '') : ' none');
      if (w) play('gavel');
      if (w && w.id === me.id) toast(`${p.n} é seu por ${fmt(lot.price)}!`);
    } else if (lot.status === 'open') st.className = 'stamp';
    checkBroke(lot, p, mt);
    const can = mt && lot.status === 'open' && !lot.auto && E.needFor(state, mt, p) && lot.leader !== mt.id;
    const lim = mt ? E.maxAllowed(mt) : 0, base = lot.leader ? lot.price : 0, mn = (mt && lot.status === 'open') ? E.minBid(state, mt) : 1;
    app.querySelectorAll('.bid[data-inc]').forEach(b => { const amt = Math.max(mn, base + +b.dataset.inc); b.querySelector('small').textContent = fmt(amt); b.disabled = !can || amt > lim; });
    $('#l-max small').textContent = fmt(lim); $('#l-max').disabled = !can || lim < mn;
    $('#l-pass').disabled = !can || (lot.passed || []).includes(me.id);
    $('#l-send').disabled = !can; $('#l-custom').disabled = !can;
    $('#bidzone').style.display = mt ? '' : 'none';
    let h = '';
    if (!mt) h = 'Você está assistindo este leilão.';
    else if (E.slots(mt) === 0) h = 'Seu elenco está completo. Os outros seguem disputando.';
    else if (!E.needFor(state, mt, p)) h = E.isGK(p) ? 'Você já tem goleiro: este lote roda sem você.' : 'Você já tem 10 jogadores de linha: só falta o goleiro.';
    else h = `Saldo: <b>${fmt(mt.budget)}</b> · Vagas: <b>${E.slots(mt)}</b> (${E.hasGK(state, mt) ? 'goleiro ✓' : 'falta goleiro'}) · Teto neste lote: <b>${fmt(lim)}</b> · Seu lance mínimo: <b>${fmt(mn)}</b>`;
    $('#l-hint').innerHTML = h;
  }
  $('#ffbar').classList.toggle('on', isHost && state.teams.every(t => t.bot || E.slots(t) === 0));
  $('#tlist').innerHTML = state.teams.map(t => `<div class="trow ${lot && lot.status === 'open' && lot.leader === t.id ? 'lead' : ''} ${t.id === me.id ? 'me' : ''}">
      <div class="tn"><i class="dot" style="background:${t.color}"></i><span>${esc(t.name)}</span></div>
      <div class="tb">${fmt(t.budget)}</div>
      <div class="tsub">${t.bot ? esc(t.coach) + ' · bot' : esc(t.coach)} · ${esc(t.formation)}${statusTag(t)}</div>
      <div class="tcount">${t.squad.length}/11 ${E.hasGK(state, t) ? '🧤' : ''}</div></div>`).join('');
  if (mt) {
    $('#my-title').textContent = `${mt.name} · ${mt.squad.length}/11 · gasto ${fmt(state.settings.budget - mt.budget)}`;
    if ($('#aform') && $('#aform').value !== mt.formation && document.activeElement !== $('#aform')) $('#aform').value = mt.formation;
    const lu = (mt.lineup && mt.lineup.length === 11) ? mt.lineup : previewAssign(mt);
    setHTML($('#mypitch'), pitchHTML(lu, mt.formation, { prices: mt.paid, ovr: !state.settings.hideOvr, click: true, sel: ui.asel }));
    $('#mypitch').onclick = e => {
      const el = e.target.closest('.fslot[data-i]'); if (!el) return;
      const i = +el.dataset.i, m = myTeam(); if (!m) return;
      const cur = (m.lineup && m.lineup.length === 11) ? m.lineup : previewAssign(m);
      if (ui.asel == null) { if (cur[i] == null) return; ui.asel = i; }
      else if (ui.asel === i) ui.asel = null;
      else { const l = cur.slice(); [l[ui.asel], l[i]] = [l[i], l[ui.asel]]; ui.asel = null; m.lineup = l; act({ type: 'arrange', formation: m.formation, lineup: l }); }
      renderAuction();
    };
  } else $('#mypitch').innerHTML = '';
  const hist = state.history || [];
  const row = (h, i) => { const t = h.team && teamById(h.team); return `<li><span class="n">${i + 1}</span><span class="who"><b>${esc(PLAYERS[h.pid].n)}</b><small>${t ? `<i class="dot" style="background:${t.color}"></i> ${esc(t.name)}` : 'sem lance'}</small></span><span class="v">${t ? fmt(h.price) : '—'}</span></li>`; };
  const top = hist.filter(h => h.team).sort((a, b) => b.price - a.price || a.no - b.no).slice(0, 10);
  $('#top10').innerHTML = top.length ? top.map(row).join('') : '<li class="empty">Nenhuma venda ainda</li>';
  const last = hist.slice(-5).reverse();
  $('#last5').innerHTML = last.length ? last.map(row).join('') : '<li class="empty">O primeiro lote está no martelo</li>';
}
// Toca o "Acabou o dinheiro!" (só para o próprio técnico):
// 1) aparece um jogador que ele precisa mas não tem saldo para o lance mínimo;
// 2) o lance passa do teto dele; 3) ele fecha o elenco
function checkBroke(lot, p, mt) {
  if (!mt) return;
  const left = E.slots(mt);
  if (!lot || lot.status !== 'open' || lot.auto || left === 0 || !E.needFor(state, mt, p) || ui.brokeLot === lot.no) return;
  const lim = E.maxAllowed(mt);
  if (lim < E.floorFor(state, p)) { ui.brokeLot = lot.no; playAcabou(); toast(`Acabou o dinheiro! ${p.n} sai por no mínimo ${fmt(E.floorFor(state, p))}`); }
  else if (lot.leader && lot.leader !== mt.id && lot.price + 1 > lim) { ui.brokeLot = lot.no; playAcabou(); toast(`Acabou o dinheiro! O lance passou do seu teto (${fmt(lim)})`); }
}
function bidInc(inc) {
  const lot = state && state.lot, mt = myTeam(); if (!lot || !mt) return;
  bidAmount(Math.max(E.minBid(state, mt), (lot.leader ? lot.price : 0) + inc));
}
function bidAmount(amount) {
  const lot = state && state.lot, mt = myTeam(); if (!lot || !mt || lot.status !== 'open') return;
  if (amount > E.maxAllowed(mt)) { toast('Acima do seu teto: ' + fmt(E.maxAllowed(mt))); return; }
  const mn = E.minBid(state, mt);
  if (amount < mn) { toast('Lance mínimo: ' + fmt(mn)); return; }
  act({ type: 'bid', lotNo: lot.no, amount });
}
document.addEventListener('keydown', e => {
  if (!state || state.phase !== 'auction' || ['INPUT', 'SELECT'].includes(e.target.tagName)) return;
  const m = { '1': 1, '2': 5, '3': 10 }[e.key];
  if (m) { e.preventDefault(); bidInc(m); }
  else if (e.key === '4') { const mt = myTeam(); if (mt) bidAmount(E.maxAllowed(mt)); }
  else if ((e.key === 'p' || e.key === 'P') && state.lot) act({ type: 'pass', lotNo: state.lot.no });
});
// timer suave
function frame() {
  if (state && state.phase === 'auction' && view === 'auction' && state.lot) {
    const lot = state.lot, sp = E.SPEEDS[state.settings.speed];
    const left = Math.max(0, (lot.endsAt - hostNow()) / 1000);
    const bar = $('#l-bar'), c = $('#l-call');
    if (bar && c) {
      if (lot.status !== 'open') { bar.style.width = '0%'; c.textContent = lot.status === 'sold' ? 'Dou-lhe três!' : ''; c.classList.remove('hot'); }
      else if (lot.auto) { bar.style.width = '100%'; bar.style.background = 'var(--muted)'; c.textContent = 'Lote só entre os bots…'; c.classList.remove('hot'); }
      else {
        bar.style.width = Math.min(100, left / sp.open * 100) + '%';
        bar.style.background = left <= 1.5 ? 'var(--red)' : left <= 3 ? 'var(--gold)' : 'var(--green)';
        if (!lot.leader) { const fl = E.floorFor(state, PLAYERS[lot.pid]); c.textContent = left <= 3 ? 'Ninguém? Última chance…' : 'Lance inicial: R$ ' + fl; c.classList.toggle('hot', left <= 3); }
        else if (left <= 1) { c.textContent = 'Dou-lhe três…'; c.classList.add('hot'); }
        else if (left <= 2) { c.textContent = 'Dou-lhe duas…'; c.classList.add('hot'); }
        else if (left <= 3) { c.textContent = 'Dou-lhe uma…'; c.classList.remove('hot'); }
        else { const L = teamById(lot.leader); c.textContent = `${L && L.id === me.id ? 'Você' : L ? L.name : ''} na frente · ${Math.ceil(left)}s`; c.classList.remove('hot'); }
      }
    }
  }
  if (state && state.phase === 'cup' && view === 'live') { try { liveTick(false); } catch (e) { console.error(e); } }
  if (state && state.phase === 'lineup' && $('#lu-cd')) { const s = Math.max(0, Math.ceil((state.lineupEndsAt - hostNow()) / 1000)); $('#lu-cd').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------- ESCALAÇÃO ---------- */
function renderLineup() {
  const mt = myTeam();
  if (mt && !ui.draft) ui.draft = { formation: mt.formation, lineup: (mt.lineup && mt.lineup.length === 11 && !mt.lineup.includes(null) ? mt.lineup : E.autoLineup(state, mt.squad, mt.formation)).slice() };
  if (view !== 'lineup') {
    view = 'lineup'; ui.sel = null;
    app.innerHTML = `
    <div class="ah"><h2>Escale seu time</h2><div class="prog">Começa sozinho em <span class="countdown" id="lu-cd"></span></div></div>
    <div class="lgrid">
      <div class="panel" style="padding:14px"><div id="lu-pitch"></div>
        <div class="legend"><span><i style="background:var(--green)"></i>na posição</span><span><i style="background:var(--gold)"></i>adaptado</span><span><i style="background:var(--red)"></i>fora de posição (rende bem menos)</span></div>
        <div class="hint">Toque em dois jogadores para trocá-los de lugar.</div></div>
      <div class="side">
        <div class="panel" id="lu-ctrl"></div>
        <div class="box"><h3>Técnicos</h3><div class="plist" id="lu-teams"></div><div class="ctrl" id="lu-host"></div></div>
      </div>
    </div>`;
    if (mt) {
      $('#lu-ctrl').innerHTML = `<h2>Formação</h2><div class="lead">Troque à vontade: os jogadores são reposicionados automaticamente.</div>
        <div class="field">${formationSelect('lu-form', ui.draft.formation)}</div>
        <div class="ctrl"><button class="ghost" id="lu-auto">Reorganizar automático</button><button class="ghost" id="lu-best">Sugerir formação</button></div>
        <div class="field"><label>Estilo de jogo</label>${tacticPicker(mt.tactic)}</div>
        <div class="ctrl"><button class="gold" id="lu-ready">Estou pronto</button><button class="ghost" id="lu-squads">Ver elencos</button></div>`;
      $('#lu-form').onchange = e => { ui.draft.formation = e.target.value; ui.draft.lineup = E.autoLineup(state, mt.squad, ui.draft.formation); ui.sel = null; sendDraft(); };
      $('#lu-auto').onclick = () => { ui.draft.lineup = E.autoLineup(state, mt.squad, ui.draft.formation); ui.sel = null; sendDraft(); };
      $('#lu-best').onclick = () => { const b = E.bestFormation(state, mt.squad); ui.draft = { formation: b.name, lineup: b.lineup }; $('#lu-form').value = b.name; ui.sel = null; sendDraft(); toast('Sugestão: ' + b.name); };
      bindTactics($('#lu-ctrl'));
      $('#lu-ready').onclick = () => { const m = myTeam(); act({ type: 'ready', ready: !(m && m.ready) }); };
      $('#lu-squads').onclick = showSquads;
    } else $('#lu-ctrl').innerHTML = `<h2>Assistindo</h2><div class="lead">Os técnicos estão escalando os times.</div><button class="ghost" id="lu-squads">Ver elencos</button>`, $('#lu-squads').onclick = showSquads;
  }
  if (mt) {
    setHTML($('#lu-pitch'), pitchHTML(ui.draft.lineup, ui.draft.formation, { click: true, sel: ui.sel, ovr: true, prices: mt.paid }));
    $('#lu-pitch').onclick = e => {
      const el = e.target.closest('.fslot[data-i]'); if (!el) return;
      const i = +el.dataset.i;
      if (ui.sel == null) ui.sel = i; else if (ui.sel === i) ui.sel = null;
      else { const l = ui.draft.lineup; [l[ui.sel], l[i]] = [l[i], l[ui.sel]]; ui.sel = null; sendDraft(); return; }
      renderLineup();
    };
    $('#lu-ready').textContent = mt.ready ? 'Pronto ✓ (desfazer)' : 'Estou pronto';
  }
  $('#lu-teams').innerHTML = state.teams.map(t => `<div class="prow2" style="grid-template-columns:auto 1fr auto"><span class="dot" style="background:${t.color}"></span><div><div class="nm">${esc(t.name)}</div><small>${esc(t.formation)}</small></div>${t.ready ? '<span class="tag ok">pronto</span>' : '<span class="tag">escalando</span>'}</div>`).join('');
  $('#lu-host').innerHTML = isHost ? `<button class="gold" id="lu-go">Começar o campeonato agora</button>` : '';
  if (isHost) $('#lu-go').onclick = () => { E.startCup(state); publish(); };
}
function sendDraft() { act({ type: 'lineup', formation: ui.draft.formation, lineup: ui.draft.lineup.slice() }); renderLineup(); }

function showSquads() {
  const ranked = state.teams.slice().sort((a, b) => E.teamOvr(state, b) - E.teamOvr(state, a));
  $('#modal').innerHTML = `<div class="modal" id="mbg"><div class="inner"><div class="top"><h2>Elencos</h2><button class="ghost" id="mclose">Fechar</button></div>
    <div class="teams">${ranked.map((t, i) => teamCard(t, i + 1)).join('')}</div></div></div>`;
  $('#mclose').onclick = () => $('#modal').innerHTML = '';
  $('#mbg').onclick = e => { if (e.target.id === 'mbg') $('#modal').innerHTML = ''; };
}
function teamCard(t, rank) {
  const lineup = t.lineup || previewAssign(t);
  const slots = E.FORMATIONS[t.formation];
  const rows = slots.map((s, i) => lineup[i] != null ? { s, p: P(lineup[i]), id: lineup[i] } : null).filter(Boolean);
  return `<div class="tcard ${t.id === me.id ? 'me' : ''}"><div class="rank">#${rank}</div>
    <div class="tcard-h"><div><div class="nm" style="color:${t.color}">${esc(t.name)}</div><div class="cc">${esc(t.coach)} · ${esc(t.formation)}</div></div>
    <div class="ovr">${E.teamOvr(state, t).toFixed(1)}<small>OVR MÉDIO</small></div></div>
    ${rows.map(r => `<div class="pl ${r.p.base ? 'base' : ''}"><span class="pp">${E.POS_PT[r.s.pos]}</span><span>${esc(r.p.n)}</span><span class="po">${r.p.o}</span><span class="pr">${r.p.base ? '—' : fmt((t.paid || {})[r.id] ?? 0)}</span></div>`).join('')}
    <div class="tfoot"><span>Gasto ${fmt(state.settings.budget - t.budget)}</span><span>Sobrou ${fmt(t.budget)}</span></div></div>`;
}

/* ---------- CAMPEONATO ---------- */
const KIND = { penalti: 'de pênalti', falta: 'de falta', cabeca: 'de cabeça', jogada: '' };
const minTxt = m => Math.max(1, Math.min(90, Math.floor(m))) + "'";
const pn = id => esc(P(id).n);
function evText(e, m) {
  const team = teamById(e.s === 'h' ? m.h : m.a), tName = team ? esc(team.name) : '';
  switch (e.t) {
    case 'gol': return `⚽ <b>${minTxt(e.m)} GOL ${KIND[e.kind] || ''}!</b> ${pn(e.p)} <small>(${tName})</small>${e.as != null ? ` <small>· assistência de ${pn(e.as)}</small>` : ''}`;
    case 'penperdido': return `🧤 ${minTxt(e.m)} <b>${pn(e.gk)}</b> pega o pênalti de ${pn(e.p)}`;
    case 'defesa': return `🧤 ${minTxt(e.m)} Defesaça de ${pn(e.gk)} no chute de ${pn(e.p)}`;
    case 'chance': return `${minTxt(e.m)} ${pn(e.p)} quase marca`;
    case 'amarelo': return `🟨 ${minTxt(e.m)} Amarelo para ${pn(e.p)} <small>(${tName})</small>`;
    case 'vermelho': return `🟥 ${minTxt(e.m)} ${pn(e.p)} é expulso <small>(${tName})</small>`;
  }
  return '';
}
const scoreAt = (m, min) => [m.ev.filter(e => e.t === 'gol' && e.s === 'h' && e.m <= min).length, m.ev.filter(e => e.t === 'gol' && e.s === 'a' && e.m <= min).length];
/* estilo de jogo, comparação de setores e estatísticas da partida */
function tacticPicker(cur) {
  return `<div class="tactics">${E.TACTIC_NAMES.map(k => { const T = E.TACTICS[k]; return `<button data-tac="${k}" class="${(cur || 'equilibrado') === k ? 'on' : ''}" title="${esc(T.d)}"><span class="ti">${T.i}</span><b>${T.n}</b><small>${esc(T.d)}</small></button>`; }).join('')}</div>`;
}
function bindTactics(root) { root.querySelectorAll('[data-tac]').forEach(b => b.onclick = () => { act({ type: 'tactic', tactic: b.dataset.tac }); root.querySelectorAll('[data-tac]').forEach(x => x.classList.toggle('on', x === b)); toast('Estilo: ' + E.TACTICS[b.dataset.tac].n); }); }
const tacTag = k => { const T = E.TACTICS[k || 'equilibrado']; return `<span class="tac-tag" title="${esc(T.d)}">${T.i} ${T.n}</span>`; };
function cmpHTML(c) {
  const row = (l, x, y, r) => { const d = x - y; return `<div class="cmp-row"><span class="cl">${l}</span><b class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${x}</b><span class="vs">×</span><b class="${d < 0 ? 'up' : d > 0 ? 'down' : ''}">${y}</b><span class="cr">${r}</span></div>`; };
  return `<div class="cmp">${row('Ataque', c.h.a, c.a.d, 'Defesa')}${row('Meio', c.h.m, c.a.m, 'Meio')}${row('Defesa', c.h.d, c.a.a, 'Ataque')}</div>`;
}
function previewCmp(m) { const H = teamById(m.h), A = teamById(m.a); if (!H || !A || !H.lineup || !A.lineup) return ''; const mu = E.matchup(state, H, A); const R = v => Math.round(v); return cmpHTML({ h: { a: R(mu.h.a), m: R(mu.h.m), d: R(mu.h.d) }, a: { a: R(mu.a.a), m: R(mu.a.m), d: R(mu.a.d) } }); }
const STAT_ROWS = [['pos', 'Posse de bola', v => v + '%'], ['shots', 'Finalizações'], ['onT', 'Chutes no gol'], ['passes', 'Passes trocados'], ['acc', 'Acerto de passe', v => v + '%'], ['saves', 'Defesas do goleiro'], ['corners', 'Escanteios'], ['off', 'Impedimentos'], ['fouls', 'Faltas'], ['ya', 'Cartões amarelos'], ['rc', 'Cartões vermelhos']];
function statBars(m, min) {
  if (!m.st) return '';
  const f = min == null ? 1 : Math.min(1, Math.max(0, min / 90));
  // ao vivo: o que tem lance (chutes no gol, defesas, cartões) é contado até o minuto; o resto cresce com o relógio
  const evs = (side, ts, by) => m.ev.filter(e => e.m <= min && ts.includes(e.t) && (by ? e.s !== side : e.s === side)).length;
  const cut = (k, side) => {
    const v = m.st[side][k]; if (min == null || k === 'pos' || k === 'acc') return v;
    if (k === 'onT') return evs(side, ['gol', 'defesa', 'penperdido']);
    if (k === 'saves') return evs(side, ['defesa', 'penperdido'], true);
    if (k === 'ya') return evs(side, ['amarelo']); if (k === 'rc') return evs(side, ['vermelho']);
    if (k === 'shots') return Math.max(evs(side, ['gol', 'defesa', 'penperdido', 'chance']), Math.round(v * f));
    return Math.round(v * f);
  };
  return `<div class="mstats">${STAT_ROWS.map(([k, l, fm]) => {
    const x = cut(k, 'h'), y = cut(k, 'a'); if (k === 'rc' && !x && !y) return '';
    const tot = x + y || 1, F = fm || (v => v);
    return `<div class="ms-row"><div class="ms-top"><b>${F(x)}</b><span>${l}</span><b>${F(y)}</b></div><div class="ms-bar"><i style="width:${x / tot * 100}%;background:${teamById(m.h).color}"></i><i style="width:${y / tot * 100}%;background:${teamById(m.a).color}"></i></div></div>`;
  }).join('')}</div>`;
}
function matchCard(m) {
  const H = teamById(m.h), A = teamById(m.a);
  if (!H || !A) return '';
  const mine = m.h === me.id || m.a === me.id;
  const goals = side => (m.ev || []).filter(e => e.t === 'gol' && e.s === side).map(e => `${pn(e.p)} ${minTxt(e.m)}${e.kind !== 'jogada' ? ' <i>(' + (e.kind === 'penalti' ? 'pên.' : e.kind === 'falta' ? 'falta' : 'cab.') + ')</i>' : ''}`).join('<br>');
  return `<div class="match ${mine ? 'me' : ''}">${m.g ? `<div class="mtag">${esc(m.g)}</div>` : ''}<div class="mrow"><div class="h ${m.played && m.w === m.h ? 'win' : ''}">${tn(m.h)}</div>
    <div class="score ${m.played ? '' : 'pending'}">${m.played ? m.hg + ' × ' + m.ag : 'vs'}</div><div class="a ${m.played && m.w === m.a ? 'win' : ''}">${tn(m.a)}</div></div>
    ${m.played ? `<div class="scorers"><div>${goals('h')}</div><div>${goals('a')}</div></div>` : ''}${m.pens ? `<div class="pens">Pênaltis: ${m.pens[0]} × ${m.pens[1]}</div>` : ''}
    ${m.played && m.mvp != null ? `<div class="mvp">⭐ Craque do jogo: <b>${pn(m.mvp)}</b> · nota ${m.r[m.mvp].toFixed(1)}</div>` : ''}
    ${m.played && m.why ? `<div class="why">💬 ${esc(m.why)}</div>` : ''}
    ${m.played && m.st ? `<details class="mdet"><summary>📊 Estatísticas e duelo de setores</summary><div class="tacs">${tacTag(m.cmp && m.cmp.h.t)}<span>estilos</span>${tacTag(m.cmp && m.cmp.a.t)}</div>${m.cmp ? cmpHTML(m.cmp) : ''}${statBars(m)}</details>` : ''}
    ${!m.played ? `<div class="tacs">${tacTag(H.tactic)}<span>estilos</span>${tacTag(A.tactic)}</div>${previewCmp(m)}` : ''}</div>`;
}
// tabela com o placar parcial da rodada ao vivo
function liveRows(baseRows, matches, min) {
  const rows = baseRows.map(r => ({ ...r }));
  matches.forEach(m => { if (!m.h || !m.a || !m.ev) return; const [hg, ag] = scoreAt(m, min); if (!rows.find(r => r.id === m.h)) return; E.applyTable(rows, { h: m.h, a: m.a, hg, ag }); });
  return rows;
}
function tableHTML(rows, prev) {
  const sorted = E.sortTable(state, rows), before = prev ? E.sortTable(state, prev).map(r => r.id) : null;
  return `<table class="std"><tr><th>#</th><th>Time</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th></tr>${sorted.map((r, i) => {
    const was = before ? before.indexOf(r.id) : i, mv = was > i ? '<span class="up">▲</span>' : was < i ? '<span class="down">▼</span>' : '';
    return `<tr class="${r.id === me.id ? 'me' : ''}"><td>${i + 1}${mv}</td><td>${tn(r.id)}</td><td class="pts">${r.pts}</td><td>${r.j}</td><td>${r.v}</td><td>${r.e}</td><td>${r.d}</td><td>${r.gp - r.gc}</td></tr>`; }).join('')}</table>`;
}
function standingsHTML(min) {
  const cup = state.cup, live = cup.live, ms = live ? E.currentRound(state) : [];
  if (cup.phase === 'liga') return `<h3>${live ? 'Classificação ao vivo' : 'Classificação'}</h3>${live ? tableHTML(liveRows(cup.table, ms, min), cup.table) : tableHTML(cup.table)}`;
  if (cup.phase === 'grupos') return cup.groups.map(g => `<div class="grp"><h4>${esc(g.name)}${live ? ' · ao vivo' : ''}</h4>${live ? tableHTML(liveRows(g.table, ms.filter(m => m.g === g.name), min), g.table) : tableHTML(g.table)}</div>`).join('') + '<div class="hint">Os 2 primeiros de cada grupo avançam ao mata-mata.</div>';
  return `<h3>Chaveamento</h3><div class="bracket">${cup.ko.map(rd => `<div class="bround"><h4>${E.koName(rd.length * 2)}</h4>${rd.map(m => {
    const isLive = live && rd === cup.ko[cup.ko.length - 1] && m.ev; const sc = isLive ? scoreAt(m, min) : [m.hg, m.ag];
    const fin = m.played && (!isLive || min >= 90);
    return `<div class="bm"><span class="${fin && m.w === m.h ? 'w' : ''}">${m.h ? esc(teamById(m.h).name) : 'folga'}</span><span>${m.played && !m.bye ? sc[0] + '×' + sc[1] + (fin && m.pens ? ' (p)' : '') : '·'}</span><span class="${fin && m.w === m.a ? 'w' : ''}">${m.a ? esc(teamById(m.a).name) : 'folga'}</span></div>`; }).join('')}</div>`).join('')}</div>`;
}
// estatísticas da competição, cada uma num card com ícone
const STAT_CARDS = [
  ['g', 'Artilharia', '⚽'], ['a', 'Assistências', '🎯'], ['nota', 'Melhores notas', '⭐'],
  ['gk', 'Goleiros', '🧤'], ['esp', 'Bola parada', '🚩'], ['cart', 'Cartões', '🟨'],
];
function statLists(all) {
  return {
    g: all.filter(r => r.g).sort((a, b) => b.g - a.g || b.a - a.a).map(r => [r, r.g]),
    a: all.filter(r => r.a).sort((a, b) => b.a - a.a || b.g - a.g).map(r => [r, r.a]),
    nota: all.filter(r => r.j).sort((a, b) => b.nt / b.j - a.nt / a.j).map(r => [r, (r.nt / r.j).toFixed(2) + (r.mvp ? ' ⭐' + r.mvp : '')]),
    gk: all.filter(r => P(r.id).p === 'GK' && (r.cs || r.sv)).sort((a, b) => b.cs - a.cs || b.sv - a.sv).map(r => [r, `${r.cs} SG · ${r.sv} def.${r.ps ? ' · ' + r.ps + ' pên.' : ''}`]),
    esp: all.filter(r => r.gf || r.gp || r.gh).sort((a, b) => (b.gf + b.gp + b.gh) - (a.gf + a.gp + a.gh)).map(r => [r, [r.gf ? r.gf + ' falta' : '', r.gp ? r.gp + ' pên.' : '', r.gh ? r.gh + ' cab.' : ''].filter(Boolean).join(' · ')]),
    cart: all.filter(r => r.ya || r.rc).sort((a, b) => (b.rc * 3 + b.ya) - (a.rc * 3 + a.ya)).map(r => [r, `${r.ya ? '🟨' + r.ya : ''} ${r.rc ? '🟥' + r.rc : ''}`]),
  };
}
function statsHTML(min, n = 3) {
  const L = statLists(E.playerStats(state, min));
  const row = ([r, v]) => `<li><span class="who">${pn(r.id)}<small>${esc((teamById(r.team) || {}).name || '')}</small></span><span class="v">${v}</span></li>`;
  return `<h3>Estatísticas</h3><div class="stat-cards">${STAT_CARDS.map(([k, l, ic]) => `<div class="stat-card"><div class="sc-h"><span class="sc-ic">${ic}</span><b>${l}</b></div>
    <ul>${L[k].slice(0, n).map(row).join('') || '<li class="none">Nada ainda</li>'}</ul></div>`).join('')}</div>`;
}

let viewer = null, liveKey = '', lastNotif = -1, feed = [];
function renderCup(force) {
  const cup = state.cup;
  if (cup.live) return renderLive(force);
  view = 'cup'; liveKey = '';
  const up = E.upcoming(state);
  app.innerHTML = `
  <div class="ah"><h2>${cup.last ? esc(cup.last.title) : 'Campeonato'}</h2><div class="prog">${{ liga:'Pontos corridos', mata:'Mata-mata', grupos:'Grupos + mata-mata' }[cup.format]} · próximo: ${esc(E.nextTitle(state))}</div></div>
  <div class="cgrid">
    <div>
      ${up.length ? `<div class="panel" style="padding:16px;margin-bottom:14px">${isHost ? speedCtrl(ui.liveSpeed || E.LIVE_DEFAULT) : ''}<div class="lbl" style="margin:0 0 8px">Próximos jogos · ${esc(E.nextTitle(state))}</div><div class="matches">${up.map(matchCard).join('')}</div>
        <div class="ctrl">${isHost ? `<button class="gold" id="c-watch">▶ Assistir a rodada</button><button class="ghost" id="c-all">Simular o resto do campeonato</button>` : '<span class="lead" style="margin:0">O anfitrião vai começar a rodada.</span>'}</div></div>` : ''}
      ${myTeam() && up.length ? `<div class="panel tac-panel"><div class="lbl" style="margin:0 0 8px">Seu estilo de jogo para esta rodada</div>${tacticPicker(myTeam().tactic)}</div>` : ''}
      ${cup.last ? `<div class="lbl" style="margin:0 0 8px">Resultados · ${esc(cup.last.title)}</div><div class="matches">${cup.last.matches.map(matchCard).join('')}</div>` : ''}
      <div class="ctrl"><button class="ghost" id="c-sq">Ver elencos</button></div>
    </div>
    <div class="side"><div class="box">${standingsHTML(90)}</div><div class="box" id="c-stats">${statsHTML(undefined, 3)}</div></div>
  </div>`;
  $('#c-sq').onclick = showSquads; bindTactics(app);
  if (isHost && up.length) {
    app.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { ui.liveSpeed = +b.dataset.sp; app.querySelectorAll('[data-sp]').forEach(x => x.classList.toggle('on', x === b)); });
    $('#c-watch').onclick = () => { E.startRound(state, Date.now(), ui.liveSpeed || E.LIVE_DEFAULT); publish(); };
    $('#c-all').onclick = () => { let g = 0; while (!state.cup.done && g++ < 300) { if (state.cup.live) E.commitRound(state); else E.advanceCup(state); } publish(); };
  }
}
// controle de ritmo da rodada ao vivo (só o anfitrião)
function speedCtrl(cur) {
  return `<div class="speedbar"><span class="lbl">Ritmo</span><div class="seg speeds">${E.SPEEDS_LIVE.map(s => `<button data-sp="${s}" class="${cur === s ? 'on' : ''}">${E.LIVE_LABEL[s]}${s === E.LIVE_DEFAULT ? ' <small>padrão</small>' : ''}</button>`).join('')}</div></div>`;
}
function liveMatches() { return E.currentRound(state).filter(m => m.h && m.a && m.ev); }
function renderLive(force) {
  const cup = state.cup, key = cup.live.title + '|' + cup.live.at;
  const ms = liveMatches();
  if (view !== 'live' || liveKey !== cup.live.title) {
    view = 'live'; liveKey = cup.live.title; lastNotif = -1; feed = [];
    const mine = ms.find(m => m.h === me.id || m.a === me.id);
    ui.watch = (mine || ms[0] || {}).h + '|' + (mine || ms[0] || {}).a;
    app.innerHTML = `
    <div class="ah"><h2>${esc(cup.live.title)}</h2>${isHost ? speedCtrl(cup.live.speed) : '<div class="prog" id="lv-speed"></div>'}</div>
    <div class="cgrid">
      <div>
        <div class="panel live-panel">
          <div class="sboard"><div class="sb-team" id="sb-h"></div><div class="sb-mid"><div class="sb-score" id="sb-score">0 × 0</div><div class="sb-clock" id="sb-clock">0'</div></div><div class="sb-team" id="sb-a"></div></div>
          <canvas id="pitch2d" class="pitch2d"></canvas>
          <div class="pens-live" id="pens-live"></div>
          <div class="chips-m" id="lv-matches"></div>
          ${reactBar()}
          ${isHost ? `<div class="ctrl"><button class="ghost" id="lv-skip">Pular para o fim da rodada</button></div>` : ''}
        </div>
        <div class="box"><h3>Estatísticas do jogo</h3><div class="why" id="lv-why" style="display:none"></div><div id="lv-mstats"></div></div>
        <div class="box"><h3>Lance a lance</h3><ul class="feed" id="lv-feed"></ul></div>
      </div>
      <div class="side"><div class="box" id="lv-table"></div><div class="box" id="lv-stats"></div><div class="box"><h3>Gols da rodada</h3><ul class="feed small" id="lv-goals"></ul></div></div>
    </div>`;
    viewer = createViewer($('#pitch2d'));
    if (isHost) {
      app.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { E.setLiveSpeed(state, Date.now(), +b.dataset.sp); ui.liveSpeed = +b.dataset.sp; publish(); });
      $('#lv-skip').onclick = () => { E.skipLive(state, Date.now()); publish(); };
    }
  }
  // seletor de jogos
  const min = E.liveMinute(cup.live, hostNow());
  $('#lv-matches').innerHTML = ms.map(m => { const [a, b] = scoreAt(m, min); const k = m.h + '|' + m.a; return `<button data-w="${esc(k)}" class="${ui.watch === k ? 'on' : ''}">${esc(teamById(m.h).name)} <b>${a}×${b}</b> ${esc(teamById(m.a).name)}</button>`; }).join('');
  app.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { ui.watch = b.dataset.w; feed = []; lastNotif = -1; renderLive(); });
  app.querySelectorAll('[data-sp]').forEach(b => b.classList.toggle('on', +b.dataset.sp === cup.live.speed));
  if ($('#lv-speed')) $('#lv-speed').textContent = 'Ritmo: ' + (E.LIVE_LABEL[cup.live.speed] || cup.live.speed + 'x');
  const wm = ms.find(m => m.h + '|' + m.a === ui.watch) || ms[0];
  if (wm) { viewer.setMatch(wm, teamById(wm.h), teamById(wm.a), state); $('#sb-h').innerHTML = tn(wm.h); $('#sb-a').innerHTML = tn(wm.a); }
  liveTick(true);
}
// chamado a cada quadro durante a rodada ao vivo
function liveTick(force) {
  if (view !== 'live' || !state.cup || !state.cup.live) return;
  const l = state.cup.live, now = hostNow(), min = E.liveMinute(l, now), ht = E.isHalftime(l, now);
  const ms = liveMatches(), wm = ms.find(m => m.h + '|' + m.a === ui.watch) || ms[0];
  if (!wm) return;
  viewer.draw(min, ht);
  const [a, b] = scoreAt(wm, min);
  $('#sb-score').textContent = `${a} × ${b}`;
  $('#sb-clock').textContent = ht ? 'Intervalo' : min >= 90 ? 'Fim de jogo' : (min < 45 ? '1º T · ' : '2º T · ') + Math.floor(min) + "'";
  // pênaltis depois dos 90'
  const pl = $('#pens-live');
  if (min >= 90 && wm.shoot && l.endAt) {
    const n = Math.min(wm.shoot.length, Math.floor((now - l.endAt) / 450) + 1);
    const kicks = wm.shoot.slice(0, n); const ph = kicks.filter(k => k.s === 'h' && k.ok).length, pa = kicks.filter(k => k.s === 'a' && k.ok).length;
    pl.innerHTML = `<b>Pênaltis ${ph} × ${pa}</b> ${kicks.map(k => `<span class="${k.ok ? 'ok' : 'x'}" title="${pn(k.p)}">${k.ok ? '●' : '○'}</span>`).join('')}`;
  } else pl.innerHTML = '';
  if (ui.sndRound !== l.at) { ui.sndRound = l.at; ui.wasHT = false; ui.ftDone = false; if (min < 1) play('whistle'); }
  if (ht && !ui.wasHT) { ui.wasHT = true; play('whistle'); }
  if (min >= 90 && !ui.ftDone) { ui.ftDone = true; play('whistle', true); }
  const step = Math.floor(min * 4);
  if (!force && step === lastNotif) return;
  // notificações: gols e lances importantes de todos os jogos; lance a lance do jogo assistido
  const prev = lastNotif < 0 ? -1 : lastNotif / 4; lastNotif = step;
  ms.forEach(m => m.ev.forEach(e => {
    if (e.m > min || e.m <= prev) return;
    if (prev >= 0 && e.t === 'gol') toast((m === wm ? '⚽ ' : '⚽ ') + `${minTxt(e.m)} ${P(e.p).n} (${teamById(e.s === 'h' ? m.h : m.a).name})${e.kind !== 'jogada' ? ' ' + KIND[e.kind] : ''}`);
    if (prev >= 0 && e.t === 'penperdido') toast(`🧤 ${P(e.gk).n} pega pênalti!`);
    if (prev >= 0 && m === wm) { if (e.t === 'gol') play('goal'); else if (e.t === 'penperdido' || e.t === 'defesa') play('ooh'); }
  }));
  $('#lv-mstats').innerHTML = statBars(wm, min);
  const why = $('#lv-why'); if (why) { const fin = min >= 90; why.style.display = fin && wm.why ? '' : 'none'; if (fin && wm.why) why.textContent = '💬 ' + wm.why; }
  $('#lv-feed').innerHTML = wm.ev.filter(e => e.m <= min).reverse().map(e => `<li class="ev-${e.t}">${evText(e, wm)}</li>`).join('') || '<li class="empty">Bola rolando…</li>';
  $('#lv-goals').innerHTML = ms.flatMap(m => m.ev.filter(e => (e.t === 'gol' || e.t === 'vermelho') && e.m <= min).map(e => ({ e, m }))).sort((x, y) => y.e.m - x.e.m).map(({ e, m }) => `<li>${evText(e, m)}</li>`).join('') || '<li class="empty">Nenhum gol ainda</li>';
  $('#lv-table').innerHTML = standingsHTML(min);
  $('#lv-stats').innerHTML = statsHTML(min, 3);
}

/* ---------- FIM ---------- */
function recordHTML() {
  const rec = state.record; if (!rec || !Object.keys(rec).length) return '';
  const rows = Object.entries(rec).map(([id, r]) => ({ id, ...r })).sort((a, b) => b.tit - a.tit || b.vice - a.vice || b.v - a.v || (b.gp - b.gc) - (a.gp - a.gc));
  return `<div class="panel" style="margin-top:18px"><h2>Histórico da sala</h2><div class="lead">Somando todas as partidas jogadas nesta sala.</div>
    <table class="std"><tr><th>#</th><th>Time</th><th>🏆</th><th>Vice</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th></tr>${rows.map((r, i) => `<tr class="${r.id === me.id ? 'me' : ''}"><td>${i + 1}</td><td style="font-family:Archivo;font-weight:700">${esc(r.name)} <small style="color:var(--muted);font-weight:500">${esc(r.coach)}</small></td><td class="pts">${r.tit}</td><td>${r.vice}</td><td>${r.j}</td><td>${r.v}</td><td>${r.e}</td><td>${r.d}</td><td>${r.gp - r.gc}</td></tr>`).join('')}</table></div>`;
}
// ranking final: top 5 de artilheiro, garçom, melhor jogador e paredão
function rankingsHTML(ps, minJ) {
  const tnm = r => esc((teamById(r.team) || {}).name || '');
  const cols = [
    ['⚽', 'Artilheiros', ps.filter(r => r.g).sort((a, b) => b.g - a.g || b.a - a.a), r => r.g + (r.g === 1 ? ' gol' : ' gols')],
    ['🎯', 'Garçons', ps.filter(r => r.a).sort((a, b) => b.a - a.a || b.g - a.g), r => r.a + (r.a === 1 ? ' assist.' : ' assist.')],
    ['⭐', 'Melhores jogadores', ps.filter(r => r.j >= minJ).sort((a, b) => b.nt / b.j - a.nt / a.j), r => 'nota ' + (r.nt / r.j).toFixed(2)],
    ['🧤', 'Paredões', ps.filter(r => P(r.id).p === 'GK' && r.j).sort((a, b) => b.cs - a.cs || b.sv - a.sv), r => `${r.cs} SG · ${r.sv} def.`],
  ];
  return `<div class="panel rankings"><h2>Ranking do campeonato</h2><div class="lead">Os cinco melhores em cada quesito.</div><div class="rk-grid">${cols.map(([ic, t, list, v]) => `
    <div class="rk"><div class="sc-h"><span class="sc-ic">${ic}</span><b>${t}</b></div><ol>${list.slice(0, 5).map((r, i) => `<li class="${i === 0 ? 'first' : ''}"><span class="pos">${i + 1}</span><span class="who">${pn(r.id)}<small>${tnm(r)}</small></span><span class="v">${v(r)}</span></li>`).join('') || '<li class="none">—</li>'}</ol></div>`).join('')}</div></div>`;
}
function renderEnd() {
  view = 'end';
  const order = state.cup.final, champ = teamById(order[0]), mt = myTeam();
  const fmtName = state.cup.format;
  const myPos = mt ? order.indexOf(mt.id) + 1 : 0;
  const posTxt = n => fmtName === 'liga' ? n + 'º lugar' : n === 1 ? 'Campeão' : n === 2 ? 'Vice-campeão' : n <= 4 ? 'Semifinalista' : 'Eliminado antes da semi';
  const ps = E.playerStats(state);
  const top = ps.filter(r => r.g).sort((a, b) => b.g - a.g || b.a - a.a)[0];
  const ast = ps.filter(r => r.a).sort((a, b) => b.a - a.a || b.g - a.g)[0];
  const minJ = Math.max(1, Math.ceil(Math.max(...ps.map(r => r.j)) / 2));
  const best = ps.filter(r => r.j >= minJ).sort((a, b) => b.nt / b.j - a.nt / a.j)[0];
  const wall = ps.filter(r => P(r.id).p === 'GK').sort((a, b) => b.cs - a.cs || b.sv - a.sv)[0];
  const all = state.teams.flatMap(t => t.squad.filter(id => !P(id).base).map(id => ({ id, p: P(id), price: t.paid[id], team: t })));
  const steal = all.slice().sort((a, b) => (b.p.o - b.price * 0.5) - (a.p.o - a.price * 0.5))[0];
  const exp = all.slice().sort((a, b) => b.price - a.price)[0];
  const tnm = r => esc((teamById(r.team) || {}).name || '');
  const card = (l, b, s) => `<div class="award"><div class="lbl">${l}</div><div class="big">${b}</div><div class="small">${s}</div></div>`;
  app.innerHTML = `
  <div class="champ">
    <svg viewBox="0 0 64 64" fill="none"><path d="M18 8h28v12c0 9-6 16-14 16S18 29 18 20V8z" fill="#ffc833"/><path d="M18 12H9c0 8 4 13 10 14M46 12h9c0 8-4 13-10 14" stroke="#ffc833" stroke-width="3" fill="none"/><rect x="29" y="35" width="6" height="11" fill="#e0a91e"/><rect x="21" y="46" width="22" height="6" rx="1" fill="#ffc833"/><rect x="17" y="52" width="30" height="5" rx="1" fill="#f3ecd8"/></svg>
    <div class="kicker k">Campeão</div>
    <h1 style="color:${champ.color}">${esc(champ.name)}</h1>
    <p>${champ.id === me.id ? 'É CAMPEÃO! Seu leilão foi cirúrgico.' : `Técnico: ${esc(champ.coach)}${mt ? ` · Você: ${posTxt(myPos)}` : ''}`}</p>
  </div>
  <div class="endgrid">
    ${card('Artilheiro', top ? pn(top.id) : '—', top ? `${top.g} gols${top.gp ? ' (' + top.gp + ' de pênalti)' : ''} · ${tnm(top)}` : '')}
    ${card('Garçom', ast ? pn(ast.id) : '—', ast ? `${ast.a} assistências · ${tnm(ast)}` : '')}
    ${card('Craque do campeonato', best ? pn(best.id) : '—', best ? `nota média ${(best.nt / best.j).toFixed(2)} · ${tnm(best)}` : '')}
    ${card('Paredão', wall ? pn(wall.id) : '—', wall ? `${wall.cs} jogos sem sofrer gol · ${wall.sv} defesas · ${tnm(wall)}` : '')}
    ${card('Pechincha do leilão', steal ? esc(steal.p.n) : '—', steal ? `${esc(steal.team.name)} · ${fmt(steal.price)} · OVR ${steal.p.o}` : '')}
    ${card('Compra mais cara', exp ? esc(exp.p.n) : '—', exp ? `${esc(exp.team.name)} · ${fmt(exp.price)} · OVR ${exp.p.o}` : '')}
  </div>
  ${rankingsHTML(ps, minJ)}
  <div class="panel">
    <h2>Compartilhe</h2><div class="lead">Copie e mande no grupo.</div>
    <textarea class="share" id="e-share" readonly></textarea>
    ${sponsorHTML('mini')}
    <div class="ctrl"><button class="gold" id="e-img">📸 Imagem para story</button><button class="ghost" id="e-copy">Copiar resultado</button><button class="ghost" id="e-sq">Ver elencos</button>
      ${isHost ? '<button class="ghost" id="e-again">Nova partida (mesma sala)</button>' : ''}<button class="ghost" id="e-leave">Sair</button></div>
  </div>
  ${recordHTML()}`;
  let txt = `💸 ACABOU O DINHEIRO? · Sala ${code}\n🏆 Campeão: ${champ.name} (${champ.coach})\n`;
  if (mt) {
    const bst = mt.squad.filter(id => !P(id).base).sort((a, b) => mt.paid[b] - mt.paid[a])[0];
    txt += `Meu time: ${mt.name} · ${mt.formation} · OVR ${E.teamOvr(state, mt).toFixed(1)}\nResultado: ${posTxt(myPos)}\nMaior compra: ${bst != null ? P(bst).n + ' por R$ ' + mt.paid[bst] : '—'}\nSobrou no caixa: R$ ${mt.budget}\n`;
  }
  if (top) txt += `⚽ Artilheiro: ${P(top.id).n} (${top.g})\n`;
  if (best) txt += `⭐ Craque: ${P(best.id).n}\n`;
  const rec = state.record && mt && state.record[mt.id];
  if (rec && rec.ed > 1) txt += `Histórico na sala: ${rec.tit} título(s) em ${rec.ed} partidas\n`;
  txt += `Joga também: ${location.origin}${location.pathname}\n`;
  $('#e-share').value = txt + 'Bora a próxima?';
  $('#e-copy').onclick = async () => { try { await navigator.clipboard.writeText($('#e-share').value); toast('Copiado!'); } catch (e) { $('#e-share').select(); toast('Selecionado: use Copiar'); } };
  $('#e-sq').onclick = showSquads;
  $('#e-leave').onclick = leaveRoom;
  $('#e-img').onclick = async () => {
    $('#e-img').disabled = true; toast('Gerando imagem…');
    const blob = await resultImage(state, { champ, team: mt && mt.lineup ? mt : null, posTxt: mt ? posTxt(myPos) : '', top, best, rec: state.record && mt ? state.record[mt.id] : null });
    $('#e-img').disabled = false; if (!blob) { toast('Não deu para gerar a imagem'); return; }
    const file = new File([blob], 'acabou-o-dinheiro.png', { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Acabou o dinheiro?' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'acabou-o-dinheiro.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Imagem baixada!');
  };
  fillMail();
  if (isHost) $('#e-again').onclick = () => {
    state.phase = 'lobby'; state.cup = null; state.lot = null; state.base = {}; state.log = []; state.history = []; state.penal = {};
    state.teams.forEach(t => { t.squad = []; t.lineup = null; t.ready = false; t.budget = state.settings.budget; t.paid = {}; });
    publish();
  };
}

/* ---------- reações ---------- */
const REACTS = ['😂', '💸', '🤡', '🔥', '😱', '👏'];
let lastReact = 0;
function reactBar() { return `<div class="reacts">${REACTS.map(e => `<button data-r="${e}" title="Reagir">${e}</button>`).join('')}</div>`; }
function showReaction(p) {
  if (!p || !REACTS.includes(p.e)) return;
  let layer = $('#react-layer'); if (!layer) { layer = document.createElement('div'); layer.id = 'react-layer'; document.body.appendChild(layer); }
  const el = document.createElement('div'); el.className = 'react-fly';
  el.style.left = (12 + Math.random() * 76) + '%';
  el.innerHTML = `<span>${p.e}</span><small style="color:${/^#[0-9a-f]{6}$/i.test(p.c || '') ? p.c : '#fff'}">${esc(String(p.n || '').slice(0, 22))}</small>`;
  layer.appendChild(el); setTimeout(() => el.remove(), 2600); play('pop');
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-r]'); if (!b) return;
  const now = Date.now(); if (now - lastReact < 700) return; lastReact = now;
  const t = myTeam(); const p = { e: b.dataset.r, n: t ? t.name : me.name, c: t ? t.color : '' };
  showReaction(p); if (ch) ch.send('react', p);
});

/* ---------- patrocínio e contato ---------- */
const MAIL = ['mvferreirasilva', 'gmail.com'];
function sponsorHTML(variant) {
  return `<div class="sponsor ${variant || ''}"><span class="sp-tag">Patrocínio</span><div class="sp-body"><b>Sua marca aqui</b><span>Apareça para quem está no meio do leilão. Fale comigo: <a class="mail" href="#">e-mail</a> · <a href="https://x.com/emiverj" target="_blank" rel="noopener">@emiverj</a></span></div></div>`;
}
function fillMail() {
  const addr = MAIL.join('@');
  document.querySelectorAll('a.mail').forEach(a => { a.href = 'mailto:' + addr + '?subject=Acabou%20o%20dinheiro%3F'; a.textContent = addr; });
}
function showRules() {
  $('#modal').innerHTML = `<div class="modal" id="mbg"><div class="inner" style="max-width:820px"><div class="top"><h2>Livro de regras</h2><button class="ghost" id="mclose">Fechar</button></div>${rulesHTML(state ? state.settings : { base: ui.settings.base, order: ui.settings.order, budget: +ui.settings.budget, speed: ui.settings.speed, format: ui.settings.format })}</div></div>`;
  $('#mclose').onclick = () => $('#modal').innerHTML = '';
  $('#mbg').onclick = e => { if (e.target.id === 'mbg') $('#modal').innerHTML = ''; };
}
$('#rules-btn').onclick = showRules;
/* ---------- tema e modo streamer (preferência de cada jogador, guardada no navegador) ---------- */
function applyPrefs() {
  let th = 'dark', sm = false; try { th = localStorage.getItem('acabou-theme') || 'dark'; sm = localStorage.getItem('acabou-streamer') === '1'; } catch (e) {}
  document.body.classList.toggle('light', th === 'light'); document.body.classList.toggle('streamer', sm);
  $('#theme-btn').textContent = th === 'light' ? '🌙' : '☀'; $('#theme-btn').title = th === 'light' ? 'Tema escuro' : 'Tema claro';
  $('#streamer-btn').classList.toggle('on', sm); $('#streamer-btn').textContent = sm ? 'Streamer: ligado' : 'Modo streamer';
}
$('#theme-btn').onclick = () => { try { localStorage.setItem('acabou-theme', document.body.classList.contains('light') ? 'dark' : 'light'); } catch (e) {} applyPrefs(); };
$('#streamer-btn').onclick = () => { try { localStorage.setItem('acabou-streamer', document.body.classList.contains('streamer') ? '0' : '1'); } catch (e) {} applyPrefs(); toast(document.body.classList.contains('streamer') ? 'Modo streamer ligado: código da sala escondido' : 'Modo streamer desligado'); };
applyPrefs();
const syncMute = () => { $('#mute-btn').textContent = isMuted() ? '🔇' : '🔊'; $('#mute-btn').title = isMuted() ? 'Ligar sons' : 'Desligar sons'; };
$('#mute-btn').onclick = () => { setMuted(!isMuted()); syncMute(); if (!isMuted()) play('bid'); };
syncMute();
function askName(cb) {
  $('#modal').innerHTML = `<div class="modal"><div class="inner" style="max-width:480px">
    <h2 style="margin-bottom:6px">Bem-vindo à sala</h2><div class="lead">Como você quer aparecer para os outros técnicos?</div>
    <div class="field"><label>Seu nome</label><input type="text" id="m-name" maxlength="18" placeholder="Ex.: Marcos" value="${esc(me.name)}"></div>
    <div class="field"><label>Nome do time</label><input type="text" id="m-team" maxlength="22" placeholder="Ex.: Belford Roxo FC" value="${esc(me.team)}"></div>
    <button class="cta" id="m-go">Entrar na sala</button></div></div>`;
  const go = () => { const n = $('#m-name').value.trim(); if (!n) { toast('Digite seu nome'); return; } me.name = n.slice(0, 18); me.team = $('#m-team').value.trim().slice(0, 22); saveMe(); $('#modal').innerHTML = ''; cb(); };
  $('#m-go').onclick = go; $('#m-name').focus();
  $('#modal').querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }));
}
fillMail();

/* ---------- início ---------- */
const q = new URLSearchParams(location.search).get('sala');
let resumeHost = false; try { const sv = JSON.parse(localStorage.getItem('acabou-host-' + String(q || '').toUpperCase()) || 'null'); resumeHost = !!(sv && sv.hostId === me.id); } catch (e) {}
if (q && resumeHost) joinRoom(q, true);
else if (q) { render(); askName(() => joinRoom(q, true)); }
else render();
window.__dbg = { get state() { return state; }, get isHost() { return isHost; }, E };
