# Necromante

Roguelite de defesa em pixel art. O necromante não sai do altar: você arrasta o círculo, quem morre dentro dele levanta como esqueleto, e o exército é escudo, munição e pontuação ao mesmo tempo. Veja o [ROADMAP](ROADMAP.md).

Stack: TypeScript + Phaser 3 + Vite, empacotado com Capacitor.

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
| `npm run build` | checa tipos e gera `dist/` |
| `npm run android` | build + sync + abre o Android Studio (precisa do Android Studio/JDK instalados) |

### Parâmetros de debug na URL

- `?run`: pula o menu
- `?auto`: o círculo se move e usa as ações sozinho
- `window.__game` no console do navegador dá acesso ao jogo

## Controles

- **Arrastar** em qualquer lugar do campo: move o círculo (movimento relativo, o dedo não cobre o círculo)
- **Explodir** (`1`/`Q`): todos os mortos no círculo explodem
- **Fundir** (`2`/`W`): 3 esqueletos no círculo viram um Colosso de Ossos
- **Consumir** (`3`/`E`): sacrifica até 3 mortos do círculo para curar
- `Esc`: volta ao menu

## Estrutura

```
src/
  sim/       lógica pura do jogo, sem Phaser (testável, determinística com seed)
    defs.ts    TODOS os números de balanceamento
    world.ts   estado da run, ondas, combate, ações do jogador
  art/       pixel art gerada em código (paleta + mapas de pixels + fonte 3x5)
  scenes/    Boot, Menu, Run (desenha o estado da sim e os efeitos)
  platform/  save e vibração
tests/       testes da simulação
android/     projeto nativo gerado pelo Capacitor
```

Para ajustar a dificuldade, mexa em `src/sim/defs.ts`. Para mudar um sprite, edite o mapa de pixels em `src/art/sprites.ts` (cada letra é uma cor de `src/art/palette.ts`).
