# Árvore da Necrópole

Proposta para **substituir as 8 construções do Cemitério** (aba Obras) por uma árvore de melhorias permanentes. As almas continuam sendo a moeda. Este documento é o desenho: nada disto está implementado ainda.

**Resumo:** 6 ramos. 48 nós. 234 níveis no total (contando o Anel II). cada ramo termina numa **Coroa**. O custo completo é de **29.690 almas** no anel principal e **62.250** no Anel II.

## Por que trocar

- As 8 construções acabam rápido (cerca de 30 compras) e cada uma faz uma coisa só. Depois disso, as almas perdem o sentido.
- Uma árvore dá **escolhas** (qual ramo subir primeiro muda o estilo do jogo), **metas visíveis** (a próxima Coroa) e uma cauda longa para quem já venceu a Catedral.
- Ela também absorve sistemas que hoje estão soltos: o Salão dos Campeões, os encaixes de gema do altar, o desconto da forja e o tamanho do mercado.

## Estrutura

```
                         [ ALTAR (centro) ]
   Criptas   Ossuário   Biblioteca   Altar de Sangue   Torre do Sino   Relicário
     |          |           |               |                |              |
   Anel I  -> nós de tier 1 (baratos, liberados desde o começo)
   Anel II -> nós de tier 2 (precisa de 6 níveis no ramo + 1 chefe derrotado)
   Anel III-> nós de tier 3 (precisa de 14 níveis no ramo + 2 chefes derrotados)
   Coroa   -> 1 nó final (todos os nós do tier 3 com nível 1+ e a Catedral vencida)
   Anel II de níveis -> depois da Coroa, os nós de tier 1 e 2 ganham +3 níveis extras
```

**Regras de liberação** (por ramo, independentes entre si):

| Camada | Requisito no ramo | Requisito global |
|---|---|---|
| Tier 1 | nenhum | nenhum |
| Tier 2 | 6 níveis comprados no ramo | 1 chefe derrotado (Lenhador) |
| Tier 3 | 14 níveis comprados no ramo | 2 chefes derrotados (Abade) |
| Coroa | todos os nós do tier 3 com nível 1 ou mais | Catedral vencida (heresia 1 liberada) |
| Anel II (níveis extras) | Coroa do ramo comprada | nenhum |

Os requisitos globais impedem que alguém com muitas almas acumuladas pule direto para o fim, e ligam a árvore ao avanço nas regiões.

## Custos

O custo de cada nível é `base do tier x 1.55^(nível - 1)`, arredondado para múltiplos de 5.

| Tier | Base | Nível 1 | Nível 2 | Nível 3 | Nível 4 | Nível 5 | Nó de 5 níveis | Nó de 3 níveis |
|---|---|---|---|---|---|---|---|---|
| 1 | 20 | 20 | 30 | 50 | 75 | 115 | 290 | 100 |
| 2 | 70 | 70 | 110 | 170 | 260 | 405 | 1015 | 350 |
| 3 | 190 | 190 | 295 | 455 | 710 | 1095 | 2745 | 940 |
| Coroa | 900 | 900 | - | - | - | - | - | - |

**Anel II:** cada nível extra custa 3x o último nível normal do nó, crescendo 1.55x por nível. Exemplo: um nó de tier 1 com 5 níveis tem os extras a 345, 535, 830 almas.

## Criptas

_o exército: tamanho. início e levantar._ Custo total do ramo: **6.980 almas**.

| Tier | Nó | Níveis | Por nível | No máximo | Custo total | Implementação |
|---|---|---|---|---|---|---|
| 1 | **Nichos** | 5 | +4 no limite do exército | +20 limite | 290 | `armyCap` |
| 1 | **Covas Rasas** | 5 | +2 esqueletos no início da run | +10 esqueletos | 290 | `startSkeletons` |
| 1 | **Terra Fria** | 3 | cadáveres duram +1s | +3s | 100 | `corpseLife` |
| 2 | **Rito Ligeiro** | 5 | levantar 6% mais rápido | -30% tempo de levantar | 1015 | `raiseTimeMul` |
| 2 | **Vigília** | 3 | +1 esqueleto grátis a cada onda | +3 por onda | 350 | `freeSkeletonsPerWave` |
| 2 | **Marcha Fúnebre** | 3 | mortos +4% velocidade | +12% velocidade | 350 | `deadSpeedMul` |
| 3 | **Catacumbas** | 5 | +5 no limite do exército | +25 limite | 2745 | `armyCap` |
| 3 | **Covas Gêmeas** | 3 | 5% de chance de um cadáver levantar 2 mortos | 15% | 940 | `novo: doubleRaiseChance` |
| Coroa | **Coroa: Necrópole Viva** | 1 | cada região começa com +10 esqueletos; limite +10 | - | 900 | `novo: regionSkeletons` |

