# Ideias de mecânicas

Pesquisa de mecânicas de outros jogos que caberiam no Necromante (novembro de 2026).
Só entra aqui o que o jogo **ainda não tem**: escolas, itens, gemas, árvore, rituais,
explodir/consumir/fundir, encruzilhada, abismo, diário, campeões e níveis da Descida já existem.

Esforço: **baixo** (um dia ou menos), **médio** (alguns dias), **alto** (arte nova ou sistema grande).

## Prioridade 1

### Postura do exército: Ataque / Defesa
- **Feito** (novembro de 2026): botão ao lado do ritual, teclas `A`/`D`.
- **De onde vem:** *Be My Horde* (um botão troca os lacaios entre ofensivo e defensivo).
- **Como fica aqui:** botão na HUD. *Ataque*: os mortos avançam nos vivos. *Defesa*: os mortos
  ficam em volta do altar, protegem o necromante e caçam quem atira de longe.
- **Por quê:** decisão tática dentro da run (hoje é quase só arrastar o círculo e explodir).
- **Esforço:** baixo. A IA já tem `altarThreat` e formação.

### Selos por personagem na Descida
- **De onde vem:** *stakes* do *Balatro* (cada baralho guarda até que dificuldade venceu) e
  *bounties* do *Hades* (prêmio único por vencer com certa arma num certo Heat).
- **Como fica aqui:** cada quadradinho da grade da Descida mostra selos dos personagens que já
  venceram aquele chefe naquele nível. O primeiro selo de cada personagem em cada nível paga um
  bônus (almas ou gema).
- **Por quê:** 5 personagens × 6 níveis = 30 metas visíveis; motivo claro para "só mais uma run".
- **Esforço:** baixo. A grade e o progresso por nível (`meta.levels`) já existem.

### Veteranos
- **De onde vem:** *Skull Horde* (3 cópias do mesmo lacaio viram um veterano).
- **Como fica aqui:** um morto que mata X vivos ganha uma estrela: mais vida, mais dano, brilho.
  Explodir um veterano vira uma decisão difícil.
- **Por quê:** apego ao exército; conversa com o MVP do fim da run.
- **Esforço:** médio.

## Prioridade 2

### Fusão de duas escolas
- **De onde vem:** evoluções do *Ball x Pit* e do *Vampire Survivors*.
- **Como fica aqui:** maestria em duas escolas libera uma unidade híbrida
  (Ossos + Peste = Esqueleto Pestilento; Sangue + Espírito = Espectro Vampírico).
- **Por quê:** motivo para misturar escolas em vez de ir sempre numa só. Maior impacto da lista.
- **Esforço:** alto (arte de cada híbrido).

### Corrupção com maldições
- **De onde vem:** *Curse of the Dead Gods* (barra de corrupção; cada maldição tem bônus e custo,
  a quinta só custo).
- **Como fica aqui:** consumir mortos e usar ritual enchem a barra; cada nível dela impõe uma
  maldição com bônus e custo ("raios +30%, mas cadáveres duram metade").
- **Por quê:** risco e recompensa no meio da run.
- **Esforço:** médio.

### Pactos dentro do nível
- **De onde vem:** *Pact of Punishment* do *Hades* (modificadores avulsos que somam "Heat";
  prêmios em patamares).
- **Como fica aqui:** os níveis da Descida são a base; por cima, o jogador liga pactos extras
  ("elites 3x", "sem consumir") em troca de mais almas.
- **Por quê:** dificuldade sob medida para quem já fechou tudo.
- **Esforço:** médio. Dá para reaproveitar os modificadores do abismo (`ENDLESS_MODS`).

### Grimórios
- **De onde vem:** Arcanas do *Vampire Survivors*.
- **Como fica aqui:** cartas que mudam uma regra, liberadas por conquistas; escolhe uma antes da
  run ("explodir não mata o morto, só fere", "todo 10º abate vira fantasma").
- **Por quê:** variedade de run sem aumentar poder bruto.
- **Esforço:** médio.

### Diálogo que avança entre runs
- **De onde vem:** *Hades* (quando a novidade mecânica acaba, a história puxa a próxima run).
- **Como fica aqui:** o Coveiro e o mercador encapuzado ganham falas novas a cada morte, chefe e
  nível liberado.
- **Esforço:** baixo de código, precisa de texto.

## Referências
- Be My Horde: https://gamearena.pl/en/news/polished-games-unveils-be-my-horde-a-necromancer-s-roguelite-adventure/
- Skull Horde: https://www.pcgamer.com/games/roguelike/a-floating-magical-skull-goes-to-war-with-his-own-headless-body-in-this-necromantic-roguelike-that-combines-vampire-survivors-like-combat-with-teamfight-tactics-inspired-army-building/
- Undead Horde: https://store.steampowered.com/app/790850/Undead_Horde/
- Hades, Pact of Punishment: https://rpgsite.net/feature/10287-hades-pact-of-punishment-heat-modifiers-and-how-to-maximize-your-rewards
- Ball x Pit, evoluções: https://gam3s.gg/ball-x-pit/guides/ball-x-pit-evolution-combos
- Curse of the Dead Gods: https://gamesradar.com/curse-of-the-dead-gods-best-blessings
- Roguelites com boa progressão: https://gamerant.com/roguelite-games-with-best-progression-systems/
