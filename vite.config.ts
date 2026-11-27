/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import pkg from './package.json';

export default defineConfig({
  // caminhos relativos: obrigatório para o Capacitor carregar os assets
  base: './',
  // versão que vai junto de cada registro da telemetria
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { chunkSizeWarningLimit: 2000 },
  // os testes simulam runs inteiras: o limite padrão de 5s estoura em máquina ocupada
  test: { testTimeout: 20000 },
});
