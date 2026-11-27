# Guia de estilo

## Tom

Escuro, frio, silencioso. O cemitério é quase preto; a luz conta a história. O verde-alma é a cor do jogador: tudo que é do necromante brilha verde. O dourado é a cor do sagrado (os inimigos). O vermelho é sangue e perigo.

## Resolução e escala

- Tela de **360×640** (retrato); o mundo continua em **180×320** e a câmera usa zoom 2. Toda arte usa uma grade só: 1 pixel da arte = 1 pixel do mundo (veja `docs/ARTE.md`, que tem a direção de arte completa).
- Nada de rotação ou escala fracionária em sprites parados. Exceções permitidas, por serem rápidas: queda ao morrer, pulo ao levantar e esticar/achatar ao levar dano.
- Posições sempre arredondadas para o pixel inteiro (`Math.round`).

## Paleta

Definida em `src/art/palette.ts`, uma letra por cor. As principais:

| Uso | Cor |
|---|---|
| contorno | `#07050b` |
| manto do necromante | `#2e1d3b` / `#4c2f61` |
| alma (jogador) | `#38b46a` / `#aef5bf` |
| osso | `#e3dccb` / `#a49c86` |
| sangue | `#5a0f1d` / `#9e2236` |
| sagrado | `#c9a23a` / `#f6cf6a` |
| chão | `#110e16` a `#302939` |

Cores de humanoides (roupas, cabelo) ficam no mapa de cada spec em `src/art/humanoid.ts`.

### Interface

Tema quente, definido em `UI` (`src/art/palette.ts`): fundo `#14100c`, painéis `#1f1712` com moldura `#4a3524`, ouro `#e0b040`. Texto principal creme (`u`, `#f2e3c6`), secundário (`v`, `#a89078`) e ouro claro (`U`, `#f0c050`). Todo painel e botão sai de `panelTex`, no desenho liso do King Dies Rich: borda escura de 1 px, moldura de 1 px na cor do papel (dourada = ativo/destaque, marrom apagado = resto), miolo chapado, cantos cortados, sem rebites nem pontilhado. Botões têm uma beirada escura de 2 px embaixo que some ao apertar. Espaços de item: moldura e fundo tingidos pela raridade, com o ícone da escola no canto de cima. O botão principal é dourado (`btn-gold`) e usa a fonte sem sombra (`px-flat`) com texto marrom-escuro.

Fonte: **Tiny5** (texto) e **Tiny5 Duo** (títulos e botões, `wide = true`), de Stefan Schmidt, licença SIL OFL 1.1 (`public/assets/fonts/Tiny5-OFL.txt`). Maiúsculas de 5 px, minúsculas e acentos completos. Os glifos ficam em `src/art/fontData.ts`, gerado por `python scripts/fonts/build_font.py` a partir dos BDF em `scripts/fonts/`. Escreva os textos em minúsculas: `pxText` põe maiúscula só no começo; listas em várias linhas usam `cap` em cada item. Títulos e botões continuam em MAIÚSCULAS.

Navegação fora da partida (`src/scenes/nav.ts`):

- **Cabeçalho** (y 0–16): nome da aba à esquerda, almas e a engrenagem das opções à direita.
- **Sub-abas** (y 19–33): só quando a aba junta mais de uma tela (PODER: arsenal, árvore e altar; COLEÇÃO: tesouro e bestiário). Use `nav.top` para saber onde o conteúdo começa.
- **Barra de abas** (y 290–320): INÍCIO, MERCADO, PODER, COLEÇÃO e FEITOS, ao alcance do polegar. A aba ativa tem filete dourado em cima. Nenhum conteúdo passa de `TABBAR_Y` (290); listas compridas rolam com o dedo.

### Aliados e regiões

- Todo morto ganha uma borda de 1px em `#2f9a5c` (`ALLY_RIM`), aplicada depois de gerar as texturas.
- O chão (`GROUND_STYLES`) e a escuridão (`REGION_DARK`) de cada região têm uma cor dominante.

## Tamanhos

| Tipo | Tamanho | Como |
|---|---|---|
| humanoides (vivos, zumbis, servos, liches...) | 16×22 | gerador por camadas (`humanoid.ts`): cabeça nas linhas 0–8 (olhos na 5), tronco 9–16, pernas 17–21, arma na coluna 13 |
| esqueleto e arqueiro | 16×22 | desenho à mão (`sprites.ts`) |
| fantasma e banshee | 20×22 | desenho à mão 10×11 ampliado 2x |
| rato, cão | 8×5, 12×8 | desenho à mão |
| necromante e personagens | 32×38 | desenho à mão 16×19 ampliado 2x: maior que os bichos, como protagonista |
| colosso | 24×28 | esqueleto compacto 12×14 ampliado 2x |
| chefes, campeões e abominação | 32×44 | humanoide 16×22 ampliado 2x com refinamento (`upscale`) |

Na simulação, o raio de colisão das unidades é multiplicado por `SIZE_SCALE` (1,3) e raios e flechas miram em `BODY_MID` (10px acima dos pés), para casar com o tamanho dos sprites.
| ícones | 5×5 a 11×11 | desenho à mão |

## Contorno e luz

- Arte gerada em código: contorno de 1px em `k` em tudo que é personagem ou objeto.
- Direção nova (docs/ARTE.md): sem contorno preto; a borda é o tom mais escuro do próprio material, no lado da
  sombra. A arte gerada vai sendo trocada aos poucos.
- No upscale 2x, o contorno duplo é afinado para 1px e as bordas ganham luz em cima e sombra embaixo/direita, para não parecer "pixel gordo".

## Animação

- Andar: 2 quadros. Atacar: 1 quadro (arma avança 1px) e um avanço de 2–3px na direção do alvo.
- Morrer (vivos): o sprite tomba 90° e some; o cadáver aparece por baixo.
- Morrer (mortos): achata e espalha ossos.
- Levantar: o esqueleto "sobe da terra" (recorte de baixo para cima), piscando em verde.

## Luz

Uma camada de escuridão cobre o campo; as fontes de luz abrem buracos com bordas pontilhadas (dither). Fontes: cajado, círculo, velas, braseiros, candelabros, vitrais, tochas dos tocheiros, explosões e magias.

## Juice

| Evento | Tremor | Hitstop | Flash | Vibração |
|---|---|---|---|---|
| levantar | leve | não | não | leve |
| explodir | médio + empurrão | 45ms | branco | forte |
| fundir | médio | 70ms | não | forte |
| necromante ferido | médio + empurrão | 35ms | vermelho no sprite | forte |
| golpe de chefe | forte | 50–70ms | branco/dourado | forte |
| morte de chefe | máximo | 120ms + câmera lenta | branco | 3 batidas |
| sinergia | forte | não | cor da escola | forte |

O tremor usa "trauma": impactos somam, o deslocamento é trauma² e é sempre inteiro. O jogador pode reduzir ou desligar o tremor e a vibração nas opções.
