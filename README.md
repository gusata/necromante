# Necromante

Roguelite de defesa em pixel art. O necromante não sai do altar: você arrasta o círculo, quem morre dentro dele levanta como morto-vivo, e o exército é escudo, munição e pontuação ao mesmo tempo. Veja o [ROADMAP](ROADMAP.md) e o [guia de estilo](docs/ESTILO.md).

Stack: TypeScript + Phaser 3 + Vite, empacotado com Capacitor. Arte, fonte, sons e música são gerados no código: o projeto não tem nenhum arquivo de imagem ou áudio.

## Rodar

```bash
npm install
npm run dev        # abre em http://localhost:5173 e mostra o endereço da rede local
```

Para testar no celular: com o celular no mesmo Wi-Fi, abra o endereço `Network:` que o `npm run dev` imprime.

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento com recarga automática |
| `npm test` | testes da simulação (Vitest) |
| `npm run sim -- 40 2` | simulador de balanceamento: 40 runs automáticas com meta-progressão nível 2 |
| `npm run sim -- 16 2 builds` | taxa de vitória por escola (cada run força uma escola) |
| `npm run sim -- 14 2 chars` | taxa de vitória por personagem |
| `npx tsx scripts/diag.ts 1 2` | uma run onda a onda: tempo, tamanho da horda, pico na tela, custo da simulação (`START=25` começa no abismo) |
| `npm run lint` / `npm run format` | Biome |
| `npm run build` | checa tipos e gera `dist/` |
| `npm run android` | build + sync + abre o Android Studio (precisa do Android Studio/JDK instalados) |

### Parâmetros de debug na URL

| Parâmetro | Efeito |
|---|---|
| `?run` | pula o menu |
| `?auto` | o jogo se joga sozinho (inclusive escolhe cartas) |
| `?wave=13` | começa na onda 13 (`6` = primeiro chefe, `25` = abismo) |
| `?meta=3` | finge meta-progressão nível 3 (escolas, campeões, construções; 4+ libera a heresia 3). Se a run terminar, o resultado é salvo |
| `?scene=Graveyard` | abre uma cena direto (`Graveyard`, `Bestiary`, `Records`, `Options`, `Characters`) |
| `?fps` | contador de quadros |
| `?char=reaper` | joga com um personagem (`necro`, `witch`, `digger`, `reaper`, `vampire`) |
| `?scene=Graveyard&tab=market` | abre o cemitério numa aba (`build`, `market`, `arsenal`, `altar`, `hoard`) |

`window.__game` no console do navegador dá acesso ao jogo.

## Como se joga

- **Arrastar** em qualquer lugar do campo move o círculo. O movimento é relativo, então o dedo não cobre o círculo.
- O necromante lança raios em quem está no círculo. Quem morre ali **levanta** para o seu lado.
- **Explodir** (`1`/`Q`): os mortos no círculo explodem.
- **Fundir** (`2`/`W`): cada 3 esqueletos no círculo viram um Colosso de Ossos (até 4 por toque).
- **Consumir** (`3`/`E`): sacrifica mortos para curar.
- **Ritual** (`4`/`R`, botão no canto de baixo): habilidade especial do personagem, carregada por abates.
- Nas ondas pares você escolhe **1 pacto** (carta). Três cartas da mesma escola liberam a **Maestria** e cinco, o **Domínio**.
- `S` ou o botão `1X/2X`: velocidade do jogo. `Esc`/`P`: pausa.
- Nas Opções, a **mira** pode ser **arrastar** (padrão: o movimento é relativo) ou **tocar direto** (o círculo vai para onde o dedo toca).

A primeira run tem um tutorial sem texto: uma mão mostra o gesto na hora em que ele é útil.

### Horda

O jogo é um **mar de unidades**: os vivos chegam em bandos (de 40 a mais de 150 por onda, e mais no abismo), o exército vai de 60 mortos para cima e o necromante lança raios em cadeia. Os vivos comuns morrem com um ou dois golpes. Os perigosos (paladino, bispo, templário) continuam raros e resistentes. Explodir dezenas de mortos de uma vez vira um único impacto, e o contador de **combo** mostra os abates seguidos. Quando sobram poucos vivos, os mortos partem para a caça e a onda termina sem travar.

### Estrutura de uma run

4 regiões com 5 ondas e 1 chefe cada (Vila, Mosteiro, Fortaleza, Catedral). Depois vêm os **círculos do abismo**, infinitos, cada um com um modificador novo. O primeiro chefe do abismo é o **Serafim**, um chefe secreto. Chefes derrotados viram **campeões** que você pode levar para as próximas runs.

- **Encruzilhada:** depois de cada chefe você escolhe a rota até a próxima região (ex.: Trilha dos Enforcados, +30% inimigos e +50% almas).
- **Eventos:** depois das ondas 2 e 4 de cada região pode aparecer uma escolha com risco (Altar Profano, Poço das Almas, Pacto de Sangue...).
- **Heresia:** vencer a Catedral libera níveis de dificuldade (até 10), escolhidos na tela de personagem. Cada nível soma uma regra nova e +10% de almas.
- **Desafio diário:** a mesma seed e 2 modificadores do abismo para todo mundo no dia. A primeira tentativa do dia dá bônus de almas.
- **Flancos e arremessadores:** a partir do Mosteiro, alguns bandos entram pelas laterais (uma seta vermelha avisa), e o **Arremessador** fica longe atirando vivos por cima do exército, direto no altar.
- **Salvar e retomar:** a run é salva no fim de cada onda e ao minimizar o app. O menu mostra **CONTINUAR**.

### Personagens

Cinco necromantes, cada um muda a ação principal. Novos personagens são liberados por conquistas e comprados com almas:

