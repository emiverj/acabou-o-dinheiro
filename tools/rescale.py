# Reescala a régua de OVR de uma base (uso único por mudança de régua): python3 tools/rescale.py <arquivo> <CONST> <novo_min> <novo_max>
# Mantém a ordem dos jogadores. Dentro de uma mesma nota antiga, quem tem atributos melhores fica um pouco acima
# (preenche os buracos que uma régua mais larga abriria). Os seis atributos andam junto com o OVR.
import json, sys
f, k, lo2, hi2 = sys.argv[1], sys.argv[2] + ' = ', int(sys.argv[3]), int(sys.argv[4])
s = open(f, encoding='utf-8').read(); i = s.index(k) + len(k); j = s.rindex(']') + 1
D = json.loads(s[i:j]); lo, hi = min(d['o'] for d in D), max(d['o'] for d in D)
groups = {}
for d in D: groups.setdefault(d['o'], []).append(d)
for o, g in groups.items():
    g.sort(key=lambda d: sum(d['s']) / len(d['s']))
    for r, d in enumerate(g): d['_c'] = o + ((r + .5) / len(g) - .5) * .98 if len(g) > 1 and hi2 - lo2 > hi - lo else o
for d in D:
    n = int(lo2 + (d['_c'] - lo) * (hi2 - lo2) / (hi - lo) + .5); n = max(lo2, min(hi2, n)); dl = n - d['o']
    d['o'] = n; d['s'] = [max(25, min(99, v + dl)) for v in d['s']]; del d['_c']
open(f, 'w', encoding='utf-8').write(s[:i] + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + s[j:])
print(f, lo, hi, '->', lo2, hi2)