## Ossuário

_o corpo dos mortos: vida. dano. colossos._ Custo total do ramo: **4.410 almas**.

| Tier | Nó | Níveis | Por nível | No máximo | Custo total | Implementação |
|---|---|---|---|---|---|---|
| 1 | **Medula** | 5 | mortos +6% vida | +30% vida | 290 | `deadHpMul` |
| 1 | **Ossos Afiados** | 5 | mortos +5% dano | +25% dano | 290 | `deadDmgMul` |
| 2 | **Placas de Osso** | 3 | mortos ignoram 4% do dano | 12% | 350 | `deadArmor` |
| 2 | **Colosso** | 3 | colossos +15% vida e dano | +45% | 350 | `giantMul` |
| 2 | **Restos Teimosos** | 3 | 5% de chance de morto caído virar ossos de novo | 15% | 350 | `boneRebirth (soma com a maestria)` |
| 3 | **Mortos de Elite** | 3 | 3% dos levantados nascem elite (+60% vida e dano) | 9% | 940 | `novo: eliteRaise` |
| 3 | **Osso Profano** | 3 | dano sagrado contra mortos -10% | -30% | 940 | `novo: holyResist` |
| Coroa | **Coroa: Trono de Ossos** | 1 | mortos +15% vida e dano; campeão +20% | - | 900 | `deadHpMul, deadDmgMul, championMul` |

## Biblioteca Proibida

_o necromante: raios. círculo e ritual._ Custo total do ramo: **5.695 almas**.

| Tier | Nó | Níveis | Por nível | No máximo | Custo total | Implementação |
|---|---|---|---|---|---|---|
| 1 | **Leitura Rápida** | 5 | raios 4% mais rápidos | -20% recarga | 290 | `castCdMul` |
| 1 | **Círculo Gravado** | 5 | círculo +1 de raio | +5 raio | 290 | `circleR` |
| 2 | **Palavras de Poder** | 3 | raios +0,5 de dano | +1,5 dano | 350 | `necroDmg` |
| 2 | **Eco** | 2 | raios saltam para +1 alvo | +2 saltos | 180 | `boltChain` |
| 3 | **Liturgia** | 5 | o ritual precisa de 6% menos abates | -30% abates | 2745 | `novo: ritualMul` |
| 3 | **Rito Duplo** | 3 | 8% de chance de o ritual não gastar a carga | 24% | 940 | `novo: ritualKeep` |
| Coroa | **Coroa: Grimório Final** | 1 | raios atravessam escudos, +1 salto, círculo +4 | - | 900 | `spiritMastery parcial, boltChain, circleR` |

## Altar de Sangue

_vida do necromante. sacrifício e explosões._ Custo total do ramo: **4.885 almas**.

| Tier | Nó | Níveis | Por nível | No máximo | Custo total | Implementação |
|---|---|---|---|---|---|---|
| 1 | **Sangue Velho** | 5 | +4 de vida do necromante | +20 vida | 290 | `necroMaxHp` |
| 1 | **Banquete** | 3 | consumir cura +20% | +60% | 100 | `consumeHealMul` |
| 2 | **Coração Lento** | 3 | regenera 1 de vida a cada 20s / 14s / 10s | 1 a cada 10s | 350 | `necroRegen` |
| 2 | **Carne Volátil** | 5 | explosões +8% dano | +40% dano | 1015 | `explodeDmgMul` |
| 2 | **Estilhaços** | 3 | explosões +2 de raio | +6 raio | 350 | `explodeR` |
| 3 | **Fúria Ritual** | 3 | todo sacrifício dá +10% de dano aos mortos por 4s | +30% | 940 | `frenzyDmg, frenzyTime` |
| 3 | **Mártir** | 3 | explodir tem 6% de chance de não gastar o morto | 18% | 940 | `explodeKeep` |
| Coroa | **Coroa: Imortal** | 1 | uma vez por run, ao cair, o necromante volta com 50% da vida consumindo metade do exército | - | 900 | `novo: revive` |

## Torre do Sino

_cartas. eventos e a estrutura da run._ Custo total do ramo: **3.500 almas**.

