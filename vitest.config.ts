import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    // Ignora cópias do projeto em worktrees de agente (.claude/worktrees/*): elas
    // duplicam os arquivos de teste e podem estar em estados divergentes/parciais,
    // poluindo o run. O repo principal é a única fonte da verdade dos testes.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/worktrees/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
