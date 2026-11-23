# Guia de estilo

## Tom

Escuro, frio, silencioso. O cemitério é quase preto; a luz conta a história. O verde-alma é a cor do jogador: tudo que é do necromante brilha verde. O dourado é a cor do sagrado (os inimigos). O vermelho é sangue e perigo.

## Resolução e escala

- Tela base: **180×320** (retrato). O Phaser escala para a tela com `pixelArt: true` (sem suavização).
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

## Tamanhos

| Tipo | Tamanho | Como |
|---|---|---|
| humanoides (vivos, zumbis, servos) | 12×14 | gerador por camadas (`humanoid.ts`) |
| esqueleto, fantasma | 10–12×12 | desenho à mão (`sprites.ts`) |
| rato, cão | 8×5, 12×8 | desenho à mão |
| necromante | 16×19 | desenho à mão, 3 quadros |
| chefes e colosso | 24×28 | humanoide ampliado 2x com refinamento (`upscale`) |
| ícones | 5×5 a 11×11 | desenho à mão |

## Contorno e luz

- Contorno de 1px em `k` em tudo que é personagem ou objeto.
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
