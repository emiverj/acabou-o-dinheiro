// Bases de jogadores (modos). O modo Europa e o modo Brasileirão têm réguas de overall independentes.
// Regra: todo modo/região novo precisa de um ícone próprio em icons/<id>.svg e de um tema (data-mode no <body>).
import { PLAYERS as EUROPA } from './players.js';
import { PLAYERS_BR } from './players_br.js';
import { PLAYERS_COPA } from './players_copa.js';

export const MODES = {
  europa: { name: 'Europa', icon: 'icons/europa.svg', list: EUROPA, tiers: [84, 91], special: 88, desc: 'Cinco grandes ligas, Champions e Liga Europa' },
  brasileirao: { name: 'Brasileirão', icon: 'icons/brasileirao.svg', list: PLAYERS_BR, tiers: [82, 87], special: 85, desc: 'Os 20 clubes da Série A 2026' },
  copa: { name: 'Copa do Mundo', icon: 'icons/copa.svg', list: PLAYERS_COPA, tiers: [91, 95], special: 91, desc: 'Lendas de todas as Copas, de 1930 a 2026', versions: true },
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
// faixas de craque de cada modo: [lance mínimo de 5%, lance mínimo de 10%] (também usadas para cor da carta e pote)
export const tiersOf = b => (MODES[b] || MODES.europa).tiers;
// a partir de que nota os jogadores (não lendas) têm especial, em cada modo
export const specialOf = b => (MODES[b] || MODES.europa).special;
export const ovrRange = b => { const o = MODES[b].list.map(p => p.o); return [Math.min(...o), Math.max(...o)]; };
