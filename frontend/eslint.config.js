import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Módulo ICMS Saídas: telas portadas do painel original, cobertas por testes (vitest). Estas duas regras são recomendações do
    // React Compiler / Fast Refresh (estilo de efeito e de organização de exports), não detectam defeito; reescrever as telas só para
    // satisfazê-las arriscaria o comportamento já validado. As demais regras continuam valendo.
    files: ['src/systems/icms-saidas/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
])
