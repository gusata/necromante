# Roadmap: Necromante (nome provisório)

Roguelite de defesa em pixel art para celular. O necromante fica parado no altar, os vivos atacam em ondas e o jogador posiciona um círculo onde quer que os inimigos morram. Os mortos são levantados como exército, e esse exército é ao mesmo tempo **escudo**, **munição** e **pontuação**.

> Pergunta central de design: **seguro a linha ou gasto meus mortos agora?**
> Se essa tensão não for divertida no protótipo, nada além dela importa.

---

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Linguagem | **TypeScript** (strict) | definido |
| Empacotamento mobile | **Capacitor** (Android primeiro, iOS depois) | definido |
| Engine 2D | **Phaser 3** | maduro, TS nativo, `pixelArt: true`, câmera, tweens, partículas, atlas |
| Build/dev server | **Vite** | HMR rápido, template oficial Phaser + Vite + TS |
| Testes | **Vitest** | testar a simulação (combate, sinergias, economia) sem renderizar |
| Arte | **Aseprite**, exportando spritesheet + JSON | padrão para pixel art, Phaser lê o JSON direto |
| Áudio | Phaser Sound (Web Audio) | SFX curtos + música em loop |
| Plugins Capacitor | `@capacitor/preferences`, `@capacitor/haptics`, `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/screen-orientation` | save, vibração, pausa ao minimizar, tela cheia, travar orientação |
| Lint/format | ESLint + Prettier | |

**Alternativas, caso o Phaser atrapalhe:** PixiJS (só renderização, você monta o resto) ou Excalibur (TS-first, mas com comunidade menor).

### Decisões técnicas que valem desde o dia 1

- **Resolução base fixa e escala inteira.** A sugestão é **180×320 retrato** (9:16), escalada em múltiplos inteiros (×4 = 720×1280, ×6 = 1080×1920) com letterbox. Isso garante pixel art sem borrão.
- **Retrato e uma mão só.** O necromante fica embaixo, os vivos vêm de cima e o polegar arrasta o círculo.
- **Simulação separada da renderização.** Lógica de jogo em TS puro (`src/sim`), cenas do Phaser só desenham. Isso permite testar com Vitest e mais tarde validar rankings rodando a run no servidor, como faz o King Dies Rich.
- **Passo fixo + RNG com seed.** A mesma seed com os mesmos inputs gera a mesma run. Facilita depurar e balancear.
- **Conteúdo orientado a dados.** Unidades, inimigos, escolas e itens definidos em arquivos `.ts`/`.json`, nunca espalhados pelo código.
- **Nada de física pesada.** Centenas de unidades pedem movimento próprio + **grade espacial** (spatial hash) para colisão e busca de alvo, e **object pooling** para unidades, projéteis e partículas.

### Estrutura de pastas sugerida

```
src/
  main.ts              # boot do Phaser
  config.ts            # resolução, escala, constantes
  sim/                 # lógica pura (sem Phaser)
    world.ts           # estado da run, passo fixo
    rng.ts             # RNG com seed
    spatial.ts         # grade espacial
    combat.ts
    army.ts            # levantar, fundir, explodir, consumir
    waves.ts
    synergies.ts       # contagem de escolas e limiares 3/5
  data/                # conteúdo
    units.ts  enemies.ts  schools.ts  items.ts  bosses.ts  buildings.ts
  scenes/              # Boot, Preload, Menu, Run, Graveyard (meta), GameOver
  render/              # sprites, animações, VFX, juice
  ui/                  # HUD, cartas de escolha, menus
  platform/            # wrappers do Capacitor (save, haptics, ciclo de vida)
  meta/                # progressão persistente, campeões, save/migração
assets/                # .aseprite fonte + exports
tests/
```

---

## Fases

As estimativas consideram **uma pessoa em meio período**. Cada fase só termina quando o critério de saída é cumprido.

### Fase 0: Fundação (1 semana)

