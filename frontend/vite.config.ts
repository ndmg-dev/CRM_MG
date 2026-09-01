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
        '@dashdre': path.resolve(__dirname, './src/systems/dashboard-dre'),
        '@bimg': path.resolve(__dirname, './src/systems/bimg'),
        '@contai': path.resolve(__dirname, './src/systems/contai'),
        '@mgprospect': path.resolve(__dirname, './src/systems/mg-prospect'),
        '@ouvidoria': path.resolve(__dirname, './src/systems/ouvidoria'),
        '@fronteira': path.resolve(__dirname, './src/systems/fronteira'),
        // Nomes distintos de propósito: o CRM já tem @mg/ui e @mg/tokens
        // como pacotes npm de verdade (packages/@mg/ui, packages/@mg/tokens,
        // ver package.json "workspaces") usados por outra funcionalidade
        // (UsersTable). O design system vendorizado do Fronteira v8 é uma
        // cópia própria dele (mesma origem — ESPECIFICACOES_MG — mas talvez
        // não a mesma versão), então usa um alias que nunca colide com o
        // pacote real.
        '@fronteira-tokens': path.resolve(__dirname, './src/systems/fronteira/packages/@mg-tokens'),
        '@fronteira-ui': path.resolve(__dirname, './src/systems/fronteira/packages/@mg-ui'),
        '@carneleao': path.resolve(__dirname, './src/systems/carne-leao'),
        '@doccontabil': path.resolve(__dirname, './src/systems/documentacao-contabil'),
        '@cnpj': path.resolve(__dirname, './src/systems/consulta-cnpj'),
        '@taskflow': path.resolve(__dirname, './src/systems/taskflow'),
        '@analyticsdp': path.resolve(__dirname, './src/systems/analytics-dp'),
        '@dashrh': path.resolve(__dirname, './src/systems/dash-rh'),
        '@vpsmonitor': path.resolve(__dirname, './src/systems/vps-monitor'),
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
