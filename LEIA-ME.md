# Acabou o dinheiro?

Leilão de futebol multiplayer: cada técnico tem R$ 100 para montar 11 titulares e os times disputam um campeonato simulado.
Base: 339 jogadores masculinos com OVR 81+ das 5 grandes ligas e dos clubes da Champions e da Europa League 2026/27.

## Arquivos
- `index.html`, `style.css`: página e visual
- `app.js`: telas e sincronização
- `engine.js`: regras do leilão, formações, simulação dos jogos e campeonato
- `rules.js`: **livro de regras** exibido no jogo
- `players.js`: base de jogadores · `kits.js`: camisas ilustradas por clube
- `net.js` / `config.js`: conexão em tempo real (Supabase)
- `logo.png`, `marcio.jpg`: arte do jogo

## Regra de manutenção
Toda mudança de regra em `engine.js` precisa ser refletida no livro de regras (`rules.js`).

## Como funciona a sala
Quem cria a sala vira o anfitrião: o navegador dele roda o leilão e a simulação e manda o estado para todos.
O anfitrião precisa manter a aba aberta até o fim. Se recarregar a página na mesma aba, a sala continua de onde parou.
