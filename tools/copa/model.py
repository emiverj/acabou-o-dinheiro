import json, sys, collections, re, hashlib, unicodedata
sys.path.insert(0,'.'); from talent import T
ALIAS={'Rivellino':'Rivelino','Elías Figueroa':'Elias Figueroa','Cláudio Taffarel':'Taffarel','Mário Zagallo':'Zagallo','Gigi Riva':'Luigi Riva','Myung-bo Hong':'Hong Myung-bo','Ji-sung Park':'Park Ji-sung','Heung-min Son':'Son Heung-min','Nándor Hidegkuti':'Nándor Hidegkuti','Oleh Blokhin':'Oleg Blokhin','Ihor Belanov':'Igor Belanov'}
R=json.load(open('versions_raw.json'))
for r in R: r['key']=ALIAS.get(r['name'],r['name'])
# para nomes repetidos, só o jogador mais relevante (mais Copas/gols) recebe o talento curado
best={}
agg=collections.defaultdict(lambda:[0,0,0,set()])
for r in R:
    a=agg[r['pid']]; a[0]+=r['starts']; a[1]+=r['goals']; a[2]+=len(r['aw']); a[3].add(r['year'])
for r in R:
    if r['key'] in T:
        sc=agg[r['pid']][1]*3+len(agg[r['pid']][3])*4+agg[r['pid']][0]+agg[r['pid']][2]*5
        if r['key'] not in best or sc>best[r['key']][1]: best[r['key']]=(r['pid'],sc)
CUR={pid:k for k,(pid,_) in best.items()}
# exceções em que o mais "relevante" não é o certo
TEAMHINT={'Juan':'Brazil','Júnior':'Brazil','Leonardo':'Brazil','Oscar':'Brazil','Paulinho':'Brazil','Hulk':'Brazil','Willian':'Brazil','Marcelo':'Brazil','Raúl':'Spain','Pepe':'Portugal','Deco':'Portugal','Ademir':'Brazil','Didi':'Brazil','Zito':'Brazil','Vavá':'Brazil','Amarildo':'Brazil','Adriano':'Brazil','Luis Suárez':'Uruguay','Emiliano Martínez':'Argentina','Gérson':'Brazil'}
for k,tm in TEAMHINT.items():
    cs=[r for r in R if r['key']==k and r['team']==tm]
    if cs:
        for pid in [p for p,kk in CUR.items() if kk==k]: del CUR[pid]
        CUR[cs[0]['pid']]=k
AW={'Golden Ball':3,'Silver Ball':2,'Bronze Ball':1.5,'Golden Boot':2,'Silver Boot':1,'Bronze Boot':0.7,'Golden Glove':2.5,'Best Young Player':1.5}
def age_adj(a, cur):
    if a is None: return 0
    if a<=21: v=-(22-a)*1.2-1.2
    elif a<=24: v=-(25-a)*0.7
    elif a<=29: v=0
    elif a<=33: v=-(a-29)*1.1
    else: v=-4.4-(a-33)*1.6
    return v
STAGEB={5:1.2,4:0.7,3:0.2,2:0,1:-0.5,0:-1.2}
def gen_talent(pid):
    a=agg[pid]; nt=len(a[3])
    return min(84, 72 + min(5,1.4*(nt-1)) + min(4.5,a[0]*0.22) + min(5,a[1]*0.55) + min(3,a[2]*1.2))
