# Gera players_copa.js a partir de final.json (saída de select.py).
# Régua do modo: 81–99. O modelo gera notas em 71–99; elas vão para a régua intermediária 75–99 (onde valem as notas do Marcos,
# em user_ovr.json) e daí, mantendo a ordem, para 81–99. Especial: 88+ na régua intermediária.
import json, hashlib, os, sys
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(os.path.dirname(HERE))
F=json.load(open(sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'final.json')))
U=json.load(open(os.path.join(HERE,'user_ovr.json')))
def remap(o): return int(round(75 + (o - 71) * 24 / 28))
def final(o75): return int(81 + (o75 - 75) * 18 / 24 + .5)
TEAM={'Brazil':'Brasil','Spain':'Espanha','Argentina':'Argentina','France':'França','Italy':'Itália','England':'Inglaterra','Germany':'Alemanha','West Germany':'Alemanha Ocidental','Netherlands':'Holanda','Belgium':'Bélgica','Uruguay':'Uruguai','Portugal':'Portugal','Croatia':'Croácia','Poland':'Polônia','Hungary':'Hungria','Sweden':'Suécia','South Korea':'Coreia do Sul','Soviet Union':'União Soviética','Switzerland':'Suíça','Czechoslovakia':'Tchecoslováquia','Yugoslavia':'Iugoslávia','United States':'Estados Unidos','USA':'Estados Unidos','Morocco':'Marrocos','Chile':'Chile','Austria':'Áustria','Mexico':'México','Colombia':'Colômbia','Denmark':'Dinamarca','Turkey':'Turquia','Nigeria':'Nigéria','Romania':'Romênia','Bulgaria':'Bulgária','Japan':'Japão','Ghana':'Gana','Scotland':'Escócia','Cameroon':'Camarões','Russia':'Rússia','Ivory Coast':'Costa do Marfim','Norway':'Noruega','Egypt':'Egito','Peru':'Peru','Ecuador':'Equador','Northern Ireland':'Irlanda do Norte','Slovakia':'Eslováquia','Czech Republic':'República Tcheca','Iran':'Irã','Australia':'Austrália','Senegal':'Senegal','Paraguay':'Paraguai','Canada':'Canadá'}
ISO={'Brasil':'br','Espanha':'es','Argentina':'ar','França':'fr','Itália':'it','Inglaterra':'gb-eng','Alemanha':'de','Alemanha Ocidental':'de','Holanda':'nl','Bélgica':'be','Uruguai':'uy','Portugal':'pt','Croácia':'hr','Polônia':'pl','Hungria':'hu','Suécia':'se','Coreia do Sul':'kr','União Soviética':'su','Suíça':'ch','Tchecoslováquia':'cz','Iugoslávia':'yu','Estados Unidos':'us','Marrocos':'ma','Chile':'cl','Áustria':'at','México':'mx','Colômbia':'co','Dinamarca':'dk','Turquia':'tr','Nigéria':'ng','Romênia':'ro','Bulgária':'bg','Japão':'jp','Gana':'gh','Escócia':'gb-sct','Camarões':'cm','Rússia':'ru','Costa do Marfim':'ci','Noruega':'no','Egito':'eg','Peru':'pe','Equador':'ec','Irlanda do Norte':'gb-nir','Eslováquia':'sk','República Tcheca':'cz','Irã':'ir','Austrália':'au','Senegal':'sn','Paraguai':'py','Canadá':'ca'}
T={'CB':[-8,-34,-14,-14,3,2],'LB':[2,-22,-6,-4,-4,-4],'RB':[2,-22,-6,-4,-4,-4],'LWB':[3,-20,-5,-3,-6,-4],'RWB':[3,-20,-5,-3,-6,-4],'CDM':[-10,-14,-2,-5,0,2],'CM':[-8,-6,1,0,-10,-4],'CAM':[-4,-2,2,2,-40,-16],'LM':[4,-5,-2,1,-30,-12],'RM':[4,-5,-2,1,-30,-12],'LW':[6,-3,-4,2,-42,-16],'RW':[6,-3,-4,2,-42,-16],'ST':[-2,2,-14,-6,-45,0],'CF':[-2,1,-6,-1,-44,-4]}
def noise(k,i): return (int(hashlib.md5(f'{k}{i}'.encode()).hexdigest(),16)%7)-3
PK={'Zico','Michel Platini','David Beckham','Roberto Carlos','Andrea Pirlo','Rivellino','Ronaldinho','Lionel Messi','Cristiano Ronaldo','Didi','Rivaldo','Diego Maradona','Zinedine Zidane','Juan Román Riquelme','Toni Kroos','Hristo Stoichkov','Gheorghe Hagi','Roberto Baggio','Harry Kane','Bruno Fernandes','Eusébio','Kylian Mbappé','Neymar','James Rodríguez'}
out=[]; pid_map={}
for x in F:
    k=f"{x['key']}|{x['year']}"; x['o75']=U[k] if k in U else remap(x['ovr']); x['o2']=final(x['o75'])
