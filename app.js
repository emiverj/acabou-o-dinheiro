// Acabou o dinheiro? — interface e sincronização
import * as E from './engine.js';
import { PLAYERS } from './players.js';
import { openChannel, ONLINE } from './net.js';
import { rulesHTML } from './rules.js';
import { jerseySVG } from './kits.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const fmt = n => '€' + n;
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
const ui = { asel: null, settings: { budget: '100', max: '8', format: 'liga', speed: 'normal', hide: '0', pub: '1' }, sel: null, draft: null };

const P = id => E.getP(state, id);
const myTeam = () => state && state.teams.find(t => t.id === me.id);
const teamById = id => state.teams.find(t => t.id === id);
const hostNow = () => Date.now() + offset;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2200); }
function strip(s) { return JSON.parse(JSON.stringify(s, (k, v) => (k === '_ai' || k === 'pool') ? undefined : v)); }
function genCode() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 5; i++) c += a[Math.floor(Math.random() * a.length)]; return c; }
const tn = id => { const t = teamById(id); return t ? `<span style="color:${t.color}">●</span> ${esc(t.name)}` : '<span style="color:var(--muted)">folga</span>'; };
const posLabel = p => E.POS_PT[p.p] || p.p;
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
  state.v++; state.hostNow = Date.now();
  if (ch) ch.send('state', strip(state));
  try { localStorage.setItem('acabou-host-' + code, JSON.stringify(state)); } catch (e) {}
  render();
}
function heartbeat() {
  if (!isHost || !state || !ch) return;
  state.hostNow = Date.now(); ch.send('state', strip(state));
  if (state.settings.pub && lobbyCh && state.phase === 'lobby') {
    lobbyCh.send('room', { code, name: state.teams[0].name, host: state.teams[0].coach, count: state.teams.length, max: state.settings.max, ts: Date.now() });
  }
}
function onMsg(ev, p) {
  if (ev === 'state' && !isHost) {
    if (!p || p.code !== code) return;
    if (state && p.hostNow < state.hostNow) return;
    const prevPhase = state && state.phase;
    state = p; offset = p.hostNow - Date.now(); lastSeen = Date.now();
    if (joinIv && (state.teams.some(t => t.id === me.id) || state.phase !== 'lobby')) { clearInterval(joinIv); joinIv = null; }
    if (prevPhase !== state.phase) { ui.sel = null; ui.draft = null; }
    render();
  } else if (ev === 'action' && isHost) handleAction(p);
}
function act(a) { a.id = me.id; if (isHost) handleAction(a); else if (ch) ch.send('action', a); }