out=[]
for r in R:
    cur=CUR.get(r['pid'])
    known=r['year']>=1970
    form=sum(AW.get(x,0) for x in r['aw'])
    if r['pos']!='GK': form+=min(4, r['goals']*(0.7 if r['pos']=='FW' else 1.0))
    stage=STAGEB[r['stage']]+(0.8 if r['place']==1 else 0)
    if cur:
        peak,pos,alts,spec=T[cur]
        adj=age_adj(r['age'],True)+0.5*min(form,6)+0.7*stage
        if known:
            if r['apps']==0: adj-=7
            elif r['starts']<=1: adj-=3.5
            elif r['starts']<max(2,r['apps']*0.6): adj-=1.5
        o=('CUR',peak,adj)
    else:
        pos={'GK':'GK','DF':'CB','MF':'CM','FW':'ST'}[r['pos']]; alts={'CB':['LB','RB'],'CM':['CDM','CAM'],'ST':['LW','RW'],'GK':[]}[pos]; spec=None
        o=gen_talent(r['pid'])+age_adj(r['age'],False)+0.6*form+stage
        if known:
            if r['apps']==0: o-=5
            elif r['starts']<=1: o-=2.5
    out.append(dict(r, cur=cur, o=o, p=pos, a=alts, spec=spec))
# curados: a melhor versão de cada um encosta no pico; as outras ficam abaixo pela diferença de ajuste
mx=collections.defaultdict(lambda:-99)
for x in out:
    if isinstance(x['o'],tuple): mx[x['cur']]=max(mx[x['cur']],x['o'][2])
OV={('Lionel Messi',2022):97,('Diego Maradona',1986):97,('Pelé',1970):97,('Ronaldo',2002):96,('Zinedine Zidane',1998):95,('Zinedine Zidane',2006):93,('Pelé',1958):93,('Garrincha',1962):94,('Johan Cruyff',1974):95,('Franz Beckenbauer',1974):95,('Kylian Mbappé',2022):94,('Romário',1994):93,('Paolo Rossi',1982):90,('Mario Kempes',1978):90,('Just Fontaine',1958):89,('Ronaldo',1998):94,('Luka Modrić',2018):91,('Lionel Messi',2014):94,('Lionel Messi',2010):88,('Cristiano Ronaldo',2022):84,('Pelé',1966):88,('Luka Modrić',2022):87,('Cristiano Ronaldo',2014):87,('Cristiano Ronaldo',2018):90,('Cristiano Ronaldo',2010):88,('Cristiano Ronaldo',2006):86,('Franz Beckenbauer',1966):89,('Franz Beckenbauer',1970):91,('Ronaldinho',2006):87,('Pelé',1962):88,('Ronaldo',2006):90,('Diego Maradona',1990):92,('Diego Maradona',1982):88,('Lionel Messi',2018):90,('Kaká',2010):86,('Ronaldinho',2002):93,('Rivaldo',1998):90,('Rivaldo',2002):92}
for x in out:
    if isinstance(x['o'],tuple):
        _,peak,adj=x['o']; ref=max(mx[x['cur']],2.0)
        o=peak+min(0,adj-ref)*0.9
        o=OV.get((x['key'],x['year']),o)
    else: o=x['o']
    x['o']=round(max(66,min(97,o)),1)
json.dump(out,open('versions_scored.json','w'),ensure_ascii=False)
def show(n):
    print(n, [(x['year'],x['o'],x['age'],x['goals'],x['stage']) for x in out if x['key']==n and (x['cur'] or True)])
for n in ['Neymar','Lionel Messi','Ronaldo','Pelé','Diego Maradona','Kylian Mbappé','Cristiano Ronaldo','Zinedine Zidane','Miroslav Klose','Luka Modrić','Garrincha']: show(n)
import statistics
print(len(out), statistics.median(x['o'] for x in out))

