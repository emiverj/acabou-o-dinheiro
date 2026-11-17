import json, collections
X=json.load(open('versions_scored.json'))
def era(y): return 'old' if y<=1950 else 'mid' if y<=1966 else 'mod' if y<=2022 else 'now'
sel=[]
for x in X:
    e=era(x['year']); cur=bool(x['cur'])
    played = x['apps'] is None or x['apps']>0 or x['year']<1970
    if not played: continue
    if e=='now':
        ok = x['o']>=80.5 or (x['goals']>=2)
    elif cur:
        ok = x['o']>=78
    elif e=='old':
        ok = bool(x['aw']) or x['goals']>=4
    elif e=='mid':
        ok = bool(x['aw']) or x['goals']>=3 or (x['o']>=80 and x['stage']>=4)
    else:
        ok = x['o']>=79.5 or bool(x['aw']) or x['goals']>=3 or (x['stage']>=4 and x['starts']>=5 and x['o']>=76.5)
    if ok: sel.append(x)
c=collections.Counter(era(x['year']) for x in sel)
print(len(sel), c, collections.Counter(x['pos'] for x in sel))
import statistics
os_=sorted(x['o'] for x in sel); print('median',statistics.median(os_), '90+',sum(o>=90 for o in os_),'85+',sum(o>=85 for o in os_),'<78',sum(o<78 for o in os_))
print(collections.Counter(x['year'] for x in sel))
json.dump(sel,open('selected.json','w'),ensure_ascii=False)

# ---- enxugar: versões fracas de curados saem; 2026 só os melhores; medianos limitados por Copa
import sys; sys.path.insert(0,'.'); from talent import T
best=collections.defaultdict(float)
for x in sel: best[x['pid']]=max(best[x['pid']],x['o'])
S2=[]
for x in sel:
    if x['cur'] and x['year']<2026 and x['o']<max(80,best[x['pid']]-9): continue
    S2.append(x)
now=sorted([x for x in S2 if x['year']==2026], key=lambda x:-x['o'])[:88]
hist=[x for x in S2 if x['year']<2026]
# medianos (não curados) — no máximo 14 por Copa moderna, priorizando quem foi longe e jogou
gen=collections.defaultdict(list); keep=[]
for x in hist:
    if x['cur'] or x['year']<1970: keep.append(x)
    else: gen[x['year']].append(x)
for y,L in gen.items():
    L.sort(key=lambda x:(-(x['o']+x['stage']*0.6+min(x['goals'],4)*0.5)))
    keep+=L[:8]
S3=keep+now
print('trim',len(S3), collections.Counter(x['pos'] for x in S3))
# ---- régua final: mapeamento por posição no ranking, mantendo a ordem
S3.sort(key=lambda x:x['o'])
n=len(S3)
anch=[(0,71),(0.12,75),(0.35,79),(0.6,82),(0.82,85.5),(0.95,89.5),(0.985,93),(1,97)]
def mapq(q):
    for (q0,v0),(q1,v1) in zip(anch,anch[1:]):
        if q<=q1: return v0+(v1-v0)*(q-q0)/(q1-q0)
for i,x in enumerate(S3):
    x['raw']=x['o']; m=mapq(i/(n-1))
    x['ovr']=int(round(max(m, x['o']) if x['o']>=93 else m))
h=collections.Counter(x['ovr'] for x in S3); print(sorted(h.items()))
print('85+',sum(x['ovr']>=85 for x in S3),'89+',sum(x['ovr']>=89 for x in S3),'90+',sum(x['ovr']>=90 for x in S3))
print(sorted([(x['ovr'],x['name'],x['year']) for x in S3],reverse=True)[:40])
json.dump(S3,open('final.json','w'),ensure_ascii=False)
# notas ajustadas pelo Marcos na planilha (prevalecem sobre o modelo)
U=json.load(open('user_ovr.json'))
for x in S3:
    k=f"{x['key']}|{x['year']}"
    if k in U: x['ovr']=U[k]
json.dump(S3,open('final.json','w'),ensure_ascii=False)
