# Aplica tools/especiais.json (apelido + emoji de cada especial, editados na planilha do Marcos) nas três bases.
# Chave: "Nome|Clube" (Europa/Brasileirão) ou "Nome|Seleção|Ano" (Copa). Quem não está no arquivo perde o especial.
# Se o apelido antigo era também uma característica do motor (Garçom, Decisivo, Xerife…), ela continua valendo em k.
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRAITS = {'Cabeceador', 'Cobrador', 'Decisivo', 'Dono do alto', 'Garçom', 'Pivô', 'Xerife'}
ESP = json.load(open(os.path.join(ROOT, 'tools', 'especiais.json'), encoding='utf-8'))
def run(only=None):
    for f, k, copa in (('players.js', 'PLAYERS = ', 0), ('players_br.js', 'PLAYERS_BR = ', 0), ('players_copa.js', 'PLAYERS_COPA = ', 1)):
        if only and f not in only: continue
        p = os.path.join(ROOT, f); s = open(p, encoding='utf-8').read(); i = s.index(k) + len(k); j = s.rindex(']') + 1
        D = json.loads(s[i:j]); n = 0
        for d in D:
            key = f"{d['n']}|{d['t']}" + (f"|{d['y']}" if copa else '')
            old = d.get('x'); e = ESP.get(key)
            if old in TRAITS and (not e or e['x'] != old) and old not in d.get('k', []): d['k'] = (d.get('k') or []) + [old]
            if e: d['x'], d['xi'] = e['x'], e['xi']; n += 1
            else: d.pop('x', None); d.pop('xi', None)
        open(p, 'w', encoding='utf-8').write(s[:i] + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + s[j:])
        print(f, n, 'especiais')
if __name__ == '__main__': run()
