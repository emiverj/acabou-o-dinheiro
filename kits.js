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
};
const DEFAULT = K('#3a4a42', '#f3ecd8', '#f3ecd8');

let uid = 0;
const escx = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const SHIRT = 'M62,22 L82,12 Q100,24 118,12 L138,22 L186,52 L168,86 L148,76 L148,186 Q100,194 52,186 L52,76 L32,86 L14,52 Z';

// Camisa vista de costas com o nome do jogador
export function jerseySVG(club, name) {
  const k = KITS[club] || DEFAULT, id = 'cj' + (++uid);
  let pat = '';
  if (k.pat === 'stripes') for (let x = 40; x < 170; x += 26) pat += `<rect x="${x}" y="0" width="13" height="200" fill="${k.s}"/>`;
  if (k.pat === 'hoops') for (let y = 30; y < 200; y += 30) pat += `<rect x="0" y="${y}" width="200" height="15" fill="${k.s}"/>`;
  if (k.pat === 'halves') pat = `<rect x="100" y="0" width="100" height="200" fill="${k.s}"/>`;
  if (k.pat === 'sash') pat = `<polygon points="40,40 70,40 170,190 140,190" fill="${k.s}"/>`;
  if (k.pat === 'band') pat = `<rect x="88" y="0" width="24" height="200" fill="${k.s}"/>`;
  if (k.pat === 'sleeves') pat = `<polygon points="138,22 186,52 168,86 148,76" fill="${k.s}"/><polygon points="62,22 14,52 32,86 52,76" fill="${k.s}"/>`;
  const last = String(name).split(' ').slice(-1)[0].toUpperCase();
  const label = last.length > 3 ? last : String(name).toUpperCase();
  const fs = Math.max(11, Math.min(22, Math.floor(150 / Math.max(4, label.length) * 1.25)));
  const textBg = k.pat === 'stripes' || k.pat === 'hoops' || k.pat === 'halves' || k.pat === 'sash' || k.pat === 'band';
  return `<svg class="jersey" viewBox="0 0 200 200" aria-hidden="true">
    <defs><clipPath id="${id}"><path d="${SHIRT}"/></clipPath>
    <linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>
    <g clip-path="url(#${id})"><rect width="200" height="200" fill="${k.p}"/>${pat}<rect width="200" height="200" fill="url(#${id}g)"/></g>
    <path d="${SHIRT}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="3"/>
    <path d="M82,12 Q100,24 118,12 Q100,30 82,12 Z" fill="${k.s}" stroke="rgba(0,0,0,.35)" stroke-width="2"/>
    ${textBg ? `<rect x="50" y="${60 - fs}" width="100" height="${fs + 13}" rx="5" fill="rgba(10,14,12,.78)"/>` : ''}
    <text x="100" y="66" text-anchor="middle" font-family="Anton, Impact, sans-serif" font-size="${fs}" letter-spacing="1" fill="${textBg ? '#ffffff' : k.t}" stroke="${textBg ? 'none' : 'rgba(0,0,0,.25)'}" stroke-width="1">${escx(label)}</text>
  </svg>`;
}
