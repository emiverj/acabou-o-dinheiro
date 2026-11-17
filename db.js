// Bases de jogadores (modos). O modo Europa e o modo Brasileirão têm réguas de overall independentes.
// Regra: todo modo/região novo precisa de um ícone próprio em icons/<id>.svg e de um tema (data-mode no <body>).
import { PLAYERS as EUROPA } from './players.js';
import { PLAYERS_BR } from './players_br.js';

export const MODES = {
  europa: { name: 'Europa', icon: 'icons/europa.svg', list: EUROPA, desc: 'Cinco grandes ligas, Champions e Liga Europa' },
  brasileirao: { name: 'Brasileirão', icon: 'icons/brasileirao.svg', list: PLAYERS_BR, desc: 'Os 20 clubes da Série A 2026' },
};
export const BASES = Object.fromEntries(Object.entries(MODES).map(([k, m]) => [k, m.list]));
export const BASE_NAMES = Object.fromEntries(Object.entries(MODES).map(([k, m]) => [k, m.name]));
export let PLAYERS = EUROPA;
export let BASE = 'europa';
// troca a base em uso (ligação viva: quem importa PLAYERS passa a ver a nova lista) e o tema de cores do site
export function setBase(b) {
  BASE = MODES[b] ? b : 'europa'; PLAYERS = BASES[BASE];
  if (typeof document !== 'undefined') document.body.dataset.mode = BASE;
}
export const ovrRange = b => { const o = MODES[b].list.map(p => p.o); return [Math.min(...o), Math.max(...o)]; };
