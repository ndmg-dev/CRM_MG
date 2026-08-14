import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../integrations/supabase/client'
import { nomeSeguro, validarArquivo } from '../lib/arquivo'
import type { EntregaLinha, PainelResumo } from '../types'

const BUCKET = 'obrigacoes-documentos'

function erro(msg: string, e: { message: string } | null): void {
  if (e) throw new Error(`${msg}: ${e.message}`)
}

export interface Documento {
  id: string
  nome_arquivo: string
  mime: string
  bytes: number
  origem: 'ESCRITORIO' | 'PORTAL_CLIENTE' | 'RECIBO_AUTOMATICO'
  storage_path: string
  criado_em: string
  entrega_id: string | null
}

export interface PoliticaVigente {
  id: string
  versao: string
  texto: string
  publicada_em: string
}

/**
 * Camada de dados do portal.
 *
 * Nenhuma chamada informa `empresa_id`: a empresa vem do JWT e o RLS aplica.
 * Um portal que aceitasse empresa por parâmetro seria um seletor de empresa
 * para qualquer cliente curioso.
 */

// ------------------------------------------------------------- identidade

export function usePortalAcesso() {
  return useQuery({
    queryKey: ['portal', 'acesso'],
    queryFn: async () => {
      const { data: sessao } = await supabase.auth.getSession()
      if (!sessao.session) return null

      const { data, error } = await supabase
        .from('portal_acesso')
        .select('id, nome, email, empresa_id')
        .eq('auth_user_id', sessao.session.user.id)
        .maybeSingle()
      erro('Falha ao identificar o acesso', error)
      return data
    },
  })
}

export function useMinhaEmpresa() {
  return useQuery({
    queryKey: ['portal', 'empresa'],
    queryFn: async () => {
      // Sem `.eq('id', ...)`: o RLS já reduz a tabela à empresa do JWT.
      const { data, error } = await supabase
        .from('empresa')
        .select('id, razao_social, nome_fantasia, cnpj, regime')
        .maybeSingle()
      erro('Falha ao carregar os dados da empresa', error)
      return data
    },
  })
}

// ------------------------------------------------------------- política

export function usePoliticaVigente() {
  return useQuery<PoliticaVigente | null>({
    queryKey: ['portal', 'politica'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('politica_vigente').maybeSingle()
      erro('Falha ao carregar a política de privacidade', error)
      return (data as PoliticaVigente) ?? null
    },
  })
}

export function useMeusAceites() {
  return useQuery({
    queryKey: ['portal', 'aceites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_aceite_politica')
        .select('versao_politica, aceito_em')
      erro('Falha ao verificar o aceite', error)
      return (data ?? []) as { versao_politica: string; aceito_em: string }[]
    },
  })
}

export function useRegistrarAceite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { acessoId: string; politica: PoliticaVigente }) => {
      const { data: sessao } = await supabase.auth.getSession()
      const tenantId = (sessao.session?.user.app_metadata as Record<string, unknown>)?.tenant_id
      if (typeof tenantId !== 'string') throw new Error('Sessão inválida.')

      // Grava a versão E o id da política: renomear uma versão depois não pode
      // desfazer a prova de qual texto foi aceito.
      const { error } = await supabase.from('portal_aceite_politica').insert({
        tenant_id: tenantId,
        portal_acesso_id: p.acessoId,
        versao_politica: p.politica.versao,
        politica_id: p.politica.id,
      })
      erro('Falha ao registrar o aceite', error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'aceites'] }),
  })
}

// ------------------------------------------------------------- obrigações

export function useMinhasObrigacoes(competencia: string) {
  return useQuery({
    queryKey: ['portal', 'obrigacoes', competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entrega')
        .select(
          `id, competencia, vencimento, status, origem_baixa, anexo_nome,
           empresa:empresa_id ( id, razao_social, nome_fantasia, cnpj ),
           obrigacao:obrigacao_id ( id, codigo, nome, departamento ),
           responsavel:responsavel_id ( id, nome )`,
        )
        .eq('competencia', competencia)
        .order('vencimento')
      erro('Falha ao carregar suas obrigações', error)
      return (data ?? []) as unknown as EntregaLinha[]
    },
  })
}

export function useResumoPortal(competencia: string) {
  return useQuery<PainelResumo>({
    queryKey: ['portal', 'resumo', competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('painel_resumo', { p_competencia: competencia })
        .single()
      erro('Falha ao carregar o resumo', error)
      return data as PainelResumo
    },
  })
}

// ------------------------------------------------------------- documentos

export function useMeusDocumentos() {
  return useQuery<Documento[]>({
    queryKey: ['portal', 'documentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documento')
        .select('id, nome_arquivo, mime, bytes, origem, storage_path, criado_em, entrega_id')
        .order('criado_em', { ascending: false })
      erro('Falha ao carregar documentos', error)
      return (data ?? []) as Documento[]
    },
  })
}

/**
 * Download por URL assinada de curta duração.
 *
 * O bucket é privado: não existe URL permanente. A assinatura vale 60s — o
 * suficiente para o navegador iniciar o download, curto demais para virar
 * link compartilhável.
 */
export function useBaixarDocumento() {
  return useMutation({
    mutationFn: async (doc: Documento) => {
      if (!doc.storage_path) {
        throw new Error('Este documento foi removido pela política de retenção.')
      }
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(doc.storage_path, 60, { download: doc.nome_arquivo })
      erro('Falha ao gerar o link de download', error)
      return data!.signedUrl
    },
  })
}

export function useEnviarDocumento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { arquivo: File; entregaId: string | null; acessoId: string }) => {
      // 1. Confere o conteúdo real antes de subir. `file.type` vem da extensão
      //    e não prova nada.
      const validacao = await validarArquivo(p.arquivo)
      if (!validacao.ok) throw new Error(validacao.erro)

      const { data: sessao } = await supabase.auth.getSession()
      const meta = (sessao.session?.user.app_metadata ?? {}) as Record<string, unknown>
      const tenantId = meta.tenant_id
      const empresaId = meta.empresa_id
      if (typeof tenantId !== 'string' || typeof empresaId !== 'string') {
        throw new Error('Sessão sem empresa. Entre novamente.')
      }

      // 2. Caminho <tenant>/<empresa>/<uuid>-<nome>: é dele que as policies do
      //    storage derivam o isolamento.
      const caminho = `${tenantId}/${empresaId}/${crypto.randomUUID()}-${nomeSeguro(p.arquivo.name)}`

      const { error: erroUpload } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, p.arquivo, {
          contentType: validacao.mime,
          upsert: false,
        })
      erro('Falha ao enviar o arquivo', erroUpload)

      // 3. Registra o metadado. Se falhar, remove o objeto para não deixar
      //    arquivo órfão no bucket sem dono nem retenção.
      const { error: erroRegistro } = await supabase.from('documento').insert({
        tenant_id: tenantId,
        empresa_id: empresaId,
        entrega_id: p.entregaId,
        storage_path: caminho,
        nome_arquivo: p.arquivo.name.slice(0, 255),
        mime: validacao.mime,
        bytes: p.arquivo.size,
        origem: 'PORTAL_CLIENTE',
        enviado_por_portal: p.acessoId,
      })

      if (erroRegistro) {
        await supabase.storage.from(BUCKET).remove([caminho]).catch(() => {})
        throw new Error(`Falha ao registrar o documento: ${erroRegistro.message}`)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal', 'documentos'] })
      qc.invalidateQueries({ queryKey: ['portal', 'obrigacoes'] })
      qc.invalidateQueries({ queryKey: ['portal', 'resumo'] })
    },
  })
}