# ---------- Copa de 2026 ----------
import unicodedata as U
def nz(x): return U.normalize('NFD',x).encode('ascii','ignore').decode().lower().replace('-',' ').strip()
eu_s=open('/home/claude/acabou-o-dinheiro/players.js',encoding='utf-8').read(); EUL=json.loads(eu_s[eu_s.index('PLAYERS = ')+10:eu_s.rindex(']')+1])
br_s=open('/home/claude/acabou-o-dinheiro/players_br.js',encoding='utf-8').read(); BRL=json.loads(br_s[br_s.index('PLAYERS_BR = ')+13:br_s.rindex(']')+1])
EUN={nz(d['n']):d for d in EUL}
EUN.update({nz(k):EUN[nz(v)] for k,v in {'Vinícius Júnior':'Vini Jr.','Emiliano Martínez':'Dibu Martínez','Álex Grimaldo':'Grimaldo','Marc Cucurella':'Cucurella','Martín Zubimendi':'Zubimendi','Mikel Oyarzabal':'Oyarzabal','Gabriel Magalhães':'Gabriel','Manu Koné':'Kouadio Manu Koné','Kaishū Sano':'Kaishū Sano','Ederson':'Ederson','Marc Pubill':'Pubill','Fermín López':'Fermín','José Manuel López':'José Manuel López','Brahim Díaz':'Brahim','Julián Álvarez':'Julián Alvarez'}.items() if nz(v) in EUN})
W=json.load(open('wc2026.json')); ST26=W['stage']; G26={nz(k):v for k,v in W['goals'].items()}
TEAM_EN_PT={}
v26=[]
for ln in open('sq2026.txt',encoding='utf-8'):
    team,rest=ln.strip().split('|',1)
    for part in rest.split('; '):
        pc,names=part.split(': ',1)
        for m in re.finditer(r"([^,(]+?) \((\d+)\)", names):
            nm=m.group(1).strip(); age=int(m.group(2)); k=nz(nm)
            g=G26.get(k,0)
            if not g:
                for gk,gv in G26.items():
                    if gk.split()[-1]==k.split()[-1] and (gk in k or k in gk): g=gv
            st=ST26.get(team,0); place={'Spain':1,'Argentina':2,'England':3,'France':4}.get(team)
            ea=EUN.get(k); curk=None
            for ck in (nm, {'Vinícius Júnior':'Vinícius Júnior','Julián Álvarez':'Julián Álvarez'}.get(nm,nm)):
                if ck in T and not (ck=='Luis Suárez' and team!='Uruguay') and not (ck=='Emiliano Martínez' and team!='Argentina'): curk=ck
            pos0={'GK':'GK','DF':'CB','MF':'CM','FW':'ST'}[pc]
            if ea: base=ea['o']-1; pos=ea['p']; alts=ea['a']
            elif curk: base=T[curk][0]+age_adj(age,True); pos=T[curk][1]; alts=T[curk][2]
            else: base=73.5; pos=pos0; alts={'CB':['LB','RB'],'CM':['CDM','CAM'],'ST':['LW','RW'],'GK':[]}[pos0]
            o=base+min(3,g*(0.45 if pos0=='FW' else 0.7))+STAGEB[min(st,5)]+(0.8 if place==1 else 0)
            o={'Lionel Messi':91,'Cristiano Ronaldo':84,'Neymar':83,'Luka Modrić':83}.get(nm,o)
            spec=T[curk][3] if curk else (( ea['x'], ea.get('xi','★')) if ea and ea.get('x') else None)
            v26.append(dict(pid='N26-'+k, key=(curk or nm), name=nm, year=2026, team=team, pos=pc, age=age, apps=None, starts=None, goals=g, aw=[], stage=st, place=place, nt=None, cur=curk, o=round(max(66,min(97,o)),1), p=pos, a=alts, spec=spec, ea=bool(ea)))
# liga a mesma pessoa entre 2026 e Copas anteriores (pelo nome)
byname={}
for x in out: byname.setdefault(nz(x['key']),x['pid'])
for v in v26:
    pid=byname.get(nz(v['key'])) or byname.get(nz(v['name']))
    if pid: v['pid']=pid
out+=v26
json.dump(out,open('versions_scored.json','w'),ensure_ascii=False)
print('2026:',len(v26), sorted([(v['o'],v['name'],v['team']) for v in v26],reverse=True)[:25])
for n in ['Lionel Messi','Cristiano Ronaldo','Neymar','Kylian Mbappé','Luka Modrić']: show(n)
