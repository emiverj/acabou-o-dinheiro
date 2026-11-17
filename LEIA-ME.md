# Acabou o dinheiro?

Leilão de futebol multiplayer com a base do EA SPORTS FC 27 (339 jogadores masculinos com OVR 81+,
das 5 grandes ligas e dos clubes da Champions e da Europa League 2026/27).

## Arquivos
- `index.html`, `style.css`: página e visual
- `app.js`: telas e sincronização
- `engine.js`: regras do leilão, formações, simulação dos jogos e campeonato
- `players.js`: base de jogadores
- `net.js` / `config.js`: conexão em tempo real (Supabase)

## Como funciona a sala
Quem cria a sala vira o anfitrião: o navegador dele roda o leilão e a simulação e manda o estado para todos.
O anfitrião precisa manter a aba aberta até o fim. Se recarregar a página na mesma aba, a sala continua de onde parou.

## Atualizar a base de jogadores
Troque o arquivo `players.js` (mesmo formato) e suba de novo no GitHub. A Vercel publica sozinha.