function handleAction(a) {
  if (!state || !a) return;
  const now = Date.now(), t = teamById(a.id);
  switch (a.type) {
    case 'join': {
      if (!t) {
        if (state.phase !== 'lobby' || state.teams.length >= state.settings.max) { heartbeat(); return; }
        const used = state.teams.map(x => x.color); const idx = E.COLORS.findIndex(c => !used.includes(c));
        const nt = E.mkTeam(a.id, String(a.name || 'Técnico').slice(0, 18), String(a.team || '').slice(0, 22), false, Math.max(0, idx));
        state.teams.push(nt);
      } else if (state.phase === 'lobby') { t.coach = String(a.name || t.coach).slice(0, 18); if (a.team) t.name = String(a.team).slice(0, 22); }
      publish(); break;
    }
    case 'leave': if (t && state.phase === 'lobby' && a.id !== state.hostId) { state.teams = state.teams.filter(x => x !== t); publish(); } break;
    case 'formation': if (t && E.FORMATIONS[a.formation] && (state.phase === 'lobby' || state.phase === 'auction')) { t.formation = a.formation; if (state.phase === 'auction') t.lineup = E.arrange(state, t, a.formation); publish(); } break;
    case 'arrange': if (t && state.phase === 'auction') { E.setArrangement(state, a.id, a.formation, a.lineup); publish(); } break;
    case 'bid': if (t && state.phase === 'auction' && state.lot && state.lot.no === a.lotNo) { const err = E.placeBid(state, a.id, +a.amount, now); if (!err) publish(); } break;
    case 'pass': if (t && state.phase === 'auction' && state.lot && state.lot.no === a.lotNo) { E.passLot(state, a.id); publish(); } break;
    case 'lineup': if (t && state.phase === 'lineup') { E.setLineup(state, a.id, a.formation, a.lineup); publish(); } break;
    case 'ready': if (t && state.phase === 'lineup') { t.ready = !!a.ready; publish(); } break;
  }
}
function hostLoop() {
  if (!state) return;
  const now = Date.now(); let changed = false;
  if (state.phase === 'auction') changed = E.tickAuction(state, now);
  else if (state.phase === 'lineup') {
    const humans = state.teams.filter(t => !t.bot);
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
  const settings = { budget: +s.budget, max: +s.max, format: s.format, speed: s.speed, hideOvr: s.hide === '1', pub: s.pub === '1' };
  state = E.newRoomState(code, me, settings); isHost = true;
  try { ch = await openChannel('room-' + code, onMsg); } catch (e) { toast(e.message); state = null; isHost = false; return; }
  try { history.replaceState(null, '', '?sala=' + code); } catch (e) {}
  startHostLoops(); publish();
}
async function joinRoom(c, auto) {
  c = String(c || '').trim().toUpperCase();
  if (c.length < 4) { toast('Código inválido'); return; }
  if (!auto && !readNames()) return;
  code = c;
  let saved = null; try { saved = JSON.parse(localStorage.getItem('acabou-host-' + code) || 'null'); } catch (e) { saved = null; }
  try { ch = await openChannel('room-' + code, onMsg); } catch (e) { toast(e.message); code = null; return; }
  try { history.replaceState(null, '', '?sala=' + code); } catch (e) {}
  if (saved && saved.hostId === me.id) { state = saved; isHost = true; startHostLoops(); publish(); return; }
  isHost = false; state = null; renderConnecting();
  if (!me.name) { me.name = 'Técnico ' + me.id.slice(0, 3); }
  const send = () => ch.send('action', { type: 'join', id: me.id, name: me.name, team: me.team });
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
  if (!state) return renderHome();
  const fn = { lobby: renderLobby, auction: renderAuction, lineup: renderLineup, cup: renderCup, end: renderEnd }[state.phase];
  fn && fn();
}
function seg(key, opts) {
  return `<div class="seg" data-k="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${ui.settings[key] === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}
function renderHome() {
  view = 'home';
  app.innerHTML = `
  <div class="hero">
    <div>
      <div class="kicker">Leilão de futebol com os amigos</div>
      <h1>€100.<br>Onze titulares.<br><em>Acabou o dinheiro?</em></h1>
      <p class="sub">Crie uma sala, chame os amigos e disputem no martelo os ${PLAYERS.length} melhores jogadores do futebol europeu (OVR 81+). Depois escale seu time e veja quem leva o título na simulação.</p>
      <div class="chips"><span class="chip">1 goleiro + 10 de linha</span><span class="chip">€100 por técnico</span><span class="chip">2 a 10 técnicos</span><span class="chip">Leilão ao vivo</span></div>
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
      <div class="grid2">
        <div class="field"><label>Orçamento</label>${seg('budget', [['100','€100'],['150','€150'],['200','€200']])}</div>
        <div class="field"><label>Máx. de técnicos</label><select id="f-max">${[2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}" ${+ui.settings.max === n ? 'selected' : ''}>${n} técnicos</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Campeonato</label>${seg('format', [['liga','Pontos corridos'],['mata','Mata-mata'],['grupos','Grupos + mata-mata']])}</div>
      <div class="grid2">
        <div class="field"><label>Velocidade do leilão</label>${seg('speed', [['normal','Normal'],['rapido','Rápido']])}</div>
        <div class="field"><label>Overall no leilão</label>${seg('hide', [['0','Visível'],['1','Escondido']])}</div>
      </div>
      <div class="field"><label>Sala</label>${seg('pub', [['1','Pública'],['0','Privada (só com código)']])}</div>
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
  ${sponsorHTML()}
  <div class="panel" style="margin-top:20px"><h2>Livro de regras</h2><div class="lead">Tudo o que você precisa saber antes do martelo bater.</div><div id="home-rules"></div></div>`;
  const homeRules = () => { $('#home-rules').innerHTML = rulesHTML({ budget: +ui.settings.budget, speed: ui.settings.speed, format: ui.settings.format }); };
  homeRules(); fillMail();
  app.querySelectorAll('.seg').forEach(sg => sg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    ui.settings[sg.dataset.k] = b.dataset.v; sg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    homeRules();
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
  el.innerHTML = list.length ? list.map(r => `<li><span><b>${esc(r.name)}</b><br><small>${esc(r.host)} · ${r.count}/${r.max} técnicos</small></span><button class="ghost" data-code="${esc(r.code)}">Entrar</button></li>`).join('')
    : '<li class="empty" style="border:0;background:none">Nenhuma sala pública agora. Crie a sua!</li>';
  el.querySelectorAll('button[data-code]').forEach(b => b.onclick = () => joinRoom(b.dataset.code));
}
setInterval(() => { if (view === 'home') renderRooms(); updateBadge(); }, 3000);
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
        <div class="codebox"><div class="code-big">${esc(code)}</div><button class="gold" id="copy">Copiar convite</button></div>
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
    <div class="panel" style="margin-top:18px"><h2>Livro de regras</h2><div class="lead">Leia antes de começar: vale para todos nesta sala.</div><div id="rulebook"></div></div>
    ${sponsorHTML()}`;
    $('#leave').onclick = leaveRoom;
    fillMail();
    $('#copy').onclick = async () => { const link = location.origin + location.pathname + '?sala=' + code; try { await navigator.clipboard.writeText(`Bora pro leilão no "Acabou o dinheiro?" 💸 Código: ${code} — ${link}`); toast('Convite copiado!'); } catch (e) { toast('Código: ' + code); } };
  }
  const s = state.settings;
  $('#rulebook').innerHTML = rulesHTML(s);
  $('#rules').innerHTML = `<b>Regras da sala:</b> orçamento ${fmt(s.budget)} · ${{ liga:'pontos corridos', mata:'mata-mata', grupos:'grupos + mata-mata' }[s.format]} · leilão ${s.speed === 'rapido' ? 'rápido' : 'normal'} · overall ${s.hideOvr ? 'escondido' : 'visível'} · até ${s.max} técnicos`;
  $('#plist').innerHTML = state.teams.map(t => `<div class="prow2">
      <span class="dot" style="background:${t.color};width:14px;height:14px"></span>
      <div><div class="nm">${esc(t.name)}${t.id === me.id ? ' (você)' : ''}</div><small>${esc(t.coach)} · ${esc(t.formation)}${t.bot ? ' · ' + esc(t.pers.n) : ''}</small></div>
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
    $('#startA').onclick = () => { if (state.teams.length < 2) return; E.startAuction(state); publish(); };
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
  const hw = p.h ? `${(p.h / 100).toFixed(2).replace('.', ',')} m · ${p.w} kg` : '—';
  return `<div class="pcard ${tier}">
    <div class="pc-head"><div><div class="pc-ovr">${hide ? '??' : p.o}</div><div class="pc-pos">${posLabel(p)}</div></div><div class="pc-nat">${esc(p.c)}</div></div>
    <div class="pc-shirt">${jerseySVG(p.t, p.n)}</div>
    <div class="pc-name">${esc(p.n)}</div>
    <div class="pc-club">${esc(p.t)}</div>
    <div class="pc-foot"><div><span>Posições</span><b>${posLabel(p)}${p.a.length ? ' · ' + alt : ''}</b></div><div><span>Altura · peso</span><b>${hw}</b></div></div>
  </div>`;
}
let lastCardNo = -1;
function renderAuction() {
  if (view !== 'auction') {
    view = 'auction'; lastStampKey = ''; lastCardNo = -1; ui.asel = null;
    app.innerHTML = `
    <div class="ah"><h2>Leilão ao vivo</h2><div class="prog" id="a-prog"></div></div>
    <div class="agrid">
      <div class="lot" id="lot">
        <div class="lot-top"><span class="lotno" id="l-no"></span><span class="lotno" id="l-floor"></span></div>
        <div class="lot-body">
          <div id="l-card"></div>
          <div class="lot-right">
            <div class="board">
              <div><div class="lbl">Lance atual</div><div class="price" id="l-price">€0</div></div>
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
              <div class="custom"><input type="number" id="l-custom" min="1" placeholder="Outro valor (€)"><button class="ghost" id="l-send">Dar lance</button><button class="pass" id="l-pass">Passar</button></div>
            </div>
            <div class="hint" id="l-hint"></div>
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
  $('#a-prog').textContent = `Lote ${state.lotNo} · ${sold}/${state.teams.length * 11} vagas preenchidas`;
  if (lot) {
    const p = PLAYERS[lot.pid];
    $('#l-no').textContent = 'LOTE ' + lot.no;
    const fl = E.floorFor(state, p);
    $('#l-floor').textContent = fl > 1 ? `lance mínimo €${fl}` : '';
    if (lastCardNo !== lot.no) { lastCardNo = lot.no; $('#l-card').innerHTML = cardHTML(p, state.settings.hideOvr); }
    $('#l-price').textContent = fmt(lot.leader ? lot.price : 0);
    const L = lot.leader && teamById(lot.leader);
    $('#l-leader').innerHTML = L ? `<i class="dot" style="background:${L.color}"></i>${esc(L.name)}${L.id === me.id ? ' (você)' : ''}` : '<span style="color:var(--muted)">Ninguém ainda</span>';
    const key = lot.no + lot.status, st = $('#stamp');
    if (lot.status !== 'open' && key !== lastStampKey) {
      lastStampKey = key;
      const w = lot.winner && teamById(lot.winner);
      st.innerHTML = w ? `Vendido<small>${esc(w.name)} · ${fmt(lot.price)}</small>` : 'Sem lances<small>jogador fora do leilão</small>';
      st.className = 'stamp show' + (w ? (w.id === me.id ? ' mine' : '') : ' none');
      if (w && w.id === me.id) toast(`${p.n} é seu por ${fmt(lot.price)}!`);
    } else if (lot.status === 'open') st.className = 'stamp';
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
    else h = `Saldo: <b>${fmt(mt.budget)}</b> · Vagas: <b>${E.slots(mt)}</b> (${E.hasGK(state, mt) ? 'goleiro ✓' : 'falta goleiro'}) · Teto neste lote: <b>${fmt(lim)}</b> · Seu lance mínimo: <b>${fmt(mn)}</b><br>Atalhos: <b>1</b> +1 · <b>2</b> +5 · <b>3</b> +10 · <b>4</b> máx. · <b>P</b> passar`;
    $('#l-hint').innerHTML = h;
  }
  $('#ffbar').classList.toggle('on', isHost && state.teams.every(t => t.bot || E.slots(t) === 0));
  $('#tlist').innerHTML = state.teams.map(t => `<div class="trow ${lot && lot.status === 'open' && lot.leader === t.id ? 'lead' : ''} ${t.id === me.id ? 'me' : ''}">
      <div class="tn"><i class="dot" style="background:${t.color}"></i><span>${esc(t.name)}</span></div>
      <div class="tb">${fmt(t.budget)}</div>
      <div class="tsub">${t.bot ? esc(t.coach) + ' · bot' : esc(t.coach)} · ${esc(t.formation)}</div>
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
        if (!lot.leader) { const fl = E.floorFor(state, PLAYERS[lot.pid]); c.textContent = left <= 3 ? 'Ninguém? Última chance…' : 'Lance inicial: €' + fl; c.classList.toggle('hot', left <= 3); }
        else if (left <= 1) { c.textContent = 'Dou-lhe três…'; c.classList.add('hot'); }
        else if (left <= 2) { c.textContent = 'Dou-lhe duas…'; c.classList.add('hot'); }
        else if (left <= 3) { c.textContent = 'Dou-lhe uma…'; c.classList.remove('hot'); }
        else { const L = teamById(lot.leader); c.textContent = `${L && L.id === me.id ? 'Você' : L ? L.name : ''} na frente · ${Math.ceil(left)}s`; c.classList.remove('hot'); }
      }
    }
  }
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
        <div class="ctrl"><button class="gold" id="lu-ready">Estou pronto</button><button class="ghost" id="lu-squads">Ver elencos</button></div>`;
      $('#lu-form').onchange = e => { ui.draft.formation = e.target.value; ui.draft.lineup = E.autoLineup(state, mt.squad, ui.draft.formation); ui.sel = null; sendDraft(); };
      $('#lu-auto').onclick = () => { ui.draft.lineup = E.autoLineup(state, mt.squad, ui.draft.formation); ui.sel = null; sendDraft(); };
      $('#lu-best').onclick = () => { const b = E.bestFormation(state, mt.squad); ui.draft = { formation: b.name, lineup: b.lineup }; $('#lu-form').value = b.name; ui.sel = null; sendDraft(); toast('Sugestão: ' + b.name); };
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
function matchCard(m) {
  const H = teamById(m.h), A = teamById(m.a);
  if (!H || !A) return '';
  const mine = m.h === me.id || m.a === me.id;
  const names = arr => { const c = {}; arr.forEach(id => { const n = P(id).n; c[n] = (c[n] || 0) + 1; }); return Object.entries(c).map(([n, k]) => esc(n) + (k > 1 ? ` (${k})` : '')).join(', '); };
  return `<div class="match ${mine ? 'me' : ''}">${m.g ? `<div class="mtag">${esc(m.g)}</div>` : ''}<div class="mrow"><div class="h ${m.played && m.w === m.h ? 'win' : ''}">${tn(m.h)}</div>
    <div class="score ${m.played ? '' : 'pending'}">${m.played ? m.hg + ' × ' + m.ag : 'vs'}</div><div class="a ${m.played && m.w === m.a ? 'win' : ''}">${tn(m.a)}</div></div>
    ${m.played ? `<div class="scorers"><div>${names(m.sh)}</div><div>${names(m.sa)}</div></div>` : ''}${m.pens ? `<div class="pens">Pênaltis: ${m.pens[0]} × ${m.pens[1]}</div>` : ''}</div>`;
}
function tableHTML(rows) {
  return `<table class="std"><tr><th>#</th><th>Time</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th></tr>${E.sortTable(state, rows).map((r, i) => `<tr class="${r.id === me.id ? 'me' : ''}"><td>${i + 1}</td><td>${tn(r.id)}</td><td class="pts">${r.pts}</td><td>${r.j}</td><td>${r.v}</td><td>${r.e}</td><td>${r.d}</td><td>${r.gp - r.gc}</td></tr>`).join('')}</table>`;
}
function renderCup() {
  view = 'cup';
  const cup = state.cup, up = E.upcoming(state);
  let side = '';
  if (cup.phase === 'liga') side = `<h3>Classificação</h3>${tableHTML(cup.table)}`;
  else if (cup.phase === 'grupos') side = cup.groups.map(g => `<div class="grp"><h4>${esc(g.name)}</h4>${tableHTML(g.table)}</div>`).join('') + '<div class="hint">Os 2 primeiros de cada grupo avançam ao mata-mata.</div>';
  else side = `<h3>Chaveamento</h3><div class="bracket">${cup.ko.map(rd => `<div class="bround"><h4>${E.koName(rd.length * 2)}</h4>${rd.map(m => `<div class="bm"><span class="${m.played && m.w === m.h ? 'w' : ''}">${m.h ? esc(teamById(m.h).name) : 'folga'}</span><span>${m.played && !m.bye ? m.hg + '×' + m.ag + (m.pens ? ' (p)' : '') : '·'}</span><span class="${m.played && m.w === m.a ? 'w' : ''}">${m.a ? esc(teamById(m.a).name) : 'folga'}</span></div>`).join('')}</div>`).join('')}</div>`;
  if (cup.groups && cup.phase === 'ko') side += cup.groups.map(g => `<div class="grp" style="margin-top:14px"><h4>${esc(g.name)} (final)</h4>${tableHTML(g.table)}</div>`).join('');
  const sc = E.topScorers(state, 6);
  app.innerHTML = `
  <div class="ah"><h2>${cup.last ? esc(cup.last.title) : 'Campeonato'}</h2><div class="prog">${{ liga:'Pontos corridos', mata:'Mata-mata', grupos:'Grupos + mata-mata' }[cup.format]} · próximo: ${esc(E.nextTitle(state))}</div></div>
  <div class="cgrid">
    <div>
      ${cup.last ? `<div class="lbl" style="margin:0 0 8px">Resultados</div><div class="matches">${cup.last.matches.map(matchCard).join('')}</div>` : ''}
      ${up.length ? `<div class="lbl" style="margin:18px 0 8px">Próximos jogos · ${esc(E.nextTitle(state))}</div><div class="matches">${up.filter(m => m.h && m.a).map(matchCard).join('')}</div>` : ''}
      <div class="ctrl">${isHost ? `<button class="gold" id="c-next">Jogar ${esc(E.nextTitle(state).toLowerCase())}</button><button class="ghost" id="c-all">Simular tudo</button>` : '<span class="lead" style="margin:0">O anfitrião controla as rodadas.</span>'}<button class="ghost" id="c-sq">Ver elencos</button></div>
    </div>
    <div class="side"><div class="box">${side}</div>
      <div class="box"><h3>Artilharia</h3><ul class="scorerlist">${sc.length ? sc.map(s => `<li><span>${esc(P(s.id).n)} <small style="color:var(--muted)">· ${esc(teamById(s.team).name)}</small></span><span>${s.g}</span></li>`).join('') : '<li><span style="color:var(--muted)">Nenhum gol ainda</span><span></span></li>'}</ul></div>
    </div>
  </div>`;
  $('#c-sq').onclick = showSquads;
  if (isHost) {
    $('#c-next').onclick = () => { E.advanceCup(state); publish(); };
    $('#c-all').onclick = () => { let g = 0; while (!state.cup.done && g++ < 300) E.advanceCup(state); publish(); };
  }
}

/* ---------- FIM ---------- */
function renderEnd() {
  view = 'end';
  const order = state.cup.final, champ = teamById(order[0]), mt = myTeam();
  const fmtName = state.cup.format;
  const myPos = mt ? order.indexOf(mt.id) + 1 : 0;
  const posTxt = n => fmtName === 'liga' ? n + 'º lugar' : n === 1 ? 'Campeão' : n === 2 ? 'Vice-campeão' : n <= 4 ? 'Semifinalista' : 'Eliminado antes da semi';
  const top = E.topScorers(state, 1)[0];
  const all = state.teams.flatMap(t => t.squad.filter(id => !P(id).base).map(id => ({ id, p: P(id), price: t.paid[id], team: t })));
  const steal = all.slice().sort((a, b) => (b.p.o - b.price * 0.5) - (a.p.o - a.price * 0.5))[0];
  const exp = all.slice().sort((a, b) => b.price - a.price)[0];
  const card = (l, b, s) => `<div class="award"><div class="lbl">${l}</div><div class="big">${b}</div><div class="small">${s}</div></div>`;
  app.innerHTML = `
  <div class="champ">
    <svg viewBox="0 0 64 64" fill="none"><path d="M18 8h28v12c0 9-6 16-14 16S18 29 18 20V8z" fill="#ffc833"/><path d="M18 12H9c0 8 4 13 10 14M46 12h9c0 8-4 13-10 14" stroke="#ffc833" stroke-width="3" fill="none"/><rect x="29" y="35" width="6" height="11" fill="#e0a91e"/><rect x="21" y="46" width="22" height="6" rx="1" fill="#ffc833"/><rect x="17" y="52" width="30" height="5" rx="1" fill="#f3ecd8"/></svg>
    <div class="kicker k">Campeão</div>
    <h1 style="color:${champ.color}">${esc(champ.name)}</h1>
    <p>${champ.id === me.id ? 'É CAMPEÃO! Seu leilão foi cirúrgico.' : `Técnico: ${esc(champ.coach)}${mt ? ` · Você: ${posTxt(myPos)}` : ''}`}</p>
  </div>
  <div class="endgrid">
    ${card('Artilheiro', top ? esc(P(top.id).n) : '—', top ? `${top.g} gols · ${esc(teamById(top.team).name)}` : '')}
    ${card('Pechincha do leilão', steal ? esc(steal.p.n) : '—', steal ? `${esc(steal.team.name)} · ${fmt(steal.price)} · OVR ${steal.p.o}` : '')}
    ${card('Compra mais cara', exp ? esc(exp.p.n) : '—', exp ? `${esc(exp.team.name)} · ${fmt(exp.price)} · OVR ${exp.p.o}` : '')}
  </div>
  <div class="panel">
    <h2>Compartilhe</h2><div class="lead">Copie e mande no grupo.</div>
    <textarea class="share" id="e-share" readonly></textarea>
    ${sponsorHTML('mini')}
    <div class="ctrl"><button class="gold" id="e-copy">Copiar resultado</button><button class="ghost" id="e-sq">Ver elencos</button>
      ${isHost ? '<button class="ghost" id="e-again">Nova partida (mesma sala)</button>' : ''}<button class="ghost" id="e-leave">Sair</button></div>
  </div>`;
  let txt = `💸 ACABOU O DINHEIRO? · Sala ${code}\n🏆 Campeão: ${champ.name} (${champ.coach})\n`;
  if (mt) {
    const best = mt.squad.filter(id => !P(id).base).sort((a, b) => mt.paid[b] - mt.paid[a])[0];
    txt += `Meu time: ${mt.name} · ${mt.formation} · OVR ${E.teamOvr(state, mt).toFixed(1)}\nResultado: ${posTxt(myPos)}\nMaior compra: ${best != null ? P(best).n + ' por €' + mt.paid[best] : '—'}\nSobrou no caixa: €${mt.budget}\n`;
  }
  if (top) txt += `⚽ Artilheiro: ${P(top.id).n} (${top.g})\n`;
  txt += `Joga também: ${location.origin}${location.pathname}\n`;
  $('#e-share').value = txt + 'Bora a próxima?';
  $('#e-copy').onclick = async () => { try { await navigator.clipboard.writeText($('#e-share').value); toast('Copiado!'); } catch (e) { $('#e-share').select(); toast('Selecionado: use Copiar'); } };
  $('#e-sq').onclick = showSquads;
  $('#e-leave').onclick = leaveRoom;
  fillMail();
  if (isHost) $('#e-again').onclick = () => {
    state.phase = 'lobby'; state.cup = null; state.lot = null; state.base = {}; state.log = [];
    state.teams.forEach(t => { t.squad = []; t.lineup = null; t.ready = false; t.budget = state.settings.budget; t.paid = {}; });
    publish();
  };
}

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
  $('#modal').innerHTML = `<div class="modal" id="mbg"><div class="inner" style="max-width:820px"><div class="top"><h2>Livro de regras</h2><button class="ghost" id="mclose">Fechar</button></div>${rulesHTML(state ? state.settings : { budget: +ui.settings.budget, speed: ui.settings.speed, format: ui.settings.format })}</div></div>`;
  $('#mclose').onclick = () => $('#modal').innerHTML = '';
  $('#mbg').onclick = e => { if (e.target.id === 'mbg') $('#modal').innerHTML = ''; };
}
$('#rules-btn').onclick = showRules;
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