| Personagem | Estilo | Libera |
|---|---|---|
| O Necromante | raios rápidos em um alvo | desde o início |
| A Bruxa da Praga | o círculo envenena, explodir deixa nuvem | derrotar o Lenhador |
| O Coveiro | cada cadáver levanta 2 mortos, exército menor | jogar 3 runs |
| O Ceifador | a foice acerta todos no círculo | derrotar o Abade |
| A Vampira | perde vida com o tempo, cura matando | derrotar o Comandante |

Rituais: Tempestade de Almas (um raio em cada vivo), Peste Negra (envenena tudo), Cova Coletiva (todo cadáver levanta, sem limite), Grande Colheita (corte que executa os feridos) e Banquete (drena, cura e dá frenesi).

### Mortos

Além de esqueletos, arqueiros, colossos, zumbis, carniçais, ratos, fantasmas e servos, cada escola tem um morto raro liberado por carta: **Lich** (ossos, raio mágico em área), **Abominação** (carne, gigante que esmaga vários), **Portador da Peste** (praga, envenena em volta), **Banshee** (espírito, voa e atordoa com o grito) e **Cavaleiro Rubro** (sangue, investe e bebe vida).

### Itens

33 itens em 6 espaços (cajado, capuz, manto, amuleto e 2 anéis), de comum a lendário, mais peças de **conjunto**. Muitos **contam como cartas de uma escola**, então o equipamento prepara a sinergia antes da run. Os lendários mudam regras (Coroa do Lich, Manto do Ceifador, Cajado da Colheita...). Itens caem de **elites** (inimigos com contorno dourado) e de chefes, e ficam com você mesmo se morrer. Item repetido sobe de nível.

- **Conjuntos:** 3 conjuntos de 3 peças que misturam duas escolas (cada peça conta para as duas). Com 2 e com 3 peças equipadas ligam bônus próprios: Ossos Pestilentos (ossos + praga), Pacto Carmesim (carne + sangue) e Coro Fantasma (espírito + carne).
- **Tesouro:** todo lendário e toda peça de conjunto que você acha dá um bônus pequeno e permanente, mesmo guardado. Completar o tesouro dá +10% de almas e +5% de dano dos mortos.
- **Forja por espaço:** a forja melhora o espaço (cajado, capuz...), não o item. Trocar de item não perde o investimento.
- **Gemas:** caem de elites e chefes. Três iguais viram uma de nível acima (I a V), e elas vão nos 3 encaixes do **Altar**: Rubi (dano dos mortos), Safira (raios), Esmeralda (vida dos mortos), Ametista (círculo) e Diamante (vida do necromante).

### Meta-progressão

As almas de cada run vão para o **Cemitério**, que tem cinco abas: **Obras** (8 construções; a [árvore da Necrópole](docs/ARVORE.md) é a proposta para substituí-las), **Mercado** (4 itens que mudam a cada run), **Arsenal** (equipar e forjar espaços), **Altar** (gemas) e **Tesouro**. Durante a run, depois da onda 3 de cada região, aparece o **Mercador Encapuzado**, que troca as almas da run por itens. Cada chefe derrotado pela primeira vez libera uma nova escola de pactos: Ossos e Carne no começo, depois Praga, Espírito e Sangue. O **Bestiário** registra os abates com medalhas de bronze, prata e ouro. Os **Registros** mostram estatísticas da vida toda, as últimas 20 runs (com o MVP do exército) e 20 **conquistas** que dão almas.

## Estrutura

```
src/
  sim/          lógica pura do jogo, sem Phaser (testável, determinística com seed)
    defs.ts       unidades, chefes e constantes de balanceamento
    cards.ts      escolas, pactos e sinergias
    regions.ts    regiões, ondas e modificadores do abismo
    meta.ts       cemitério, campeões, bestiário, save
    world.ts      a run: ondas, combate, status, habilidades, ritual, ações do jogador, salvar/retomar
    spatial.ts    grade espacial (vizinhos, áreas e separação sem O(n²))
    events.ts     eventos entre ondas e rotas da encruzilhada
    heresy.ts     níveis de heresia (dificuldade)
    items.ts      itens, conjuntos e tesouro
    gems.ts       gemas, fusão e encaixes do altar
    progress.ts   fim de run: histórico, estatísticas, conquistas, desafio diário
    autopilot.ts  jogador automático (debug e simulador)
  art/          pixel art gerada em código: paleta, mapas de pixels, gerador de humanoides, upscale 2x
  audio/        efeitos e trilha sintetizados (WebAudio)
  fx/           juice: tremor, hitstop, flashes, transições, estilhaçar sprites, botões
  scenes/       Boot, Menu, Personagens, Cemitério, Bestiário, Registros, Opções, Run (+ tutorial.ts)
  platform/     save (Capacitor Preferences) e vibração (Capacitor Haptics)
scripts/        simulador de balanceamento e diagnóstico de ritmo
tests/          testes da simulação
android/        projeto nativo gerado pelo Capacitor
```

## Arte do Aseprite

Exporte do Aseprite (File > Export Sprite Sheet, JSON com Tags) para `public/assets/sprites/` e registre no `manifest.json`. A arte exportada substitui a gerada, com as mesmas chaves (`peasant0`, `peasant1`...). Unidades usam as tags `walk` (2 quadros) e `attack` (1 quadro). Veja `src/art/aseprite.ts` e o exemplo em `docs/exemplo-aseprite/`.

Para ajustar a dificuldade, mexa em `src/sim/defs.ts` e `src/sim/regions.ts`, depois rode `npm run sim`. Para criar um inimigo, adicione o tipo em `types.ts`, os números em `defs.ts`, a aparência em `art/humanoid.ts` (`HUMANOIDS`) e o lugar dele em `regions.ts`.