| Tier | Nó | Níveis | Por nível | No máximo | Custo total | Implementação |
|---|---|---|---|---|---|---|
| 1 | **Badalo** | 1 | 4 cartas por escolha em vez de 3 | - | 20 | `cardChoices` |
| 1 | **Repique** | 3 | +1 troca de cartas por run | +3 trocas | 100 | `rerolls` |
| 2 | **Pacto Antigo** | 3 | começa a run escolhendo 1 carta (até 3) | 3 cartas iniciais | 350 | `novo: startPicks` |
| 2 | **Mapa Roubado** | 1 | a encruzilhada oferece 3 rotas | - | 70 | `novo: routeChoices` |
| 2 | **Augúrio** | 2 | eventos aparecem 15% mais | +30% | 180 | `novo: eventChance` |
| 3 | **Sino de Prata** | 3 | cartas raras e lendárias 15% mais comuns | +45% | 940 | `novo: rareWeight` |
| 3 | **Contrabando** | 3 | mercador da run 10% mais barato; nível 3: +1 item à venda | -30% e 4 itens | 940 | `novo: merchantDiscount` |
| Coroa | **Coroa: Sino dos Mortos** | 1 | ondas ímpares também dão uma escolha (2 cartas) | - | 900 | `novo: oddWaveCards` |

## Relicário

_almas. campeões. itens e gemas._ Custo total do ramo: **4.220 almas**.

| Tier | Nó | Níveis | Por nível | No máximo | Custo total | Implementação |
|---|---|---|---|---|---|---|
| 1 | **Dízimo** | 5 | +6% almas | +30% almas | 290 | `soulMul` |
| 1 | **Salão dos Campeões** | 3 | nível 1 libera o campeão; 2 e 3: +20% força | +40% | 100 | `championMul (substitui o Salão)` |
| 2 | **Faro** | 3 | elites derrubam item 10% mais | +30% | 350 | `novo: eliteLoot` |
| 2 | **Lapidário** | 3 | gemas caem 25% mais | +75% | 350 | `novo: gemMul` |
| 2 | **Encaixe** | 3 | +1 encaixe de gema no altar | 6 encaixes | 350 | `sockets` |
| 3 | **Bigorna** | 3 | forja 10% mais barata; nível 3: espaço vai até +6 | -30% e +1 nível | 940 | `novo: forgeDiscount` |
| 3 | **Mercado Negro** | 3 | +1 item no mercado; renovar 20% mais barato | 7 itens, -60% | 940 | `novo: marketSize` |
| Coroa | **Coroa: Tesouro dos Reis** | 1 | +15% almas; gemas podem cair no nível II; tesouro completo vale o dobro | - | 900 | `soulMul, gems, hoard` |

## Balanço

### Custo por camada

| Camada | Almas (todos os ramos) | Acumulado |
|---|---|---|
| Tier 1 | 2.740 | 2.740 |
| Tier 2 | 6.660 | 9.400 |
| Tier 3 | 14.890 | 24.290 |
| Coroas | 5.400 | 29.690 |
| Anel II | 62.250 | 91.940 |

### Renda e tempo

Almas por run medidas no simulador com a horda (`npm run sim`), com o piloto automático, que é um jogador mediano de propósito. A linha de iniciante é uma estimativa para quem ainda está aprendendo.

| Fase do jogador | Almas por run |
|---|---|
| iniciante (runs 1 a 5, morre na Vila/Mosteiro) | ~180 |
| começo (meta ~0, até a Fortaleza) | ~420 |
| meio (meta ~2, chega na Catedral) | ~900 |
| avançado (meta ~4, abismo) | ~1100 |

| Meta | Custo | Renda usada | Runs | Runs acumuladas | Horas (run de ~10 min) |
|---|---|---|---|---|---|
| Tier 1 completo | 2.740 | 180 | 16 | 16 | ~3h |
| Tier 2 completo | 6.660 | 420 | 16 | 32 | ~5h |
| Tier 3 completo | 14.890 | 900 | 17 | 49 | ~8h |
| todas as Coroas | 5.400 | 1100 | 5 | 54 | ~9h |
| Anel II completo | 62.250 | 1430 (com Dízimo e Tesouro dos Reis) | 44 | 98 | ~16h |

Leitura: as primeiras compras saem **a cada run** (nós de tier 1 custam 20 a 115), o tier 2 vira uma meta de algumas sessões, e as Coroas e o Anel II são a cauda longa para quem joga Heresia. Isso segue o ritmo do King Dies Rich, onde a árvore é o principal motivo de "só mais uma run".