for x in sorted(F,key=lambda x:(-x['o2'],x['year'])):
    pos=x['p']; o=x['o2']; team=TEAM.get(x['team'],x['team'])
    if pos=='GK': s=[o-30+noise(x['pid'],0), o-4, o-12, o, 40, o-6]
    else:
        s=[o+d+noise(x['pid']+str(x['year']),i) for i,d in enumerate(T[pos])]
        if x['age']: s[0]+=max(0,25-x['age'])*0.6-max(0,x['age']-29)*1.0
        if x['goals']: s[1]+=min(6,x['goals']*1.2)
        s=[min(v, o+(6 if i==0 else 3)) for i,v in enumerate(s)]
    s=[int(max(25,min(99,round(v)))) for v in s]
    g=x['goals'] or 0
    if pos=='GK': kk='Paredão' if x['o75']>=88 else 'Seguro'
    elif pos=='CB': kk='Xerife' if x['o75']>=87 else 'Muralha'
    elif pos in ('LB','RB','LWB','RWB'): kk='Incansável'
    elif pos=='CDM': kk='Rouba-bola'
    elif pos in ('CM','CAM'): kk='Garçom' if x['o75']>=88 else 'Visão de jogo'
    elif pos in ('LW','RW','LM','RM'): kk='Decisivo' if g>=3 else 'Bailarino'
    else: kk='Decisivo' if g>=4 else ('Matador' if g>=2 else 'Chute no ângulo')
    d={'n':x['name'],'o':o,'p':pos,'a':x['a'],'s':s,'c':team,'t':team,'h':None,'w':None,'k':[kk],'f':ISO[team],'y':x['year'],'id':pid_map.setdefault(x['pid'],len(pid_map)+1)}
    sp=x.get('spec')
    if sp and x['o75']>=88: d['x'],d['xi']=sp[0],sp[1]
    if x['key'] in PK or x['name'] in PK: d['pk']=1
    out.append(d)
open(os.path.join(ROOT,'players_copa.js'),'w',encoding='utf-8').write('// Base do modo Copa do Mundo: cada carta é uma versão (jogador + Copa + seleção), régua própria 81–99.\n// Fontes: Fjelstul World Cup Database (1930–2022), openfootball (2026) e convocações de 2026; notas estimadas e revisadas pelo Marcos.\n// y = ano da Copa · id = pessoa (todas as versões do mesmo jogador têm o mesmo id) · s = [RIT, FIN, PAS, DRI, DEF, FIS] estimados\nexport const PLAYERS_COPA = '+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';\n')
import collections; print(len(out), sorted(collections.Counter(d['o'] for d in out).items()))
# apelidos e emojis dos especiais (planilha do Marcos) prevalecem sobre os do modelo
import importlib.util as _u; _sp=_u.spec_from_file_location('ae', os.path.join(ROOT,'tools','apply_especiais.py')); _m=_u.module_from_spec(_sp); _sp.loader.exec_module(_m); _m.run(['players_copa.js'])
