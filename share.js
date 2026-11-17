// Gera a imagem do resultado (formato story 1080x1920) para compartilhar
import { FORMATIONS, getP, POS_PT, teamOvr } from './engine.js';

function loadImg(src) { return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
function fit(g, text, max, size, font) { let s = size; g.font = `${font.replace('$', s)}`; while (g.measureText(text).width > max && s > 14) { s -= 2; g.font = font.replace('$', s); } return s; }

export async function resultImage(state, opts) {
  const { champ, team, posTxt, top, best, rec } = opts;
  try { await document.fonts.ready; } catch (e) {}
  const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  // fundo
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b2a1a'); bg.addColorStop(1, '#04110a'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.018)' : 'rgba(0,0,0,0)'; g.fillRect(i * 90, 0, 90, H); }
  const logo = await loadImg('logo.png');
  if (logo) { g.save(); g.beginPath(); g.roundRect(70, 80, 150, 150, 26); g.clip(); g.imageSmoothingEnabled = false; g.drawImage(logo, 70, 80, 150, 150); g.restore(); g.strokeStyle = '#ffc833'; g.lineWidth = 6; g.beginPath(); g.roundRect(70, 80, 150, 150, 26); g.stroke(); }
  g.fillStyle = '#f3ecd8'; g.font = '400 64px Anton, Impact, sans-serif'; g.fillText('ACABOU O', 250, 150); g.fillStyle = '#ffc833'; g.fillText('DINHEIRO?', 250, 222);
  // campeão
  g.fillStyle = '#93ab9b'; g.font = '700 30px "IBM Plex Mono", monospace'; g.fillText('CAMPEÃO', 70, 340);
  g.fillStyle = champ.color; fit(g, champ.name.toUpperCase(), W - 140, 110, '400 $px Anton, Impact, sans-serif'); g.fillText(champ.name.toUpperCase(), 70, 450);
  g.fillStyle = '#cfd9cf'; g.font = '500 34px Archivo, sans-serif'; g.fillText('Técnico: ' + champ.coach, 70, 505);
  // time em destaque (o seu, ou o campeão)
  const T = team || champ;
  g.fillStyle = '#93ab9b'; g.font = '700 28px "IBM Plex Mono", monospace'; g.fillText(team && team !== champ ? 'MEU TIME · ' + posTxt.toUpperCase() : 'TIME CAMPEÃO', 70, 600);
  g.fillStyle = '#f3ecd8'; fit(g, T.name, 500, 52, '800 $px Archivo, sans-serif'); g.fillText(T.name, 70, 660);
  g.fillStyle = '#ffc833'; g.font = '700 34px "IBM Plex Mono", monospace'; g.textAlign = 'right'; g.fillText(T.formation + ' · OVR ' + teamOvr(state, T).toFixed(1), W - 70, 660); g.textAlign = 'left';
  // campinho
  const px = 70, py = 700, pw = W - 140, ph = 860;
  for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#16542f' : '#185c33'; g.fillRect(px, py + i * ph / 10, pw, ph / 10); }
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 4; g.strokeRect(px, py, pw, ph);
  g.beginPath(); g.arc(px + pw / 2, py, 110, 0, Math.PI); g.stroke(); g.strokeRect(px + pw * .28, py + ph - 150, pw * .44, 150);
  FORMATIONS[T.formation].forEach((s, i) => {
    const p = getP(state, T.lineup[i]); const x = px + pw * s.x / 100, y = py + ph - ph * (s.y / 100) * 0.95 - 20;
    g.fillStyle = 'rgba(6,20,13,.88)'; g.beginPath(); g.roundRect(x - 92, y - 40, 184, 80, 14); g.fill(); g.strokeStyle = T.color; g.lineWidth = 3; g.stroke();
    g.textAlign = 'center'; g.fillStyle = '#ffc833'; g.font = '700 20px "IBM Plex Mono", monospace'; g.fillText(POS_PT[s.pos] + ' · ' + p.o, x, y - 10);
    g.fillStyle = '#fff'; const nm = p.n.split(' ').slice(-1)[0]; fit(g, nm, 170, 28, '800 $px Archivo, sans-serif'); g.fillText(nm, x, y + 24); g.textAlign = 'left';
  });
  // destaques
  let y = 1640; const line = (lbl, val) => { g.fillStyle = '#93ab9b'; g.font = '700 26px "IBM Plex Mono", monospace'; g.fillText(lbl, 70, y); g.fillStyle = '#f3ecd8'; fit(g, val, W - 400, 36, '700 $px Archivo, sans-serif'); g.fillText(val, 360, y); y += 58; };
  if (top) line('ARTILHEIRO', `${getP(state, top.id).n} · ${top.g} gols`);
  if (best) line('CRAQUE', getP(state, best.id).n);
  if (rec && rec.ed > 1) line('NA SALA', `${rec.tit} título(s) em ${rec.ed} partidas`);
  g.fillStyle = '#ffc833'; g.font = '400 40px Anton, Impact, sans-serif'; g.textAlign = 'center'; g.fillText('“ACABOU O DINHEIRO!”', W / 2, H - 70); g.textAlign = 'left';
  return new Promise(res => c.toBlob(b => res(b), 'image/png'));
}
