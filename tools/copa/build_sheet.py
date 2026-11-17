import json, collections, openpyxl
from openpyxl.styles import Font, PatternFill
S=json.load(open('final.json'))
TEAM={'Brazil':'Brasil','Spain':'Espanha','Argentina':'Argentina','France':'França','Italy':'Itália','England':'Inglaterra','Germany':'Alemanha','West Germany':'Alemanha Ocidental','Netherlands':'Holanda','Belgium':'Bélgica','Uruguay':'Uruguai','Portugal':'Portugal','Croatia':'Croácia','Poland':'Polônia','Hungary':'Hungria','Sweden':'Suécia','South Korea':'Coreia do Sul','Soviet Union':'União Soviética','Switzerland':'Suíça','Czechoslovakia':'Tchecoslováquia','Yugoslavia':'Iugoslávia','United States':'Estados Unidos','USA':'Estados Unidos','Morocco':'Marrocos','Chile':'Chile','Austria':'Áustria','Mexico':'México','Colombia':'Colômbia','Denmark':'Dinamarca','Turkey':'Turquia','Nigeria':'Nigéria','Romania':'Romênia','Bulgaria':'Bulgária','Japan':'Japão','Ghana':'Gana','Scotland':'Escócia','Cameroon':'Camarões','Russia':'Rússia','Ivory Coast':'Costa do Marfim','Norway':'Noruega','Egypt':'Egito','Peru':'Peru','Ecuador':'Equador','Northern Ireland':'Irlanda do Norte','Slovakia':'Eslováquia','Czech Republic':'República Tcheca','Iran':'Irã','Australia':'Austrália','Senegal':'Senegal','Paraguay':'Paraguai','Canada':'Canadá'}
POS={'GK':'GOL','CB':'ZAG','LB':'LE','RB':'LD','LWB':'ALE','RWB':'ALD','CDM':'VOL','CM':'MC','CAM':'MEI','LM':'ME','RM':'MD','LW':'PE','RW':'PD','ST':'ATA','CF':'SA'}
def fase(x):
    if x.get('place')==1: return 'Campeão'
    if x.get('place')==2: return 'Vice'
    if x['year']==2026: return {5:'Vice',4:'Semifinal',3:'Quartas',2:'Oitavas',1:'16 avos',0:'Grupos'}[x['stage']]
    if x.get('place') in (3,4): return 'Semifinal'
    return {5:'Final',4:'Semifinal',3:'Quartas',2:'Oitavas',1:'2ª fase',0:'Grupos'}[x['stage']]
AWPT={'Golden Ball':'Bola de Ouro','Silver Ball':'Bola de Prata','Bronze Ball':'Bola de Bronze','Golden Boot':'Chuteira de Ouro','Silver Boot':'Chuteira de Prata','Bronze Boot':'Chuteira de Bronze','Golden Glove':'Luva de Ouro','Best Young Player':'Melhor jovem'}
wb=openpyxl.Workbook(); hf=PatternFill('solid',fgColor='F3F3F3')
ws=wb.active; ws.title='Versões'
ws.append(['OVR','Jogador','Copa','Seleção','Pos.','Alt.','Idade','Jogos','Gols','Fase da seleção','Prêmios','Especial','Origem da nota'])
S.sort(key=lambda x:(-x['ovr'],x['year']))
for x in S:
    sp=x.get('spec'); spn=(sp[1]+' '+sp[0]) if sp and x['ovr']>=86 else ''
    org='Lenda/craque (pico curado)' if x['cur'] else ('Base Europa atual' if x.get('ea') else 'Estimada por desempenho')
    ws.append([x['ovr'],x['name'],x['year'],TEAM.get(x['team'],x['team']),POS.get(x['p'],x['p']),' · '.join(POS.get(a,a) for a in x['a']),x['age'],x['apps'] if x['apps'] is not None and x['year']>=1970 else None,x['goals'],fase(x),', '.join(AWPT.get(a,a) for a in x['aw']) or None,spn or None,org])
for c in ws[1]: c.fill=hf; c.font=Font(bold=True)
for k,w in {'B':24,'D':18,'J':14,'K':26,'L':22,'M':24}.items(): ws.column_dimensions[k].width=w
ws.freeze_panes='C2'; n=ws.max_row
t=wb.create_sheet('Casos de teste'); t.append(['Jogador','Copa','OVR','Idade','Gols','Fase da seleção'])
for nm in ['Pelé','Diego Maradona','Ronaldo','Lionel Messi','Cristiano Ronaldo','Neymar','Kylian Mbappé','Zinedine Zidane','Luka Modrić','Miroslav Klose','Ronaldinho','Garrincha']:
    for x in sorted([x for x in S if x['key']==nm],key=lambda x:x['year']):
        t.append([x['name'],x['year'],x['ovr'],x['age'],x['goals'],fase(x)])
    t.append([None]*6)
for c in t[1]: c.fill=hf; c.font=Font(bold=True)
t.column_dimensions['A'].width=22; t.column_dimensions['F'].width=16
p=wb.create_sheet('Por Copa'); p.append(['Copa','Versões','OVR médio','Maior OVR','85+'])
for i,y in enumerate(sorted({x['year'] for x in S}),start=2):
    p.append([y,f'=COUNTIF(Versões!C2:C{n},A{i})',f'=ROUND(AVERAGEIF(Versões!C2:C{n},A{i},Versões!A2:A{n}),1)',f'=MAXIFS(Versões!A2:A{n},Versões!C2:C{n},A{i})',f'=COUNTIFS(Versões!C2:C{n},A{i},Versões!A2:A{n},">=85")'])
for c in p[1]: c.fill=hf; c.font=Font(bold=True)
d=wb.create_sheet('Distribuição'); d.append(['OVR','Versões'])
for i,o in enumerate(range(97,70,-1),start=2): d.append([o,f'=COUNTIF(Versões!A2:A{n},A{i})'])
for c in d[1]: c.fill=hf; c.font=Font(bold=True)
m=wb.create_sheet('Como a nota é feita')
for line in ['Cada carta é uma versão: jogador + Copa + seleção. Régua própria do modo, de 71 a 97.',
 'Lendas e craques: nota de pico definida à mão; a melhor Copa de cada um encosta no pico e as outras ficam abaixo conforme idade, minutos jogados, gols, prêmios e fase da seleção.',
 'Demais jogadores: talento estimado pela carreira em Copas (número de Copas, jogos como titular, gols, prêmios) + idade + desempenho naquela Copa + fase alcançada.',
 'Idade: auge entre 25 e 29 anos; abaixo de 22 e acima de 30 a nota cai.',
 'Fase: campeão ganha bônus; quem caiu na fase de grupos perde um pouco.',
 'Copa de 2026: parte da nota atual da base Europa, mais gols e fase alcançada no torneio.',
 'Antes de 1970 não há registro confiável de jogos por jogador; nessas Copas entram só jogadores bons e lendários.',
 'Algumas versões marcantes têm nota ajustada à mão (ex.: Messi 2022, Maradona 1986, Pelé 1970 = 97).',
 'Regra no jogo: se uma versão de um jogador for arrematada, as outras versões dele somem do pote daquela partida; se ninguém comprar, outra versão pode aparecer depois.']:
    m.append([line])
m.column_dimensions['A'].width=140
wb.save('/home/claude/sheet/copa_versoes.xlsx'); print(n-1)