### Poder no máximo (comparado às construções de hoje)

| Efeito | 8 construções no máximo (hoje) | Árvore, anel principal completo |
|---|---|---|
| Limite do exército | +20 | +55 (Nichos, Catacumbas, Coroa) |
| Esqueletos iniciais | +9 | +10, e mais +10 por região com a Coroa |
| Vida dos mortos | +50% | +30% Medula, +15% Coroa, +12% de armadura |
| Dano dos mortos | +40% | +25% Ossos Afiados, +15% Coroa, Fúria até +30% |
| Vida do necromante | +20 | +20, regeneração e um revive por run |
| Raios | 30% mais rápidos, +1 dano | 20% mais rápidos, +1,5 dano, +3 saltos |
| Cartas | 4 por escolha, 2 trocas | 4 por escolha, 3 trocas, 3 cartas iniciais, cartas em toda onda |
| Almas | +50% | +30% e +15% da Coroa |

O teto de poder fica **cerca de 1,6x** o das construções de hoje, mas espalhado por mais tempo e por escolhas. O excedente é pensado para ser consumido pela **Heresia** (cada nível soma uma regra contra o jogador). A recomendação é recalibrar a Heresia com o simulador depois de implementar.

### Regras de balanceamento usadas

1. **Custo cresce 1,55x por nível** dentro do nó, e a base sobe cerca de 3x de um tier para o outro. O jogador sempre tem algo barato para comprar em outro ramo, o que incentiva espalhar em vez de maximizar um nó só.
2. **Efeitos lineares por nível** (cada nível vale o mesmo) com custo exponencial: o retorno por alma cai, e os primeiros níveis de cada nó são as melhores compras.
3. **Nós que mudam regras** (Covas Gêmeas, Mortos de Elite, Rito Duplo, Mártir) ficam no tier 3, com efeito pequeno por nível. Eles adicionam variedade sem inflar números.
4. **Coroas** são uma compra única e cara, cada uma com uma mecânica marcante (revive, cartas em toda onda, +10 esqueletos por região). Elas são o objetivo visível de cada ramo.
5. **Economia e poder separados:** o Relicário dá almas e loot, não força direta. Quem investe nele progride mais rápido depois, mas fica mais fraco agora.

## Migração do save

- **Devolver 100% das almas gastas** nas construções antigas e zerar as construções. É simples, justo e deixa o jogador montar a árvore do jeito dele.
- O campeão já desbloqueado continua liberado (o Salão vira o nó `Salão dos Campeões` no nível 1, de graça para quem já tinha).
- Encaixes de gema: quem tem gemas encaixadas continua com 3 encaixes (o nó Encaixe só adiciona).
- Subir a versão do save para 5 e cobrir a migração num teste, como as anteriores.

## Interface

- A aba **Obras** vira **Árvore**: um mapa rolável com o altar no centro e os 6 ramos em leque. Em 180x320 cabe um ramo por tela: deslizar para o lado troca de ramo e um anel de ícones no topo mostra os 6.
- Cada nó mostra o ícone, as bolinhas de nível (como as construções de hoje) e o preço. Nós bloqueados aparecem apagados, com o requisito ("precisa: 6 níveis no ramo").
- Comprar uma Coroa merece o mesmo tratamento de uma sinergia: flash, tremor e som.

## Implementação sugerida

1. `src/sim/tree.ts`: os dados desta tabela (`id`, ramo, tier, máximo, `apply(m, nível)`) e as regras de liberação. O `metaMods` aplica os nós no lugar de `BUILDINGS`.
2. Os efeitos marcados como `novo:` precisam de um campo novo em `Mods` e de suporte no `world.ts`: `doubleRaiseChance`, `regionSkeletons`, `eliteRaise`, `holyResist`, `ritualMul`, `ritualKeep`, `revive`, `startPicks`, `routeChoices`, `eventChance`, `rareWeight`, `merchantDiscount`, `oddWaveCards`, `eliteLoot`, `gemMul`, `forgeDiscount` e `marketSize`.
3. Gerar este documento a partir do mesmo arquivo de dados, para os números nunca divergirem.
4. Rodar `npm run sim` com a árvore em três estágios (tier 1, tier 2 e tudo completo) e ajustar a Heresia para que o nível 10 continue difícil com a árvore completa.
