# Acabou o dinheiro? — instruções do projeto

- Site estático (sem build) hospedado na Vercel; multiplayer via Supabase Realtime (broadcast). O anfitrião roda o motor (`engine.js`) e transmite o estado.
- Idioma do site: português do Brasil. Moeda do jogo: euro (€).
- **Livro de regras:** sempre que qualquer regra do jogo mudar (`engine.js`, opções de sala, formações, pisos de lance etc.), atualize `rules.js` na mesma alteração.
- Não mencionar EA / EA SPORTS FC em nenhum lugar do site; o aviso legal genérico fica no rodapé (`index.html`).
- Teste local: `python3 -m http.server` na pasta e abrir `?local` na URL para usar o modo local (BroadcastChannel) sem Supabase.
