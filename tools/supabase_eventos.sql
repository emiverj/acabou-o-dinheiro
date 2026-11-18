-- Medição de uso do Acabou o dinheiro? (tabela public.eventos no Supabase)
-- Rode no painel do Supabase: SQL Editor → New query → cole → Run.

-- 1) Uma vez: data e hora de cada evento (eventos antigos ficam sem data; os novos também levam dados->>'em')
alter table public.eventos add column if not exists created_at timestamptz not null default now();

-- 2) Salas jogadas, com quem jogou e por onde entrou (criou / lista de salas abertas / código / link)
select coalesce(created_at, (dados->>'em')::timestamptz) at time zone 'America/Sao_Paulo' as quando,
       tipo, sala, dados->>'base' as modo, dados->>'anfitriao' as anfitriao,
       (select string_agg(q->>'tecnico' || ' (' || (q->>'via') || ')', ', ') from jsonb_array_elements(dados->'quem') q) as tecnicos,
       dados->>'campeao' as campeao
from public.eventos
order by quando desc nulls last
limit 200;

-- 3) Quem entrou sem ser pelo link de vocês: técnicos que vieram pela lista de salas abertas ou digitando o código
select coalesce(created_at, (dados->>'em')::timestamptz) at time zone 'America/Sao_Paulo' as quando, sala,
       q->>'tecnico' as tecnico, q->>'time' as time, q->>'via' as entrou_por
from public.eventos, jsonb_array_elements(dados->'quem') q
where tipo = 'leilao_iniciado' and q->>'via' in ('lista', 'codigo')
order by quando desc nulls last;

-- 4) Resumo por dia
select date(coalesce(created_at, (dados->>'em')::timestamptz) at time zone 'America/Sao_Paulo') as dia,
       count(*) filter (where tipo = 'sala_criada') as salas_criadas,
       count(*) filter (where tipo = 'leilao_iniciado') as leiloes,
       count(*) filter (where tipo = 'campeonato_finalizado') as campeonatos,
       sum((dados->>'humanos')::int) filter (where tipo = 'leilao_iniciado') as tecnicos_humanos
from public.eventos
group by 1 order by 1 desc nulls last;
