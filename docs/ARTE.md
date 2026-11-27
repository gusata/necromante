#  Arte: direção e tudo que precisa ser desenhado

Quase toda a arte do jogo ainda é gerada por código (pixel a pixel, em `src/art/`). Este documento diz **como** a arte
deve ser e lista **tudo** que aparece na tela, com o tamanho para desenhar e a chave de textura que o jogo usa.
Desenhou uma, exportou do Aseprite, registrou no manifesto: ela substitui a gerada sem mexer em código (veja "Como
entregar" no fim).

Marque `[x]` conforme for fazendo.

## A regra que vale mais que todas: uma grade só

**1 pixel da arte = 1 pixel do mundo.** O mundo tem 180x320 e aparece na tela de 360x640 com cada pixel virando um
quadrado de 2x2. Tudo usa esse mesmo pixel: bichos, chão, ícones, fonte, bordas de painel, barras, partículas.
Nada é desenhado com mais resolução que o resto.

Por quê: o que mais estraga pixel art é misturar tamanhos de pixel na mesma tela (um esqueleto fininho ao lado de um
camponês de pixel grosso, um ícone liso ao lado de uma fonte quadradona). Com uma grade só, o jogo inteiro parece
feito pela mesma mão, mesmo quando cada peça é simples.

- **Exceção técnica, não visual:** os ícones de item aparecem com escala 2 na interface, então são desenhados com
**18x18** e o jogo os lê com `res 2`. O pixel deles continua sendo 1 pixel do mundo.
- Ampliar um sprite inteiro por um fator inteiro é permitido **só isolado**, como no retrato grande de um cartão.
Nunca na mesma cena que a versão normal.
- Nada de escala fracionária nem rotação em sprites parados.
- **Texto, como no King Dies Rich:** uma fonte só (Tiny5, traço de 1 px, 5 px de altura), **nunca ampliada** e sem
a versão grossa. Título é a mesma fonte em **maiúsculas com 2 px entre letras** (`pxText(..., false, true)`); a
hierarquia vem da cor (dourado para título e destaque, creme para texto, cinza para o secundário). Números por cima
de ícones (quantidade, nível) usam `pxCount`, com contorno preto em volta.
- **Gemas:** o nível é a forma, não um número: 1 pedra bruta, 2 lapidada, 3 brilhante, 4 octaedro, 5 cabochão com aro de
ouro (`gem-<tipo>-<nível>`, 16x16). No altar cada gema possível tem uma casa fixa; a que falta aparece como silhueta
escura.
- **Espaço de item vazio:** mostra a silhueta apagada do tipo (`slot-sil-*`), nunca texto. A escola do item vai num
selinho com contorno preto no canto (`badge-*`).

## Direção de arte

### A ideia em uma frase

**Um palco escuro com um holofote no necromante: pouco detalhe por bicho, muitos bichos, e o verde-alma como a única
cor que grita.** É um *horde game*: 60 mortos contra 100 vivos na tela. A beleza vem da consistência, da luz e da
quantidade, não do detalhe de cada sprite.

### Os 5 pilares

1. **Uma grade só.** Veja acima. Se uma peça nova não casa com a grade, ela está errada, por mais bonita que seja.
2. **Pouco detalhe, silhueta forte.** Bichos pequenos (16x22), com 2 a 3 tons por material, sem contorno preto e
 sem linhas internas. Cada tipo é reconhecido pela **cor e pela forma** antes de qualquer detalhe. Teste: no
 tamanho real, de longe, dá para dizer quem é cada um?
3. **Palco escuro, holofote no centro.** O chão é quase preto e de baixíssimo contraste. A luz é um halo pontilhado
 em volta do necromante e das fontes de luz; as bordas da tela escurecem (vinheta). O que está fora da luz vira
 **silhueta escura com os olhos acesos**: profundidade e clima quase de graça.
4. **Uma cor de destaque.** O **verde-alma** é do jogador e é a cor que mais chama atenção na batalha: almas
 coletadas, magia, olhos dos mortos, o círculo. O resto da paleta é contido para que ele salte. Dourado e branco
 são do sagrado (inimigo); vermelho é sangue e perigo.
5. **Efeito é geometria simples em quantidade.** Círculos de 1 px, linhas retas de 1 px, partículas de 1 a 2 px,
 formas cheias com bordas pontilhadas. A tela "explode" pelo número de coisas, não pelo detalhe de cada uma.

**Referências de sensação** (não copiar nada, só os princípios): King Dies Rich (grade única, bichos chapados,
silhuetas na névoa, uma cor de destaque, interface limpa), Vampire Survivors (legibilidade com muita coisa na tela),
Darkest Dungeon (clima), Blasphemous (iconografia religiosa sombria).

### Regras de pixel

- **Sem contorno preto nos bichos.** A borda é feita com o **tom mais escuro do próprio material**, e só onde a
forma está na sombra (direita e embaixo). No lado da luz, a borda é o próprio tom base. O bicho se separa do chão
pelo valor: figura média-clara sobre fundo quase preto.
- **Ícones e itens:** borda na cor mais escura de cada material (sel-out), nunca preta. Eles ficam sobre o fundo
escuro do espaço, então a borda escura colorida basta.
- **Tons:** 2 a 3 por material (base, sombra e, só se precisar, uma luz). Uma sombra funda para a borda.
- **Luz de cima e um pouco da esquerda**, sempre.
- **Sem:** anti-aliasing, degradê, linhas internas pretas, brilho em tudo, pixels soltos ("ruído"), texturas.
- **Dithering (xadrez de pixels) só em luz, névoa, chão e efeitos grandes.** Nunca dentro dos bichos ou ícones.
- **Ponto de apoio:** pés na **última linha** do quadro, centralizados. Folga de 1 px nas laterais.
- **Direção:** todo bicho olha para a **direita**, em 3/4. O necromante fica de frente.
- **Proporção:** cabeça grande (cerca de 1/3 da altura), umas 2,5 cabeças de altura. Arma de 1 a 2 px de largura,
em cor que contraste com o corpo (metal claro sobre osso, madeira escura sobre pele).
- **Olhos:** mortos têm olhos **verde-alma** `#aef5bf`, 1 px cada. Vivos têm olhos escuros. Na névoa, qualquer
silhueta mostra só os olhos acesos.
- **Detalhe que some no tamanho real não existe.** Costura, corrente, ponto de luz: se não aparece no celular, sai.

### Paleta

As **cores de identidade** (alma, sagrado, sangue) não mudam sem a gente conversar, porque a interface e os efeitos
usam as mesmas. Os materiais podem ganhar tons intermediários, mas cada bicho usa poucos.

**Identidade**


| Uso                                                          | Escuro    | Base      | Claro     |
| ------------------------------------------------------------ | --------- | --------- | --------- |
| Alma (o jogador, magia, olhos dos mortos, a cor de destaque) | `#1f6a3e` | `#38b46a` | `#aef5bf` |
| Sagrado (vivos da igreja, luz divina)                        | `#8a5a18` | `#c9a23a` | `#f6cf6a` |
| Sangue e perigo                                              | `#5a0f1d` | `#9e2236` | `#e0304a` |
| Fogo (tochas, explosões)                                     | `#8a3a14` | `#d0662a` | `#f6cf6a` |
| Vazio (olhos, bocas, buracos)                                | `#241c2c` |           |           |


**Materiais** (a última coluna é a borda do lado da sombra)


| Material            | Luz       | Base      | Sombra    | Borda     |
| ------------------- | --------- | --------- | --------- | --------- |
| Osso                | `#f8f4e8` | `#e3dccb` | `#a49c86` | `#6b6452` |
| Manto do necromante | `#6a4888` | `#4c2f61` | `#2e1d3b` | `#17111f` |
| Pele                | `#c9987a` | `#a97a5e` | `#7a5240` | `#5a3a2c` |
| Roupa camponesa     | `#7d5a40` | `#634532` | `#3d2a20` | `#2a1c14` |
| Metal               | `#c8d0e0` | `#8a94a6` | `#464e5e` | `#2a2f3a` |
| Túnica sagrada      | `#ece8f4` | `#bdb7c9` | `#7f7990` | `#4a4658` |
| Pedra               | `#44394f` | `#302939` | `#221d2a` | `#110e16` |


**Regiões** (cor dominante do chão e do que vive lá). Nenhum pixel de chão passa de uns 20% de brilho.


| Região      | Chão                                                  | Vivos de lá                                    |
| ----------- | ----------------------------------------------------- | ---------------------------------------------- |
| A Vila      | terra quente: `#1a120e`, `#20160f`, `#281b13`         | marrom, verde-musgo, palha, laranja das tochas |
| O Mosteiro  | lajota verde-azulada: `#10181c`, `#141e22`, `#1a262a` | burel marrom, branco, um pouco de dourado      |
| A Fortaleza | pedra azul-aço: `#12151e`, `#171b26`, `#1d2230`       | aço, vermelho heráldico, couro                 |
| A Catedral  | mármore roxo: `#170f1c`, `#1d1324`, `#24182c`         | branco, dourado, roxo, vermelho de cardeal     |


**Escolas dos mortos** (cor de destaque nos bichos, itens e efeitos de cada uma)


| Escola   | Cor       | Como aparece                                 |
| -------- | --------- | -------------------------------------------- |
| Ossos    | `#e3dccb` | osso limpo; arqueiros e liches               |
| Carne    | `#b5525e` | carne rosada e acinzentada, costuras grandes |
| Praga    | `#8fbf3a` | verde-amarelado doente, bolhas               |
| Espírito | `#8fd3ff` | azul-ciano (tons, não transparência)         |
| Sangue   | `#e0304a` | vermelho vivo, armadura escura               |


**Necromantes jogáveis** (cor do brilho: cajado, olhos, ritual)


| Personagem       | Brilho                     |
| ---------------- | -------------------------- |
| O Necromante     | `#38b46a` verde-alma       |
| A Bruxa da Praga | `#8fbf3a` verde-praga      |
| O Coveiro        | `#e0a040` âmbar de lampião |
| O Ceifador       | `#c8d0e0` prata fria       |
| A Vampira        | `#ff3a50` vermelho         |


**Raridade dos itens** (só a moldura do espaço usa essa cor; o item nunca)


| Comum     | Mágico    | Raro      | Épico     | Relíquia  | Conjunto  |
| --------- | --------- | --------- | --------- | --------- | --------- |
| `#a49c86` | `#6fa8c8` | `#e0b040` | `#b468e0` | `#ff7a3a` | `#4ee08a` |


### Por grupo

**Necromantes.** O maior sprite comum (32x38), de frente, com a silhueta mais limpa da tela. Manto escuro que quase
some no chão; o que o destaca é o **brilho** (olhos, cristal do cajado) e o halo de luz em volta dele.

**Mortos (seu exército).** Desbotados e frios: osso creme, carne acinzentada. Olhos verde-alma em todos. Postura
curvada. Cada tipo com silhueta e cor próprias: esqueleto magro e claro com espada, zumbi largo e esverdeado-
acinzentado, carniçal de quatro, rato minúsculo, fantasma sem pés, colosso enorme e torto.

**Vivos (inimigos).** Mais quentes e saturados que os mortos. Cada classe tem **um objeto que identifica** (forcado,
tocha, lanterna, sino, escudo, alabarda, besta), grande e em cor que contraste. Quanto mais avançada a região, mais
armadura, branco e dourado.

**Chefes.** O dobro do tamanho (32x44), com um objeto-assinatura gigante. Podem ter um tom a mais que os outros, mas
seguem a mesma grade e as mesmas regras. O Serafim é o único "bonito": branco, dourado e asas.

**Cadáveres.** Deitados de lado, cor do vivo apagada, uma mancha de sangue pequena. Contraste suficiente com o chão
para o jogador achar.

**Cenário.** Enfeites nas bordas, escuros, sem brigar com os bichos. Sem branco puro e sem cores de identidade
(exceto a chama de velas e braseiros, que são luz).

**Ícones da interface.** Uma ideia só, silhueta forte, 1 ou 2 cores dominantes, **com folga em volta** (o desenho
ocupa uns 3/4 do quadro). Reconhecível em 1 segundo. O mesmo estilo em todos os ícones de um grupo.

**Itens (18x18).** O desenho mostra **o objeto**. A raridade é a moldura do espaço, não o item. A escola aparece
como cor de detalhe (a pedra do anel, o pano do capuz). Relíquias podem ter um brilho próprio; peças de um conjunto
usam a mesma cor e o mesmo motivo.

**Interface.** Painéis quase pretos e quentes, borda de 1 px, canto com o pixel cortado, sem textura. O destaque da
interface é o ouro das molduras e dos títulos; o resto é creme e cinza-marrom. Fonte só em maiúsculas, **com
espaçamento largo entre as letras**. Espaços de item: quadrado com borda na cor da raridade, fundo escuro e um
**selo** pequeno no canto para a escola ou um efeito. Botão principal chapado, com 1 px de luz em cima.

**Efeitos.** Cor da escola ou da origem: magia do jogador em verde-alma, sagrado em branco e dourado, veneno
verde-amarelado, sangue vermelho, explosão de osso em laranja e creme. Formas simples (círculos e linhas de 1 px,
partículas de 1 a 2 px) em grande quantidade. Almas coletadas voam em **rios de partículas verdes** até o necromante.

### Luz, névoa e profundidade (feito no código)

Isto não se desenha: o jogo faz. Está aqui porque é metade da beleza.

- **Halo:** um círculo de luz pontilhado em volta do necromante e de cada fonte de luz.
- **Vinheta:** as bordas da tela mais escuras que o centro.
- **Silhuetas na névoa:** vivos que ainda não entraram na luz aparecem como silhueta azul-escura chapada, só com
os olhos acesos.
- **Manchas no chão:** queimado e sangue como manchas escuras pontilhadas, que quebram a monotonia do chão.

### Animação

- **Andar:** 2 quadros hoje (4 é melhor). O corpo sobe 1 px no quadro de passagem; pernas alternam.
- **Atacar:** 1 quadro hoje (2 a 3 é melhor): a arma muda de lugar e a silhueta muda bastante.
- **Morrer (opcional, 4 quadros):** cai para trás; o último quadro pode ser o cadáver.
- **Velocidade:** o jogo toca a 6 quadros por segundo para andar. Poses bem diferentes entre si.
- O jogo já faz sozinho: tremer ao levar dano, piscar branco, esticar e achatar ao nascer.

### Fazer e não fazer


| Fazer                                                   | Não fazer                                                 |
| ------------------------------------------------------- | --------------------------------------------------------- |
| Uma grade só (1 px da arte = 1 px do mundo)             | Arte com mais resolução que o resto da tela               |
| 2 a 3 tons chapados por material                        | Sombra em degradê, brilho em tudo, linhas internas pretas |
| Borda no tom mais escuro do material, no lado da sombra | Contorno preto em volta do bicho                          |
| Silhueta e cor que identificam de longe                 | Detalhe que some no celular (costura, corrente, ponto)    |
| Verde-alma como a cor que mais chama atenção            | Várias cores fortes disputando o olho                     |
| Chão quase preto e calmo                                | Chão com contraste ou cor viva                            |
| Ícone com folga em volta                                | Ícone ocupando o quadro inteiro                           |
| Pés na última linha, centralizados                      | Sprite flutuando no quadro                                |
| Um objeto grande que identifica a classe                | Armas pequenas e difíceis de ver                          |


## Por onde começar (o que mais aparece na tela)

1. Esqueleto (aparece 50 vezes por tela) e camponês
2. Necromante (o protagonista, sempre embaixo)
3. Chão da Vila e os enfeites da Vila
4. Fonte com acentos e espaçamento largo (a atual não tem acentos: "OPÇÕES" aparece "OPCOES")
5. Ícones da interface (alma, caveira, coração, botões de ação, barra de navegação)
6. O resto dos vivos da Vila, depois as outras regiões
7. Itens

## Resumo


| Grupo                 | Quantidade                     | Tamanho para desenhar            |
| --------------------- | ------------------------------ | -------------------------------- |
| Necromantes jogáveis  | 5 x 3 quadros                  | 32x38                            |
| Mortos (seu exército) | 13 tipos x 3 quadros           | 16x22 (alguns maiores)           |
| Vivos (inimigos)      | 21 tipos x 3 quadros + cadáver | 16x22, cadáver 16x6              |
| Chefes                | 5 x 3 quadros                  | 32x44                            |
| Chão das regiões      | 4                              | 180x320 (ou um bloco que repete) |
| Enfeites de cenário   | 15                             | 3x7 a 14x13                      |
| Projéteis e manchas   | 7                              | 5x3 a 8x5                        |
| Ícones de interface   | \~45                           | 5x5 a 22x22                      |
| Itens                 | 98                             | 18x18                            |
| Fonte                 | 2 (normal e lisa)              | letras de 5 a 7 px de altura     |
| Painéis e botões      | \~20                           | variados                         |
| Ícone do app e splash | 3                              | ver no fim                       |


---

## 1. Necromantes jogáveis (32x38)

Versão desenhada por código em `art-work/necros/make_necros.py` (`--install` registra no manifesto).

Quadros: `0` parado, `1` respirando, `-cast` conjurando (levanta o cajado; o raio sai da ponta do cajado, uns 10 px
à direita e 32 px acima dos pés). Ficam sempre embaixo da tela, de frente.

- [x] `necro0`, `necro1`, `necro-cast` — O Necromante (capuz roxo, cajado com cristal verde)
- [x] `char-witch0`, `char-witch1`, `char-witch-cast` — A Bruxa da Praga (praga, verde-amarelado)
- [x] `char-digger0`, `char-digger1`, `char-digger-cast` — O Coveiro (pá, chapéu)
- [x] `char-reaper0`, `char-reaper1`, `char-reaper-cast` — O Ceifador (foice, também é o mercador encapuzado)
- [x] `char-vampire0`, `char-vampire1`, `char-vampire-cast` — A Vampira (sangue, vermelho)
- [ ] `altar` (40x14) — o círculo/altar embaixo do necromante na tela inicial

## 2. Mortos: seu exército

Quadros: `0` e `1` andando, `2` atacando. Olham para a direita (o jogo espelha).

- [x] `skel0..2` (16x22) — Esqueleto, com espada enferrujada. **O mais importante do jogo.** (PixelSpec em

  `art-work/skel16-v2.pixelspec.json`)
- [x] `archer0..2` (16x22) — Arqueiro de Osso (esqueleto com arco) (`art-work/archer16.pixelspec.json`)
- [x] `giant0..2` (24x28) — Colosso de Ossos (`art-work/units/make_giant.py`)
- [ ] `zombie0..2` (16x22) — Zumbi (lento, resistente)
- [ ] `ghoul0..2` (16x22) — Carniçal (rápido, curvado)
- [x] `rat0..2` (8x5) — Rato da Peste
- [x] `ghost0..2` (20x22) — Fantasma (voa)
- [ ] `thrall0..2` (16x22) — Servo de Sangue
- [ ] `lich0..2` (16x22) — Lich (mago morto, raios em área)
- [ ] `abomination0..2` (32x44) — Abominação (carne costurada, gigante)
- [ ] `plaguebearer0..2` (16x22) — Portador da Peste
- [x] `banshee0..2` (20x22) — Banshee (voa, grita)
- [ ] `bloodknight0..2` (16x22) — Cavaleiro Rubro
- [x] `corpse-bones` (16x6) — pilha de ossos que um morto deixa ao cair

## 3. Vivos: os inimigos

Todos os humanoides (vivos, zumbi, carniçal, servo, lich, portador, cavaleiro rubro, chefes e campeões) saem do
molde por camadas de `src/art/humanoid.ts`, já redesenhado na direção nova. Desenhar um à mão substitui o do molde.

Os 20 vivos humanoides (e os cadáveres deles) têm versão desenhada por código em `art-work/units/make_living.py`:
peças próprias por classe e sombreamento automático (luz de cima/esquerda, sombra fria, borda no tom mais escuro do
material). `python art-work/units/make_living.py --install` gera `vivos.png`/`.json` e registra no manifesto; a folha
de revisão sai em `art-work/units/out/living-review.png`.

Quadros: `0` e `1` andando, `2` atacando, mais o cadáver deitado (`corpse-<nome>`, 16x6). Vêm de cima e descem; olham
para a direita (o jogo espelha).

**A Vila**

- [ ] `peasant0..2` + `corpse-peasant` — Camponês (forcado)
- [ ] `torch0..2` + `corpse-torch` — Tocheiro (tocha acesa)
- [ ] `militia0..2` + `corpse-militia` — Miliciano (lança, capacete simples)
- [ ] `hunter0..2` + `corpse-hunter` — Caçador (arco)
- [x] `hound0..2` (12x8) + `corpse-hound` (12x5) — Cão de Caça

**O Mosteiro**

- [ ] `monk0..2` + `corpse-monk` — Monge (punhos)
- [ ] `priest0..2` + `corpse-priest` — Padre (cura os outros)
- [ ] `nun0..2` + `corpse-nun` — Freira (lanterna)
- [ ] `ringer0..2` + `corpse-ringer` — Sineiro (sino)
- [ ] `flagellant0..2` + `corpse-flagellant` — Flagelante (chicote, sem camisa)
- [ ] `hurler0..2` + `corpse-hurler` — Arremessador (joga os próprios aliados)

**A Fortaleza**

- [ ] `soldier0..2` + `corpse-soldier` — Soldado (espada, cota de malha)
- [ ] `crossbow0..2` + `corpse-crossbow` — Besteiro
- [ ] `shield0..2` + `corpse-shield` — Escudeiro (escudo grande)
- [ ] `knight0..2` + `corpse-knight` — Cavaleiro (armadura, investida)
- [ ] `halberd0..2` + `corpse-halberd` — Alabardeiro

**A Catedral**

- [ ] `templar0..2` + `corpse-templar` — Templário (armadura pesada, lâmina benta)
- [ ] `paladin0..2` + `corpse-paladin` — Paladino (maça, aura sagrada)
- [ ] `inquisitor0..2` + `corpse-inquisitor` — Inquisidor
- [ ] `witchhunter0..2` + `corpse-witchhunter` — Caçador de Bruxas (chapéu de aba, besta)
- [ ] `bishop0..2` + `corpse-bishop` — Bispo (mitra)

## 4. Chefes (32x44)

Quadros `0..2` como os outros. O jogo gera sozinho a versão "campeão" (`champ-<nome>0..2`, o chefe morto-vivo que
luta do seu lado); se quiser desenhar essa versão também, é a mesma chave com `champ-` na frente.

- [ ] `woodcutter0..2` — O Lenhador (Vila; machado enorme)
- [ ] `abbot0..2` — O Abade (Mosteiro)
- [ ] `commander0..2` — O Comandante (Fortaleza)
- [ ] `archbishop0..2` — O Arcebispo (Catedral)
- [ ] `seraph0..2` — O Serafim (chefe secreto do abismo; seis asas)

## 5. Cenário

Cenário, projéteis, manchas, ícones de HUD, barra de navegação, ramos da árvore e os bichos pequenos (rato, cão,
fantasma, banshee) têm versão desenhada à mão em `art-work/pixel/hand_art.py` (`python art-work/pixel/build_hand.py --install`). As gemas saem do molde `GEM_ICON` (`src/art/sprites.ts`), colorido por gema.

**Chão (180x320, um por região).** Quase preto e quase sem detalhe. Pode ser um bloco que repete (diga o tamanho).

- [ ] `ground0` — A Vila
- [ ] `ground1` — O Mosteiro
- [ ] `ground2` — A Fortaleza
- [ ] `ground3` — A Catedral

**Enfeites** (espalhados pelas bordas do campo)

- [x] `tomb` (9x10), `tomb2` (9x8) — lápides
- [x] `cross` (8x9) — cruz de túmulo
- [x] `tree` (14x12) — árvore morta
- [x] `fence` (12x7) — cerca
- [x] `candle0`, `candle1` (3x7) — vela (2 quadros de chama)
- [x] `bones` (8x4) — ossos no chão
- [x] `pillar` (7x13) — coluna (Mosteiro/Catedral)
- [x] `pew` (14x6) — banco de igreja
- [x] `wall` (12x7) — muro (Fortaleza)
- [x] `barrel` (7x7) — barril
- [x] `brazier0`, `brazier1` (7x7) — braseiro (2 quadros)
- [x] `banner0`, `banner1` (7x7) — estandarte (2 quadros)
- [x] `candelabra0`, `candelabra1` (5x9) — candelabro (2 quadros)

**Tela inicial**

- [ ] Fundo do salão do necromante (180x320): opcional, eu troco no código para usar a sua imagem

## 6. Projéteis e manchas

- [x] `arrow` (5x3) — flecha dos vivos
- [x] `boltp` (6x3) — virote de besta
- [x] `bonearrow` (5x3) — flecha de osso (seus arqueiros)
- [x] `splat` (8x5) — mancha de sangue no chão
- [x] `scorch` (8x5) — chão queimado
- [ ] `shadow` (8x3) — sombra embaixo das unidades

**Efeitos.** Desenhados à mão e instalados com `python art-work/icons/install_fx.py <pacote.zip>` (tiras em
`public/assets/fx/`, descritas em `fx.json`; o código está em `src/art/fx.ts` e `RunScene.playFx`). Sem a arte, o
jogo volta para os anéis e partículas desenhados no código.

- [x] Explosão de morto (`fx-explosao-morto`, 32x32, 6 quadros; no máximo 12 ao mesmo tempo, as demais viram anel)
- [x] Levantar do chão (`fx-levantar`, 16x16, 4 quadros)
- [x] Fusão em colosso (`fx-fusao-colosso`, 24x24, 4 quadros)
- [x] Nuvem de veneno (`fx-nuvem-veneno`, 24x24, loop de 4)
- [x] Coluna de luz do Arcebispo (`fx-coluna-luz`, 16x64, repete na altura do campo)
- [x] Grito da banshee (`fx-grito-banshee`, 32x32, loop de 4)
- [x] Raio do necromante (`fx-raio-segmento`, 8x8, repetido do cajado ao alvo)
- [x] Ritual de cada personagem (`fx-ritual-<personagem>`, 64x64, no chão embaixo das unidades)

**Efeitos das escolas (novos).** Já estão ligados no código: cada um tem um efeito feito em código, que some
quando a arte chegar. Mesmo instalador (`install_fx.py`), mesmo `fx.json`. Cor da escola, formas simples, poucos
quadros. Nada de branco puro, exceto nos brilhos.

- [ ] Ossos se juntando (`fx-ossos-juntando`, 16x16, 5 quadros): ossos soltos voando para o centro e formando uma
  pilha. Toca quando um esqueleto renasce (maestria de Ossos) e quando se remonta (Apoteose de Ossos).
- [ ] Estouro de carne (`fx-estouro-carne`, 16x16, 5 quadros): cadáver estourando em sangue e pedaços, vermelho
  `#b5525e`. Toca quando a Carne levanta alguém na hora, e em escala 2 no Banquete (Apoteose de Carne).
- [ ] Gotas de sangue (`fx-gotas-sangue`, 8x8, 4 quadros): 2 ou 3 gotas subindo e sumindo. Morto de carne
  curando ao golpear (básico de Carne).
- [ ] Gelo (`fx-gelo`, 12x12, 4 quadros): estalo de cristais azul-névoa `#8fd3ff`. Vivo atingido pelo raio
  fica lento (básico de Espírito).
- [ ] Fantasma voltando (`fx-fantasma-volta`, 16x16, 4 quadros): espiral de névoa azul subindo do chão
  (Mortalha Assombrada, Coroa Errante, Apoteose de Espírito).
- [ ] Escudo de sangue (`fx-escudo-sangue`, 32x32, loop de 4): bolha vermelho-escura em volta do necromante,
  pulsando. Aparece quando a cura passa do máximo e vira escudo (Apoteose de Sangue).
- [ ] Crítico (`fx-critico`, 16x16, 4 quadros): estalo dourado em estrela. Dano extra em elite e chefe
  (Anel do Carrasco).
- [ ] Aura de cada escola (`fx-aura-bone`, `fx-aura-flesh`, `fx-aura-plague`, `fx-aura-spirit`, `fx-aura-blood`,
  48x16, loop de 4): anel no chão embaixo do necromante, visto de cima, na cor da escola, com o motivo dela
  (ossinhos, gotas, bolhas, névoa, sangue). Aparece no domínio e cresce 25% na apoteose.
- [ ] Apoteose de cada escola (`fx-apoteose-bone`, `-flesh`, `-plague`, `-spirit`, `-blood`, 64x64, 8 quadros):
  o momento grande, centrado no necromante, quando ele chega a 6 itens de uma escola. Pode ser o efeito mais rico
  do jogo: o Rei Ossudo com uma coroa de ossos subindo, o Banquete com uma bocarra, o Paciente Zero com uma
  explosão de esporos, o Véu Rasgado com um véu se abrindo e o Lorde Vampiro com asas de sangue.

## 7. Ícones da interface

**HUD da partida**

- [x] `icon-soul` (5x6) — alma (moeda)
- [x] `icon-skull` (5x5) — caveira (tamanho do exército)
- [x] `icon-heart` (5x5) — coração (vida)
- [x] `icon-pause` (5x5) — pausa
- [x] `icon-explode` (7x7) — botão EXPLODIR
- [x] `icon-fuse` (7x7) — botão FUNDIR
- [x] `icon-consume` (7x7) — botão CONSUMIR
- [x] `icon-ritual` (11x10) — botão do ritual
- [ ] `act-round`, `act-round-ready`, `act-round-down` (22x22) — fundo redondo dos botões de ação
- [x] `icon-hand` (10x11) — mão do tutorial
- [x] `icon-lock` (5x6) — cadeado

**Barra de navegação (11x11 cada)**

- [x] `nav-home`, `nav-market`, `nav-arsenal`, `nav-tree`, `nav-altar`, `nav-hoard`, `nav-bestiary`, `nav-records`,

  `nav-options`

**Escolas (7x7)**

- [x] `school-bone`, `school-flesh`, `school-plague`, `school-spirit`, `school-blood`, `school-neutral` (versão à mão

  em `art-work/icons/art_items.py`)

**Gemas (7x7)**

- [x] `gem-ruby`, `gem-sapphire`, `gem-emerald`, `gem-amethyst`, `gem-diamond`

**Árvore da Necrópole**

- [x] `necropolis` (21x14) — a cidadela no centro do mapa (pode ter mais detalhe que o resto: é a peça central)
- [x] `b-crypt`, `b-ossuary`, `b-library`, `b-altar`, `b-bell`, `b-reliquary`, `b-hall`, `b-grave` (11x11)
- [x] (opcional) um ícone próprio para cada um dos 48 nós da árvore. Lista dos nós em `src/sim/tree.ts`.

## 8. Itens (98, 18x18)

Desenhe com **18x18**, um desenho único por item, ocupando uns 14x14 no meio. O jogo lê com `res 2` sozinho (chaves
`item-*`). Molduras de raridade (`slot-common`, `slot-magic`, `slot-rare`, `slot-epic`, `slot-legendary`, `slot-set`,
`slot-empty`, 24x24) também podem ser desenhadas.

**Entregues à mão: os 98 itens, 17 deles animados (relíquias e conjuntos), e as 7 molduras.** Instale um pacote novo com
`python art-work/icons/install_items.py <pacote.zip>`: ele gera `itens`, `itens-anim` e `molduras` em
`public/assets/sprites` e registra as três folhas no manifesto. As molduras do pacote valem mais que os cartões do kit
de interface. Item novo sem desenho aparece com o ícone do espaço, tingido pela cor do item.

**Sem escola**

- [x] `item-staff_yew` — Cajado de Teixo
- [x] `item-hood_worn` — Capuz Puído
- [x] `item-cloak_wool` — Manto de Lã
- [x] `item-amulet_tooth` — Colar de Dentes
- [x] `item-ring_iron` — Anel de Ferro
- [x] `item-ring_tomb` — Anel da Lápide
- [x] `item-amulet_digger` — Amuleto do Coveiro
- [x] `item-amulet_reliquary` — Relicário Roubado
- [x] `item-staff_grimoire` — Grimório Acorrentado

**Ossos**

- [x] `item-ring_tibia` — Anel de Tíbia
- [x] `item-hood_skull` — Elmo de Crânio
- [x] `item-staff_bone` — Cajado de Osso
- [x] `item-amulet_quiver` — Aljava de Costelas
- [x] `item-ring_bone` — Anel de Osso
- [x] `item-cloak_ossuary` — Manto do Ossário
- [x] `item-staff_lich` — Filactério
- [x] `item-amulet_ancestor` — Ossos Ancestrais

**Carne**

- [x] `item-ring_flesh` — Anel de Carne
- [x] `item-amulet_feast` — Bolsa de Vísceras
- [x] `item-cloak_flesh` — Manto de Couro Humano
- [x] `item-hood_maggot` — Capuz de Vermes
- [x] `item-amulet_ghoul` — Dente de Carniçal
- [x] `item-ring_hide` — Anel de Couro Curtido
- [x] `item-staff_stitch` — Agulha Profana

**Praga**

- [x] `item-ring_plague` — Anel da Praga
- [x] `item-ring_fever` — Anel da Febre
- [x] `item-staff_rot` — Cajado Pútrido
- [x] `item-amulet_rats` — Flauta do Ratoeiro
- [x] `item-cloak_bile` — Manto de Bile
- [x] `item-hood_plague` — Máscara da Peste
- [x] `item-ring_spores` — Anel de Esporos
- [x] `item-staff_censer` — Incensário Podre

**Espírito**

- [x] `item-ring_chains` — Elo Etéreo
- [x] `item-ring_spirit` — Anel Etéreo
- [x] `item-hood_seer` — Capuz do Vidente
- [x] `item-amulet_veil` — Véu Sepulcral
- [x] `item-staff_storm` — Cajado da Tempestade
- [x] `item-cloak_shroud` — Mortalha Assombrada
- [x] `item-hood_banshee` — Coroa de Lamentos

**Sangue**

- [x] `item-staff_thirst` — Cajado Sedento
- [x] `item-amulet_dagger` — Adaga Ritual
- [x] `item-ring_blood` — Anel de Sangue
- [x] `item-amulet_chalice` — Cálice dos Servos
- [x] `item-cloak_crimson` — Manto Rubro
- [x] `item-ring_fury` — Anel da Fúria
- [x] `item-hood_crimson` — Elmo Rubro

**Relíquias (as mais especiais)**

- [x] `item-amulet_hunger` — Coração Faminto (cai na Vila)
- [x] `item-staff_harvest` — Cajado da Colheita (cai na Vila)
- [x] `item-hood_lich` — Coroa do Lich (cai no Mosteiro)
- [x] `item-ring_rosary` — Rosário Profanado (cai no Mosteiro)
- [x] `item-cloak_reaper` — Manto do Ceifador (cai na Fortaleza)
- [x] `item-staff_banner` — Estandarte Negro (cai na Fortaleza)
- [x] `item-ring_abyss` — Anel do Abismo (cai na Catedral)
- [x] `item-hood_eye` — Olho do Abismo (cai na Catedral)

**Conjuntos (as peças de um conjunto devem parecer da mesma família)**

- [x] `item-staff_pest`, `item-hood_pest`, `item-ring_pest` — Ossos Pestilentos (osso e bolhas verdes)
- [x] `item-cloak_pact`, `item-amulet_pact`, `item-ring_pact` — Pacto Carmesim (coração costurado)
- [x] `item-staff_choir`, `item-hood_choir`, `item-cloak_choir` — Coro Fantasma (azul-névoa e fita rosa)

### 8b. Itens novos (35): para desenhar

Entregues junto com os outros. Mesmas
regras do resto: 18x18, o objeto ocupando uns 14x14 no meio, borda na cor mais escura do material (sel-out), a escola
como cor de detalhe e **nenhuma cor de raridade no desenho**. A raridade é só a moldura.

**Épicos (novo degrau, entre raro e relíquia).** Cada épico é forte, mas cobra um preço. O desenho pode mostrar essa
troca: uma rachadura, uma corrente, um pingo de sangue, algo que pareça perigoso de usar. Devem parecer mais ricos
que os raros e menos que as relíquias, que continuam sendo as únicas com brilho próprio.

- [x] `slot-epic` (24x24): moldura de raridade épica, roxa (`#b468e0`), no mesmo desenho das outras molduras

**Sem escola**

- [x] `item-cloak_digger`: Capa do Coveiro (comum). Capa curta de lona marrom, gasta, com terra na barra.
- [x] `item-staff_pilgrim`: Bordão do Peregrino (mágico). Cajado reto de madeira clara com uma cabaça amarrada no topo.
- [x] `item-cloak_looter`: Capa do Saqueador (mágico). Capa escura com bolsos costurados e uma gema aparecendo num deles.
- [x] `item-ring_miser`: Anel do Avarento (raro). Anel grosso de ouro com uma moeda no lugar da pedra.
- [x] `item-cloak_deserter`: Manto do Desertor (épico). Manto militar rasgado, com a insígnia arrancada e pendurada por um fio.
- [x] `item-amulet_coin`: Moeda do Barqueiro (épico). Moeda antiga e furada num cordão, com uma caveira gravada.

**Ossos**

- [x] `item-cloak_bones`: Capa de Ossos Soltos (comum). Capa curta com ossinhos costurados na borda.
- [x] `item-amulet_vertebrae`: Corrente de Vértebras (mágico). Colar feito de vértebras enfileiradas.
- [x] `item-hood_general`: Elmo do General (raro). Elmo de crânio com uma pluma rala e uma coroa de louros de osso.
- [x] `item-staff_ossuary`: Cetro do Rei Ossudo (épico). Cetro de fêmur com um crânio coroado no topo e uma rachadura no crânio.
- [x] `item-cloak_thousand`: Manto dos Mil Ossos (épico). Manto pesado todo coberto de ossos pequenos, como escamas.

**Carne**

- [x] `item-hood_rawhide`: Capuz de Couro Cru (comum). Capuz de couro mal curtido, com costura grossa.
- [x] `item-staff_sinew`: Cajado de Tendão (mágico). Cajado enrolado em tendões vermelhos, com um gancho na ponta.
- [x] `item-ring_tooth`: Anel de Dente (mágico). Anel de osso com um dente pontudo no lugar da pedra.
- [x] `item-hood_butcher`: Capuz do Carniceiro (raro). Capuz de carrasco de couro, com respingos de sangue.
- [x] `item-hood_glutton`: Capuz do Glutão (épico). Capuz com uma bocarra costurada na frente, cheia de dentes.
- [x] `item-cloak_slaughter`: Pele do Abatedouro (épico). Pele esticada com ganchos de açougue presos nos ombros.

**Praga**

- [x] `item-cloak_rag`: Trapo Infecto (comum). Pano rasgado, verde-amarelado, com manchas.
- [x] `item-hood_fever`: Capuz Febril (mágico). Capuz encharcado de suor, com gotas verde-claras escorrendo.
- [x] `item-cloak_flies`: Manto de Moscas (raro). Manto escuro com uma nuvem de moscas (pontinhos pretos) em volta.
- [x] `item-ring_contagion`: Anel do Contágio (épico). Anel com uma bolha verde inchada no lugar da pedra, prestes a estourar.
- [x] `item-amulet_hourglass`: Ampulheta Podre (épico). Pequena ampulheta de osso com areia verde escorrendo.

**Espírito**

- [x] `item-cloak_grey`: Capa Cinzenta (comum). Capa leve e cinza-azulada, com a barra se desfazendo em névoa.
- [x] `item-staff_medium`: Vara do Médium (mágico). Vara fina com um sininho e uma fita azul-névoa.
- [x] `item-cloak_mist`: Manto de Névoa (mágico). Manto translúcido azul-claro, com o contorno meio apagado.
- [x] `item-amulet_lantern`: Lanterna das Almas (raro). Lanterninha de ferro com uma chama azul-clara dentro.
- [x] `item-staff_echo`: Cajado do Eco (épico). Cajado com três orbes azuis empilhados, o de cima rachado.
- [x] `item-hood_wanderer`: Coroa Errante (épico). Coroa fantasma sem cabeça, flutuando, com um rastro de névoa embaixo.

**Sangue**

- [x] `item-cloak_soaked`: Manto Encharcado (comum). Manto vermelho-escuro pingando.
- [x] `item-hood_penitent`: Capuz do Penitente (comum). Capuz pontudo de pano grosso, com uma corda na gola.
- [x] `item-hood_headsman`: Capuz do Algoz (mágico). Máscara preta de carrasco com dois furos para os olhos.
- [x] `item-staff_rite`: Cetro do Rito (raro). Cetro com um cálice no topo, transbordando sangue.
- [x] `item-cloak_martyr`: Manto do Mártir (raro). Manto vermelho com uma estaca ou flecha atravessada.
- [x] `item-ring_headsman`: Anel do Carrasco (épico). Anel com um machado pequeno no lugar da pedra e um pingo de sangue.
- [x] `item-amulet_bloodvial`: Frasco de Sangue (épico). Frasco de vidro com sangue, preso por uma corrente fina.

## 9. Fonte

Hoje é uma fonte de 3x5 pixels só com maiúsculas e **sem acentos**. Ela já está na grade certa; falta acento e ar.

- [x] (acentos) Á À Â Ã É Ê Í Ó Ô Õ Ú Ç na grade 3x5 (`src/art/sprites.ts`, `ACCENTED`). Falta o espaçamento

  largo, que pede rever os textos longos.
- [ ] Fonte normal: A–Z, 0–9, `: ! . / + - ? < > ( ) % = , ' "` e **Á À Â Ã É Ê Í Ó Ô Õ Ú Ç**. Letras de 5 a 7

  px de altura (acentos acima disso). Desenhe pensando em **1 a 2 px de espaço entre letras**.
- [ ] Fonte lisa (sem sombra), usada dentro dos botões.
- [ ] (opcional) Fonte grande para títulos e números de dano (8 a 10 px de altura).

A versão larga (1 px a mais entre letras) já existe como `px-wide`: títulos de tela, cabeçalhos e rótulos de
botão que cabem. O texto corrido continua na fonte normal, para caber nos 180 px.

Formato: uma imagem com as letras em fila, todas com a mesma largura (ou me passe a largura de cada uma).
A fonte não passa pelo manifesto: me mande o arquivo e eu ligo no código.

## 10. Painéis e botões

Hoje: `panelTex` (`src/art/generate.ts`) desenha moldura em relevo, filete interno, luz pontilhada, cantoneiras e
rebites; painéis maiores que a textura usam nine-slice (a moldura não estica). Nichos do tesouro, pedestais,
encaixes de gema, palco do bestiário, linhas de registro e espaços de item têm texturas próprias.

Desenhe cada um como **9-slice** (cantos fixos, meio que estica) e me diga a largura das bordas.

**Entregue** (kit em `public/assets/ui`, bordas em `ui.json`; prévias e versões x8 em `art-work/ui-kit`).
`src/art/uikit.ts` redesenha as texturas do jogo esticando cada peça até o tamanho que a textura já tinha, então as
telas não mudaram. Peças com quadros continuam animando. Para trocar uma peça, substitua o PNG com o mesmo nome.

- [x] Painel comum (`ui-panel` → `panel`, `card`, `tile`, `item-card`)
- [x] Botão normal / apertado (`ui-btn`, `ui-btn-down` → `btn*`, `small-btn`, `arrow-btn`, `act`, `gear-btn`)
- [x] Botão principal / apertado (`ui-btn-main*` → `btn-gold*`). **Veio azul**, e a faixa do cerco e a seta também.
- [x] Botão de fechar / apertado (`ui-btn-close*` → `btn-red*`, `btn-modal-red*`, como EQUIPAR)
- [x] Botão "pronto" (`ui-btn-ready` → `btn-ready`, `act-ready`, pulsando)
- [x] Moldura da barra de navegação (`ui-nav`, `ui-nav-sel` → `subtab`, `subtab-on`, com o brilho em loop)
- [x] Cartão de item (`ui-card-*` → `slot-*`) / linha de lista (`ui-row`, `ui-row-sel` → `row`, `sel-row`)
- [x] Barra de vida (`ui-hp-*`: moldura, preenchimento, rastro de dano e o pisca da vida baixa)
- [x] Faixa de seleção de cerco (`ui-siege`, `ui-siege-hover`, com a seta `ui-chevron`)

Faltam:

- [x] Moldura épica: veio no pacote de itens (`slot-epic`). O cartão gerado do raro ficou só como reserva.
- [ ] `ui-glyph-x` ainda não é usado: os botões de fechar mostram um "x" da fonte.
- [ ] Versões do kit para as peças que ficaram no código: `card-gold` (popup do item), `box-good` / `box-bad`
  (caixas de ganho e perda), `chip-red`, `tab` / `tab-on` (abas dos registros), `row-flash`, `hud-banner`.

## 11. Para distribuir o app

Aqui a grade não vale: são imagens para loja.

- [ ] Ícone do app: 512x512 (Play Store) e o ícone adaptativo do Android (frente 432x432 com o desenho no centro,

  e o fundo separado). Desenhe pequeno e amplie por fator inteiro.
- [ ] Splash: imagem central de ~288x288 sobre fundo liso
- [ ] (Play Store) imagem de destaque 1024x500 e 2 a 8 capturas de tela

---

## Como entregar

1. No Aseprite: **File > Export Sprite Sheet**, aba Output com **JSON Data** marcado (Array ou Hash) e **Tags**
 marcado. Salve o `.png` e o `.json` em `public/assets/sprites/`.
2. Registre em `public/assets/sprites/manifest.json`:

```json
{
  "sprites": [
    { "key": "skel", "file": "esqueleto" },
    { "file": "necro", "frames": { "necro0": 0, "necro1": 1, "necro-cast": 2 } },
    { "file": "icones", "frames": { "icon-soul": 0, "icon-skull": 1, "icon-heart": 2 } }
  ]
}
```

- Unidades (`"key"`): use as tags `walk` (2 quadros) e `attack` (1 quadro); sem tags, vale a ordem 0, 1, 2.
- Qualquer outra coisa (`"frames"`): diga qual quadro vira qual chave. Dá para juntar vários ícones num arquivo só.
- Desenhe no tamanho desta lista: o jogo entende 1 pixel da arte = 1 pixel do mundo. Os itens (`item-*`, 18x18) ele
já lê com `res 2` sozinho. Se algum arquivo estiver em outra escala, ponha `"res": N` na linha dele.
- Abra o jogo: o console mostra quais texturas foram trocadas.

Pode mandar aos poucos: o que você não desenhou continua com a arte gerada.

### Arte desenhada por código

Parte da arte foi feita com as skills `codeart2d` e `generate2dsprite` (desenhada por código, sem modelo de imagem):

- Esqueleto: `art-work/skel16.pixelspec.json` (PixelSpec), exportado como `esqueleto.png`/`.json`.
- Itens e escolas: `art-work/icons/` (`art_items.py` e `designs.py`). Para refazer: `python art-work/icons/build.py --install`; a folha de revisão sai em `art-work/icons/out/review.png`.