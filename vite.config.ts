import { defineConfig } from 'vite';

export default defineConfig({
  // caminhos relativos: obrigatório para o Capacitor carregar os assets
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
});
