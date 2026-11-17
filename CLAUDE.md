# Acabou o dinheiro? — instruções do projeto

- Site estático (sem build) hospedado na Vercel; multiplayer via Supabase Realtime (broadcast). O anfitrião roda o motor (`engine.js`) e transmite o estado.
- Idioma do site: português do Brasil. Moeda do jogo: real (R$).
- **Livro de regras:** sempre que qualquer regra do jogo mudar (`engine.js`, opções de sala, formações, pisos de lance etc.), atualize `rules.js` na mesma alteração.
- Não mencionar EA / EA SPORTS FC em nenhum lugar do site; o aviso legal genérico fica no rodapé (`index.html`).
- Teste local: `python3 -m http.server` na pasta e abrir `?local` na URL para usar o modo local (BroadcastChannel) sem Supabase.
- Duas bases de jogadores, escolhidas na criação da sala (`settings.base`): `players.js` (Europa, 81+) e `players_br.js` (Brasileirão Série A 2026, régua própria 74–91 calculada a partir do Transfermarkt). `db.js` troca a base ativa; nunca misture as duas numa partida.
- Todo modo/região novo precisa de um ícone próprio em `icons/<id>.svg`, registrado em `MODES` (`db.js`), e de um tema de cores (`body[data-mode=<id>]` no `style.css`). Europa = azul-escuro (noite de Champions); Brasileirão = verde e amarelo.
- Especiais (`x` + ícone `xi`): um apelido ÚNICO por jogador (88+ e lendas), em linguagem popular (Foguete, Maestro, Malvadeza…). Lendas: históricos abaixo de 88 com `l:1` (selo 👑). Cobradores oficiais têm `pk:1`.
