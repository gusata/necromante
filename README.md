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
| `npm run lint` / `npm run format` | Biome |
| `npm run build` | checa tipos e gera `dist/` |
| `npm run android` | build + sync + abre o Android Studio (precisa do Android Studio/JDK instalados) |

### Parâmetros de debug na URL

| Parâmetro | Efeito |
|---|---|
| `?run` | pula o menu |
| `?auto` | o jogo se joga sozinho (inclusive escolhe cartas) |
| `?wave=13` | começa na onda 13 (`6` = primeiro chefe, `25` = abismo) |
| `?meta=3` | finge meta-progressão nível 3 (escolas, campeões, construções). Se a run terminar, o resultado é salvo |
| `?scene=Graveyard` | abre uma cena direto (`Graveyard`, `Bestiary`, `Options`) |
| `?fps` | contador de quadros |

`window.__game` no console do navegador dá acesso ao jogo.

## Como se joga

- **Arrastar** em qualquer lugar do campo move o círculo. O movimento é relativo, então o dedo não cobre o círculo.
- O necromante lança raios em quem está no círculo. Quem morre ali **levanta** para o seu lado.
- **Explodir** (`1`/`Q`): os mortos no círculo explodem.
- **Fundir** (`2`/`W`): 3 esqueletos viram um Colosso de Ossos.
- **Consumir** (`3`/`E`): sacrifica mortos para curar.
- Entre ondas você escolhe **1 pacto** (carta). Três cartas da mesma escola liberam a **Maestria** e cinco, o **Domínio**.
- `Esc`/`P`: pausa.

### Estrutura de uma run

4 regiões com 5 ondas e 1 chefe cada (Vila, Mosteiro, Fortaleza, Catedral). Depois vêm os **círculos do abismo**, infinitos, cada um com um modificador novo. Chefes derrotados viram **campeões** que você pode levar para as próximas runs.

### Meta-progressão

As almas de cada run vão para o **Cemitério**, onde há 8 construções. Cada chefe derrotado pela primeira vez libera uma nova escola de pactos: Ossos e Carne no começo, depois Praga, Espírito e Sangue. O **Bestiário** registra os abates com medalhas de bronze, prata e ouro.

## Estrutura

```
src/
  sim/          lógica pura do jogo, sem Phaser (testável, determinística com seed)
    defs.ts       unidades, chefes e constantes de balanceamento
    cards.ts      escolas, pactos e sinergias
    regions.ts    regiões, ondas e modificadores do abismo
    meta.ts       cemitério, campeões, bestiário, save
    world.ts      a run: ondas, combate, status, habilidades, ações do jogador
    autopilot.ts  jogador automático (debug e simulador)
  art/          pixel art gerada em código: paleta, mapas de pixels, gerador de humanoides, upscale 2x
  audio/        efeitos e trilha sintetizados (WebAudio)
  fx/           juice: tremor, hitstop, flashes, transições, estilhaçar sprites, botões
  scenes/       Boot, Menu, Cemitério, Bestiário, Opções, Run
  platform/     save (Capacitor Preferences) e vibração (Capacitor Haptics)
scripts/        simulador de balanceamento
tests/          testes da simulação
android/        projeto nativo gerado pelo Capacitor
```

## Arte do Aseprite

Exporte do Aseprite (File > Export Sprite Sheet, JSON com Tags) para `public/assets/sprites/` e registre no `manifest.json`. A arte exportada substitui a gerada, com as mesmas chaves (`peasant0`, `peasant1`...). Unidades usam as tags `walk` (2 quadros) e `attack` (1 quadro). Veja `src/art/aseprite.ts` e o exemplo em `docs/exemplo-aseprite/`.

Para ajustar a dificuldade, mexa em `src/sim/defs.ts` e `src/sim/regions.ts`, depois rode `npm run sim`. Para criar um inimigo, adicione o tipo em `types.ts`, os números em `defs.ts`, a aparência em `art/humanoid.ts` (`HUMANOIDS`) e o lugar dele em `regions.ts`.
