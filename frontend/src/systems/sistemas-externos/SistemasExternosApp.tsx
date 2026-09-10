import { ExternalLink } from 'lucide-react'

// Hub de links pros sistemas externos (de terceiros) que o escritório usa.
// Não é uma migração — é uma página nativa simples (setor GERAL, todos veem)
// que centraliza os acessos. Cada card abre em nova aba: Google/G-Click/SIEG
// e outros bloqueiam iframe (X-Frame-Options), então embutir não funciona.
//
// Pra adicionar/remover um sistema, edite só a lista abaixo.

interface SistemaExterno {
  nome: string
  url: string
  descricao: string
  grupo: string
  /** cor de destaque do selo (iniciais) */
  cor: string
}

const SISTEMAS: SistemaExterno[] = [
  { nome: 'Domínio Web', url: 'https://dominioweb.com.br/', descricao: 'Sistema Domínio — contábil, fiscal e folha', grupo: 'Contábil / Fiscal', cor: '#1f9d55' },
  { nome: 'Onvio', url: 'https://onvio.com.br/', descricao: 'Portal Onvio (Thomson Reuters)', grupo: 'Contábil / Fiscal', cor: '#e8590c' },
  { nome: 'SIEG Hub', url: 'https://www.sieg.com/hub/', descricao: 'Captura e gestão de XML de notas fiscais', grupo: 'Contábil / Fiscal', cor: '#1c7ed6' },
  { nome: 'Portal Veri', url: 'https://07478950000175.portal-veri.com.br/', descricao: 'Portal Veri', grupo: 'Contábil / Fiscal', cor: '#7048e8' },
  { nome: 'CertiSeguro', url: 'http://certiseguro.com.br/', descricao: 'Gestão de certificados digitais', grupo: 'Certificados', cor: '#0ca678' },
  { nome: 'ZapContábil', url: 'https://mendoncagalvao.zapcontabil.chat/tickets', descricao: 'Chamados e atendimento ao cliente', grupo: 'Atendimento', cor: '#25d366' },
  { nome: 'G-Click', url: 'https://appp.gclick.com.br/', descricao: 'Gestão de tarefas e processos', grupo: 'Produtividade', cor: '#d6336c' },
  { nome: 'Google', url: 'https://accounts.google.com/login?hl=pt-br', descricao: 'Conta Google / Workspace', grupo: 'Produtividade', cor: '#4285f4' },
]

const GRUPOS = [...new Set(SISTEMAS.map((s) => s.grupo))]

function iniciais(nome: string): string {
  const p = nome.replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/)
  return (p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function SistemasExternosApp() {
  return (
    <div className="mx-auto max-w-5xl p-5 lg:p-6">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">Sistemas Externos</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Acesso rápido aos sistemas de terceiros usados pelo escritório. Cada link abre em uma nova aba.
        </p>
      </header>

      {GRUPOS.map((grupo) => (
        <section key={grupo} className="mb-7">
          <h2 className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.06em] text-text-muted">
            {grupo}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SISTEMAS.filter((s) => s.grupo === grupo).map((f) => (
              <a
                key={f.url}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-gold-border hover:bg-surface-hover"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold uppercase text-white"
                  style={{ backgroundColor: f.cor }}
                >
                  {iniciais(f.nome)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-semibold text-text-primary">{f.nome}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-text-secondary">{f.descricao}</span>
                  <span className="mt-1 block truncate text-[11px] text-text-muted">{hostname(f.url)}</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