- [x] Projeto Vite + TS + Phaser rodando no navegador
- [x] Config pixel art: 180×320, `pixelArt: true`, letterbox (escala FIT; escala inteira fica pendente)
- [ ] Capacitor + Android rodando num **celular real** (APK de debug gera com `gradlew assembleDebug`; ainda não testado em aparelho)
- [x] Laço de passo fixo, RNG com seed, Vitest
- [x] ESLint/Prettier (feito com Biome: o typescript-eslint ainda não suporta o TypeScript 7)
- [x] Contador de FPS em modo debug (`?fps`)

**Critério de saída:** um quadrado colorido arrastável a 60 fps num Android intermediário, com pixels nítidos.

### Fase 1: Protótipo do núcleo, em greybox (2–3 semanas)

Formas geométricas apenas. Nenhuma arte até aqui.

- [x] Necromante fixo com vida; derrota quando os vivos chegam até ele
- [x] Círculo arrastável; o necromante ataca sozinho dentro dele
- [x] Ondas com camponês, soldado (onda 3+) e padre (onda 4+, cura e não pode ser levantado)
- [x] Inimigo morto deixa **cadáver**; cadáver no círculo é **levantado** como esqueleto
- [x] Esqueletos andam até os vivos e lutam (colisão O(n²); grade espacial pendente)
- [x] Limite de exército (almas/mana) para forçar escolhas
- [x] **Gastar mortos:** explodir, fundir 3 em 1 e consumir para curar
- [x] Fim de onda: sobreviventes viram almas (pontuação)

**Critério de saída:** 5 pessoas jogam 10 minutos cada e ficam em dúvida entre segurar e gastar. Se ninguém gasta, ou se todos sempre gastam, ajustar antes de seguir.

### Fase 2: Sinergias (3–4 semanas)

- [x] Sistema de escolas orientado a dados: tags, contagem e limiares **3 (Maestria)** e **5 (Domínio)**
- [x] Escolhas durante a run: entre as ondas, escolher 1 de 3 cartas (unidades, relíquias, feitiços)
- [x] Duas escolas completas primeiro: **Ossos** e **Carne**
- [x] Depois as outras três: **Praga**, **Espírito**, **Sangue**
- [x] Interações entre escolas (ex.: Praga + Carne = infecção em cadeia)
- [x] Ferramenta de debug: forçar build, pular onda, simular N runs sem renderizar (`?wave=N`, `?meta=N`, `?auto` e `npm run sim`)

**Critério de saída:** pelo menos 3 builds claramente diferentes que vencem a mesma onda difícil.

### Fase 3: Inimigos e chefes (2–3 semanas)

- [x] Inimigos que obrigam a adaptar a build: (20 inimigos no total)
  - Padre: cura os vivos e bane mortos em área
  - Paladino: o que ele mata não pode ser levantado
  - Caçador de bruxas: ignora o exército e vai direto no necromante
  - Camponês com tocha: queima cadáveres no chão
- [x] Primeiro chefe com padrão legível (4 chefes com ataques telegrafados)
- [x] **Levantar o chefe como campeão** depois de vencer
- [x] Ondas com orçamento de ameaça (custo por inimigo e curva de dificuldade)

**Critério de saída:** a primeira região (ondas + chefe) completa e jogável do começo ao fim.

### Fase 4: Meta-progressão (2–3 semanas)

- [x] Save local (Capacitor Preferences) com **versão + migração**
- [x] **Cemitério** como base: construções compradas com almas, em ramos como Criptas (exército), Ossuário (fusões), Altar de Sangue (sacrifício), Torre do Sino (ondas e recompensas) (8 construções)
- [x] Campeões persistentes; chefe repetido = campeão sobe de rank
- [x] Desbloqueio gradual de escolas, unidades e regiões (uma escola nova por chefe derrotado)
- [x] Bestiário com molduras bronze/prata/ouro por abates

