import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  return {
    plugins: [react(), tailwindcss(), vanillaExtractPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@calc': path.resolve(__dirname, './src/systems/calculadora-rescisao'),
        '@suporte': path.resolve(__dirname, './src/systems/central-suporte'),
        '@ferias': path.resolve(__dirname, './src/systems/agendamento-ferias'),
        '@ponto': path.resolve(__dirname, './src/systems/processar-ponto'),
        '@obrigacoes': path.resolve(__dirname, './src/systems/obrigacoes'),
        '@adiantamento': path.resolve(__dirname, './src/systems/calculo-adiantamento'),
        '@aeronord': path.resolve(__dirname, './src/systems/aeronord'),
        '@comissao': path.resolve(__dirname, './src/systems/calculo-comissao'),
        '@pontoadmin': path.resolve(__dirname, './src/systems/ponto-admin'),
        '@guiadp': path.resolve(__dirname, './src/systems/guia-dp'),
        '@fiscal': path.resolve(__dirname, './src/systems/conciliacao-fiscal'),
        '@abertura': path.resolve(__dirname, './src/systems/abertura-empresa'),
        '@copilot': path.resolve(__dirname, './src/systems/copilot-contabil'),
        '@bimg': path.resolve(__dirname, './src/systems/bimg'),
        '@contai': path.resolve(__dirname, './src/systems/contai'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          // Sobrescrevível via VITE_API_PROXY_TARGET no .env.local (dev)
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
  }
})
