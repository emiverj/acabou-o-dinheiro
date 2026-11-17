// Camisas ilustradas por clube (cores e padrão aproximados, sem escudos)
// p = cor principal, s = secundária, t = cor do nome, pat = padrão
const K = (p, s, t, pat = 'solid') => ({ p, s, t, pat });
export const KITS = {
  'Real Madrid': K('#f5f5f5', '#c9a227', '#1d2b5c'),
  'Manchester City': K('#6cabdd', '#ffffff', '#1c2c5b'),
  'FC Barcelona': K('#a50044', '#004d98', '#ffd700', 'stripes'),
  'Bayern de Munique': K('#dc052d', '#ffffff', '#ffffff'),
  'PSG': K('#004170', '#da291c', '#ffffff', 'band'),
  'Manchester United': K('#da291c', '#1a1a1a', '#ffffff'),
  'Arsenal': K('#ef0107', '#ffffff', '#ffffff', 'sleeves'),
  'Liverpool': K('#c8102e', '#f6eb61', '#ffffff'),
  'Atlético de Madrid': K('#cb3524', '#ffffff', '#272e61', 'stripes'),
  'Inter': K('#0068a8', '#111111', '#ffd700', 'stripes'),
  'Milan': K('#fb090b', '#111111', '#ffffff', 'stripes'),
  'Borussia Dortmund': K('#fde100', '#111111', '#111111'),
  'SSC Napoli': K('#12a0d7', '#ffffff', '#ffffff'),
  'Chelsea': K('#034694', '#ffffff', '#ffffff'),
  'Juventus': K('#ffffff', '#111111', '#c9a227', 'stripes'),
  'FC Porto': K('#ffffff', '#1c3f94', '#1c3f94', 'stripes'),
  'Atalanta': K('#1e71b8', '#111111', '#ffffff', 'stripes'),
  'AS Roma': K('#8e1f2f', '#f0bc42', '#f0bc42'),
  'Tottenham': K('#ffffff', '#132257', '#132257'),
  'Everton': K('#003399', '#ffffff', '#ffffff'),
  'Aston Villa': K('#670e36', '#95bfe5', '#f2c94c', 'sleeves'),
  'Athletic Club': K('#ee2523', '#ffffff', '#111111', 'stripes'),
  'Galatasaray': K('#a90432', '#fdb912', '#ffffff', 'halves'),
  'Sunderland': K('#eb172b', '#ffffff', '#111111', 'stripes'),
  'VfB Stuttgart': K('#ffffff', '#e32219', '#e32219', 'band'),
  'Bayer Leverkusen': K('#e32221', '#111111', '#ffffff'),
  'Club Brugge': K('#0066b3', '#111111', '#ffffff', 'stripes'),
  'TSG Hoffenheim': K('#1961b5', '#ffffff', '#ffffff'),
  'Como': K('#1c4b9c', '#ffffff', '#ffffff'),
  'Real Sociedad': K('#0067b1', '#ffffff', '#ffffff', 'stripes'),
  'Lecce': K('#ffd200', '#d71920', '#d71920', 'stripes'),
  'RB Leipzig': K('#ffffff', '#dd0741', '#dd0741'),
  'Nottingham Forest': K('#dd0000', '#ffffff', '#ffffff'),
  'Fenerbahçe': K('#163962', '#ffed00', '#ffed00', 'stripes'),
  'Newcastle': K('#ffffff', '#111111', '#c9a227', 'stripes'),
  'Fiorentina': K('#50248f', '#ffffff', '#ffffff'),
  'Olympiacos FC': K('#e3001b', '#ffffff', '#ffffff', 'stripes'),
  'Real Betis': K('#00954c', '#ffffff', '#111111', 'stripes'),
  'SC Freiburg': K('#e2001a', '#111111', '#ffffff'),
  'Sporting CP': K('#008057', '#ffffff', '#111111', 'hoops'),
  'Beşiktaş': K('#ffffff', '#111111', '#c00000', 'stripes'),
  'Lyon': K('#ffffff', '#1a5ba6', '#1a5ba6', 'band'),
  'Crystal Palace': K('#c4122e', '#1b458f', '#ffffff', 'stripes'),
  'Bologna': K('#a21c26', '#1a2f48', '#ffffff', 'stripes'),
  'SS Lazio': K('#87d8f7', '#ffffff', '#0b2a4a'),
  'Villarreal CF': K('#ffe667', '#005187', '#005187'),
  'SL Benfica': K('#e83030', '#ffffff', '#ffffff'),
  'Eintracht Frankfurt': K('#111111', '#e1000f', '#ffffff', 'sleeves'),
  'RC Lens': K('#ffe500', '#ec1c24', '#ec1c24', 'stripes'),
  'Sassuolo': K('#00a752', '#111111', '#ffffff', 'stripes'),
  'Brentford': K('#e30613', '#ffffff', '#111111', 'stripes'),
  'CA Osasuna': K('#d91a21', '#0a346f', '#ffffff'),
  'AS Monaco': K('#ffffff', '#e7182c', '#111111', 'sash'),
  'PSV': K('#ed1c24', '#ffffff', '#111111', 'stripes'),
  'Stade Rennais FC': K('#e13327', '#111111', '#ffffff'),
  'Brighton': K('#0057b8', '#ffffff', '#111111', 'stripes'),
  'AFC Bournemouth': K('#da291c', '#111111', '#ffffff', 'stripes'),
  '1. FSV Mainz 05': K('#c3141e', '#ffffff', '#ffffff'),
  'Rayo Vallecano': K('#ffffff', '#e53027', '#111111', 'sash'),
  'Leeds United': K('#ffffff', '#ffcd00', '#1d428a'),
  'Celta': K('#8ac3ee', '#ffffff', '#0b2a4a'),
  'Base': K('#2f6b45', '#f3ecd8', '#f3ecd8', 'hoops'),
  // Brasileirão
  'Palmeiras': K('#006437', '#ffffff', '#ffffff'),
  'Flamengo': K('#c4161c', '#111111', '#ffffff', 'hoops'),
  'Cruzeiro': K('#1b3f94', '#ffffff', '#ffffff'),
  'Corinthians': K('#ffffff', '#111111', '#111111'),
  'Vasco': K('#111111', '#ffffff', '#ffffff', 'sash'),
  'Botafogo': K('#111111', '#ffffff', '#ffffff', 'stripes'),
  'Bahia': K('#ffffff', '#1d4fa0', '#d0202e'),
  'Fluminense': K('#7a1c33', '#0b6b3a', '#ffffff', 'stripes'),
  'Santos': K('#ffffff', '#111111', '#111111'),
  'Atlético-MG': K('#ffffff', '#111111', '#111111', 'stripes'),
  'Athletico-PR': K('#c8102e', '#111111', '#ffffff', 'stripes'),
  'Bragantino': K('#ffffff', '#d0202e', '#d0202e'),
  'São Paulo': K('#ffffff', '#d0202e', '#111111', 'hoops'),
  'Grêmio': K('#0d80bf', '#111111', '#ffffff', 'stripes'),
  'Internacional': K('#d0202e', '#ffffff', '#ffffff'),
  'Vitória': K('#d0202e', '#111111', '#ffffff', 'stripes'),
  'Coritiba': K('#ffffff', '#00544e', '#00544e', 'hoops'),
  'Mirassol': K('#ffd200', '#0a7d3e', '#0a7d3e'),
  'Remo': K('#0b1f4d', '#ffffff', '#ffffff'),
  'Chapecoense': K('#0a8a3e', '#ffffff', '#ffffff'),
};
const DEFAULT = K('#3a4a42', '#f3ecd8', '#f3ecd8');

