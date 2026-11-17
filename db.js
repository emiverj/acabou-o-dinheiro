// Base de jogadores ativa. O modo Europa e o modo Brasileirão têm réguas de overall independentes.
import { PLAYERS as EUROPA } from './players.js';
import { PLAYERS_BR } from './players_br.js';

export const BASES = { europa: EUROPA, brasileirao: PLAYERS_BR };
export const BASE_NAMES = { europa: 'Europa', brasileirao: 'Brasileirão' };
export let PLAYERS = EUROPA;
export let BASE = 'europa';
// troca a base em uso (ligação viva: quem importa PLAYERS passa a ver a nova lista)
export function setBase(b) { BASE = BASES[b] ? b : 'europa'; PLAYERS = BASES[BASE]; }
