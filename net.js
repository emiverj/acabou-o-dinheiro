// Camada de rede: Supabase Realtime (broadcast) ou BroadcastChannel no modo local.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const ONLINE = !!(SUPABASE_URL && SUPABASE_ANON_KEY) && !new URLSearchParams(location.search).has('local');
let client = null;
async function getClient() {
  if (client) return client;
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { realtime: { params: { eventsPerSecond: 20 } } });
  return client;
}

// Abre um canal. onMsg(event, payload). Devolve { send(event, payload), close() }
export async function openChannel(name, onMsg) {
  if (!ONLINE) {
    if (typeof BroadcastChannel === 'undefined') return { send: () => {}, close: () => {} };
    const bc = new BroadcastChannel('acabou-' + name);
    bc.onmessage = e => onMsg(e.data.event, e.data.payload);
    return { send: (event, payload) => bc.postMessage({ event, payload }), close: () => bc.close() };
  }
  const supa = await getClient();
  const ch = supa.channel('acabou-' + name, { config: { broadcast: { self: false, ack: false } } });
  ['state', 'action', 'ping', 'room', 'react'].forEach(ev => ch.on('broadcast', { event: ev }, ({ payload }) => onMsg(ev, payload)));
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('Tempo esgotado ao conectar')), 12000);
    ch.subscribe(status => {
      if (status === 'SUBSCRIBED') { clearTimeout(to); resolve(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(to); reject(new Error('Falha na conexão (' + status + ')')); }
    });
  });
  return {
    send: (event, payload) => ch.send({ type: 'broadcast', event, payload }),
    close: () => supa.removeChannel(ch),
  };
}

// Medição de uso: registra eventos anônimos numa tabela "eventos" do Supabase (se ela existir).
export function track(tipo, dados) {
  if (!ONLINE) return;
  try {
    fetch(SUPABASE_URL + '/rest/v1/eventos', { method: 'POST', keepalive: true,
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ tipo, sala: (dados && dados.sala) || null, dados: dados || {} }) }).catch(() => {});
  } catch (e) {}
}
