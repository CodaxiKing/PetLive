import { defineConfig } from 'vitest/config';

// Testes dos cálculos e regras puras (BUSINESS.md 24: "teste automatizado
// dos cálculos"). Telas e fluxos ficam nos testes E2E do Maestro (maestro/).
export default defineConfig({
  // O tsconfig do app herda de expo/tsconfig.base, que o compilador do Vite
  // não resolve; os testes não precisam de nenhuma opção dele.
  oxc: { tsconfig: false },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Datas no fuso do Brasil, como no aparelho do tutor.
    env: { TZ: 'America/Sao_Paulo' },
  },
});
