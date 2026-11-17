// LIVRO DE REGRAS — mantenha sempre igual às regras do engine.js.
// Toda mudança de regra no jogo precisa ser refletida aqui.
import { FORMATION_NAMES, SPEEDS, floorFor } from './engine.js';

export function rulesHTML(settings) {
  const s = settings || { budget: 100, speed: 'normal', format: 'liga' };
  const b = s.budget, sp = SPEEDS[s.speed] || SPEEDS.normal;
  const f85 = floorFor({ settings: s }, { o: 85 }), f89 = floorFor({ settings: s }, { o: 89 });
  const fmtName = { liga: 'pontos corridos', mata: 'mata-mata', grupos: 'grupos + mata-mata' }[s.format] || 'pontos corridos';
  return `
  <ol class="rulebook">
    <li><b>Objetivo.</b> Cada técnico tem <b>€${b}</b> para montar um time de 11 titulares no leilão. Depois, os times se enfrentam num campeonato simulado (${fmtName}).</li>
    <li><b>O elenco.</b> São 11 titulares: <b>1 goleiro e 10 jogadores de linha</b>. Não existe banco de reservas. Quem já tem goleiro não disputa outro, e quem já tem 10 de linha só disputa goleiro.</li>
    <li><b>O leilão.</b> Um jogador vai ao martelo por vez. O lance inicial é €1 e cada novo lance precisa ser maior que o anterior. O lote tem ${sp.open}s e todo lance devolve o relógio para pelo menos ${sp.reset}s. Quando o tempo acaba, o maior lance leva: dou-lhe uma, dou-lhe duas, dou-lhe três.</li>
    <li><b>Reserva obrigatória.</b> Você precisa guardar <b>€1 para cada vaga ainda aberta</b>. Por isso o seu teto num lote é o saldo menos a reserva. O botão <b>Máx.</b> dá exatamente esse valor.</li>
    <li><b>Lance mínimo dos craques.</b> Jogadores <b>85+</b> não saem por menos de <b>€${f85}</b> e jogadores <b>89+</b> não saem por menos de <b>€${f89}</b>. Quem não tem esse valor disponível pode dar lance até o próprio teto, mas qualquer técnico com dinheiro para o mínimo precisa cobrir pelo menos o mínimo.</li>
    <li><b>Passar.</b> Se todos os técnicos que podem disputar um lote passarem, ele é resolvido na hora entre os bots, ou sai do leilão se ninguém quiser.</li>
    <li><b>Vagas em branco.</b> Quem terminar o leilão com vagas sobrando recebe, por €0, os <b>piores jogadores que sobraram</b> na posição que falta, e eles jogam <b>fora de ritmo (−5 em tudo)</b>. Se não sobrar ninguém, entra um Cria da Base, bem mais fraco.</li>
    <li><b>Formação.</b> Escolha uma formação antes do leilão para se orientar. Durante o leilão você pode arrumar seus jogadores no campinho (toque em dois para trocar) e mudar de formação quando quiser. Formações disponíveis: ${FORMATION_NAMES.join(', ')}.</li>
    <li><b>Posições.</b> Jogador na posição principal ou numa alternativa rende 100%. Funções equivalentes também rendem 100%: <b>MC e VOL</b>, <b>lateral e ala</b>, <b>meia aberto e ponta</b> (ME/PE e MD/PD). Adaptado (posição vizinha) rende um pouco menos; fora de posição rende bem menos; goleiro na linha, ou jogador de linha no gol, quase nada.</li>
    <li><b>Simulação.</b> Os jogos usam o overall e atributos escondidos de cada jogador (velocidade, finalização, passe, drible, defesa e físico), pesados de acordo com a função em campo. Goleiros contam pelo overall. A formação muda o equilíbrio entre ataque, meio e defesa. Tem sorte envolvida: o melhor time nem sempre ganha.</li>
    <li><b>Campeonato.</b> Pontos corridos: vitória 3, empate 1; desempate por saldo, gols pró e vitórias. Mata-mata: jogo único, empate vai para os pênaltis. Grupos + mata-mata (6 times ou mais): os 2 primeiros de cada grupo avançam. Com número ímpar de times, um time folga por rodada.</li>
    <li><b>Anfitrião.</b> Quem cria a sala roda o jogo para todos e precisa deixar a aba aberta até o fim. Se recarregar, a sala continua de onde parou.</li>
  </ol>`;
}