let uid = 0;
const escx = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const SHIRT = 'M62,22 L82,12 Q100,24 118,12 L138,22 L186,52 L168,86 L148,76 L148,186 Q100,194 52,186 L52,76 L32,86 L14,52 Z';

// Camisa vista de costas com o nome do jogador
const SLEEVE_L = 'M62,22 L14,52 L32,86 L52,76 Z', SLEEVE_R = 'M138,22 L186,52 L168,86 L148,76 Z';
function lum(hex) { const n = parseInt(hex.slice(1), 16); const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
export function jerseySVG(club, name) {
  const k = KITS[club] || DEFAULT, id = 'cj' + (++uid);
  let pat = '';
  if (k.pat === 'stripes') for (let x = 40; x < 170; x += 26) pat += `<rect x="${x}" y="0" width="13" height="200" fill="${k.s}"/>`;
  if (k.pat === 'hoops') for (let y = 30; y < 200; y += 30) pat += `<rect x="0" y="${y}" width="200" height="15" fill="${k.s}"/>`;
  if (k.pat === 'halves') pat = `<rect x="100" y="0" width="100" height="200" fill="${k.s}"/>`;
  if (k.pat === 'sash') pat = `<polygon points="40,40 70,40 170,190 140,190" fill="${k.s}"/>`;
  if (k.pat === 'band') pat = `<rect x="88" y="0" width="24" height="200" fill="${k.s}"/>`;
  if (k.pat === 'sleeves') pat = `<path d="${SLEEVE_L}" fill="${k.s}"/><path d="${SLEEVE_R}" fill="${k.s}"/>`;
  const parts = String(name).split(' ');
  const last = parts.slice(-1)[0].toUpperCase();
  const label = last.length > 3 ? last : String(name).toUpperCase();
  const fs = Math.max(12, Math.min(26, Math.floor(118 / Math.max(4, label.length) * 1.55)));
  // cor do nome: a cor de detalhe do clube, com contorno contrastante para ler bem sobre listras
  const fill = k.t, edge = lum(fill) > 0.6 ? 'rgba(10,14,12,.85)' : 'rgba(255,255,255,.9)';
  const busy = ['stripes', 'hoops', 'halves', 'sash', 'band'].includes(k.pat);
  return `<svg class="jersey" viewBox="0 0 200 200" aria-hidden="true">
    <defs><clipPath id="${id}"><path d="${SHIRT}"/></clipPath>
    <linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity=".10"/><stop offset="1" stop-color="#000" stop-opacity=".26"/></linearGradient>
    <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient></defs>
    <g clip-path="url(#${id})"><rect width="200" height="200" fill="${k.p}"/>${pat}
      <path d="M14,52 L32,86 L36,84 L18,50 Z M186,52 L168,86 L164,84 L182,50 Z" fill="${k.s}" opacity=".9"/>
      <rect width="200" height="200" fill="url(#${id}g)"/><rect width="200" height="200" fill="url(#${id}v)"/></g>
    <path d="${SHIRT}" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M82,12 Q100,26 118,12 L114,10 Q100,20 86,10 Z" fill="${k.s}" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>
    <text x="100" y="${54 + fs * 0.6}" text-anchor="middle" font-family="'Saira Condensed', 'Archivo Narrow', sans-serif" font-weight="800" font-size="${fs}" letter-spacing="${fs > 18 ? 2 : 1}"
      fill="${fill}" stroke="${edge}" stroke-width="${busy ? 4 : 1.6}" stroke-linejoin="round" paint-order="stroke">${escx(label)}</text>
  </svg>`;
}