**Critério de saída:** a vontade de jogar "só mais uma run" para comprar a próxima construção.

### Fase 5: Arte e juice (3–5 semanas, pode correr em paralelo às fases 3 e 4)

- [x] Guia de estilo: paleta fixa (16–32 cores), tamanhos de sprite (unidades 16×16, chefes 32×32 ou 48×48), contorno ([docs/ESTILO.md](docs/ESTILO.md))
- [x] Pipeline Aseprite → spritesheet + JSON (`public/assets/sprites/manifest.json` substitui a arte gerada; exemplo em `docs/exemplo-aseprite/`)
- [x] Animações: andar, atacar, morrer, **levantar** (a animação mais importante do jogo)
- [x] Juice: hitstop, tremor de tela, números de dano, flash ao acertar, partículas de alma, vibração
- [x] Cenários e UI em pixel art, fonte bitmap
- [x] SFX e música (sintetizados com WebAudio, sem arquivos)

**Critério de saída:** um gif de 10 segundos do jogo que dê vontade de baixar.

### Fase 6: Conteúdo (4–6 semanas)

- [x] 4 regiões com chefe cada (ex.: Vila, Mosteiro, Fortaleza, Catedral)
- [x] **Modo infinito** depois da última região, com modificadores crescentes
- [x] 5 escolas completas, cerca de 20 inimigos, cerca de 40 itens/relíquias (44 pactos)
- [x] Balanceamento com o simulador sem renderização (taxa de vitória por build: `npm run sim -- 16 2 builds`)

### Fase 7: Polimento mobile (2–3 semanas)

- [ ] Orçamento de performance: **60 fps com 300 unidades** num Android intermediário
- [ ] Pausar e salvar ao minimizar (`@capacitor/app`), retomar a run no meio
- [ ] Safe areas (notch), tela cheia, orientação travada
- [ ] Tutorial curto dentro da primeira run, sem tela de texto
- [ ] Localização PT-BR + EN desde o começo (textos fora do código)
- [ ] Ícone, splash screen, tamanho do APK/AAB

### Fase 8: Lançamento (2–4 semanas)

- [ ] Analytics mínimo: onde os jogadores morrem, que builds escolhem, duração das runs
- [ ] Teste fechado na Play Store (conta pessoal nova exige um período com testadores antes da produção; conferir as regras atuais)
- [ ] Decidir a monetização (ver abaixo)
- [ ] Página na loja: gif, screenshots, descrição
- [ ] Lançamento Android → feedback → iOS
- [ ] Opcional: versão web (o mesmo código, sem Capacitor) como demo

---

## Depois do lançamento

- Ranking semanal com seed fixa (todo mundo joga a mesma run), validado no servidor
- Novas escolas e regiões como atualizações
- Desafios diários com modificadores
- Steam (empacotar com Electron ou Tauri)

## Decisões em aberto

- **Nome do jogo**
- **Monetização:** prêmio pago, grátis com anúncios recompensados (ex.: reviver uma vez) ou grátis + passe de temporada. Seja qual for, **sem pay-to-win e sem loot box**, como o King Dies Rich.
- **Retrato ou paisagem:** retrato é a sugestão para jogar com uma mão.
- **Escolha durante a run:** cartas entre ondas (estilo Vampire Survivors) ou loot que cai dos inimigos (estilo King Dies Rich). Dá para testar as duas na Fase 2.

## Riscos

| Risco | Mitigação |
|---|---|
| A tensão entre segurar e gastar não diverte | ela é o único foco da Fase 1; não avançar sem validar |
| Performance com centenas de unidades no WebView | grade espacial, pooling, atlas único, testar no celular desde a Fase 0 |
| Escopo de arte grande demais para uma pessoa | sprites pequenos (16×16), paleta fixa, pacotes de assets como placeholder |
| Uma build domina todas | simulador de balanceamento + analytics |
| Save corrompido / mudança de formato | save versionado com migrações e testes |
