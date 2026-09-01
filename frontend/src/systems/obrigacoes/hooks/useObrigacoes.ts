import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../integrations/supabase/client'
import { lerSessao } from '../lib/sessao'
import type {
  CargaResponsavel, DiaAgenda, EmpresaSituacao, EntregaLinha, ItemRevisao,
  Obrigacao, PainelResumo, ProximoVencimento, SessaoObrigacoes,
  StatusEntrega, VinculoParametrizacao,
} from '../types'

/**
 * Camada de dados do módulo.
 *
 * Nenhuma destas funções envia tenant_id ou empresa_id: o RLS os deriva do
 * JWT. Mandar do cliente seria oferecer ao usuário um parâmetro para trocar
 * de empresa — exatamente o que o desenho de dois perímetros evita.
 */

function erro(msg: string, e: { message: string } | null): void {
  if (e) throw new Error(`${msg}: ${e.message}`)
}

export function useSessao() {
  return useQuery<SessaoObrigacoes | null>({
    queryKey: ['obrigacoes', 'sessao'],
    queryFn: lerSessao,
    staleTime: 5 * 60 * 1000,
  })
}

// ------------------------------------------------------------------ painel

export function usePainelResumo(competencia: string) {
  return useQuery<PainelResumo>({
    queryKey: ['obrigacoes', 'painel', 'resumo', competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('painel_resumo', { p_competencia: competencia })
        .single()
      erro('Falha ao carregar indicadores', error)
      return data as PainelResumo
    },
  })
}

export function useCargaResponsavel(competencia: string) {
  return useQuery<CargaResponsavel[]>({
    queryKey: ['obrigacoes', 'painel', 'carga', competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('painel_carga_responsavel', { p_competencia: competencia })
      erro('Falha ao carregar carga por responsável', error)
      return (data ?? []) as CargaResponsavel[]
    },
  })
}

export function useProximosVencimentos(limite = 8) {
  return useQuery<ProximoVencimento[]>({
    queryKey: ['obrigacoes', 'painel', 'proximos', limite],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('painel_proximos_vencimentos', { p_limite: limite })
      erro('Falha ao carregar próximos vencimentos', error)
      return (data ?? []) as ProximoVencimento[]
    },
  })
}

// ---------------------------------------------------------------- entregas

export interface FiltroEntregas {
  competencia: string
  busca?: string
  departamento?: string
  status?: string
  pagina?: number
  porPagina?: number
}

/** A tabela de entregas cresce a cada competência: sempre paginada. */
export function useEntregas(filtro: FiltroEntregas) {
  const porPagina = filtro.porPagina ?? 50
  const pagina = filtro.pagina ?? 0

  return useQuery({
    queryKey: ['obrigacoes', 'entregas', filtro],
    queryFn: async () => {
      // Departamento com `!inner`: sem isso o filtro rodava só depois da
      // paginação (dentro da página de 50 já reduzida pelo servidor), então
      // `total`/`count` continuava contando a competência inteira e "próxima
      // página" pulava direto pras próximas 50 linhas cruas — filtrar um
      // departamento pequeno podia parecer "acabou" com resultado sobrando
      // em páginas seguintes. PostgREST filtra coluna de relação embutida
      // desde que a relação seja marcada `!inner` na própria string do select.
      let q = supabase
        .from('entrega')
        .select(
          `id, competencia, vencimento, status, origem_baixa, anexo_nome,
           empresa:empresa_id ( id, razao_social, nome_fantasia, cnpj ),
           obrigacao:obrigacao_id${filtro.departamento ? '!inner' : ''} ( id, codigo, nome, departamento ),
           responsavel:responsavel_id ( id, nome )`,
          { count: 'exact' },
        )
        .eq('competencia', filtro.competencia)
        .order('vencimento', { ascending: true })
        .range(pagina * porPagina, pagina * porPagina + porPagina - 1)

      if (filtro.status) q = q.eq('status', filtro.status)
      if (filtro.departamento) q = q.eq('obrigacao.departamento', filtro.departamento)

      const { data, error, count } = await q
      erro('Falha ao carregar entregas', error)

      let linhas = (data ?? []) as unknown as EntregaLinha[]

      // Busca livre continua recortada no client, sobre a página já reduzida
      // pelo servidor: atravessa nome/CNPJ/código em 3 relações diferentes,
      // o que exigiria um `.or()` bem mais complexo pra fazer no PostgREST.
      // O total mostrado na paginação reflete competência+status+departamento,
      // não a busca livre — resultado de texto pode parecer incompleto numa
      // competência com muitas linhas; filtrar por departamento primeiro
      // reduz esse efeito.
      if (filtro.busca?.trim()) {
        const termo = filtro.busca.trim().toLowerCase()
        linhas = linhas.filter((l) =>
          [
            l.empresa?.razao_social, l.empresa?.nome_fantasia, l.empresa?.cnpj,
            l.obrigacao?.nome, l.obrigacao?.codigo,
          ]
            .filter(Boolean)
            .some((campo) => String(campo).toLowerCase().includes(termo)),
        )
      }

      return { linhas, total: count ?? linhas.length }
    },
  })
}

/**
 * Baixa manual. Não recebe `origem_baixa` da tela: quem registra pela
 * interface é sempre MANUAL — AUTOMATICA_RECIBO é privilégio do worker que
 * processou um recibo de verdade.
 */
export function useRegistrarEntrega() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entregaId: string) => {
      const { error } = await supabase
        .from('entrega')
        .update({
          status: 'ENTREGUE' as StatusEntrega,
          entregue_em: new Date().toISOString(),
          origem_baixa: 'MANUAL',
        })
        .eq('id', entregaId)
      erro('Falha ao registrar entrega', error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obrigacoes', 'entregas'] })
      qc.invalidateQueries({ queryKey: ['obrigacoes', 'painel'] })
    },
  })
}

export function useAlterarStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusEntrega }) => {
      const { error } = await supabase.from('entrega').update({ status }).eq('id', id)
      erro('Falha ao alterar situação', error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obrigacoes', 'entregas'] })
      qc.invalidateQueries({ queryKey: ['obrigacoes', 'painel'] })
    },
  })
}

// ---------------------------------------------------------------- empresas

export function useEmpresas(competencia: string) {
  return useQuery<EmpresaSituacao[]>({
    queryKey: ['obrigacoes', 'empresas', competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('empresas_com_situacao', { p_competencia: competencia })
      erro('Falha ao carregar empresas', error)
      return (data ?? []) as EmpresaSituacao[]
    },
  })
}

// --------------------------------------------------------------- catálogo

export function useCatalogo() {
  return useQuery<Obrigacao[]>({
    queryKey: ['obrigacoes', 'catalogo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('obrigacao')
        .select('id, codigo, nome, descricao, departamento, esfera, periodicidade, uf, ativa')
        .order('departamento')
        .order('codigo')
      erro('Falha ao carregar catálogo', error)
      return (data ?? []) as Obrigacao[]
    },
  })
}

// --------------------------------------------------------- parametrização

export function useParametrizacao(empresaId: string | null) {
  return useQuery<VinculoParametrizacao[]>({
    queryKey: ['obrigacoes', 'parametrizacao', empresaId],
    enabled: Boolean(empresaId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresa_obrigacao')
        .select(
          `id, empresa_id, obrigacao_id, origem, origem_ref, inicio, fim, ativa,
           obrigacao:obrigacao_id ( codigo, nome, departamento ),
           responsavel:responsavel_id ( id, nome )`,
        )
        .eq('empresa_id', empresaId as string)
        .order('ativa', { ascending: false })
      erro('Falha ao carregar parametrização', error)
      return (data ?? []) as unknown as VinculoParametrizacao[]
    },
  })
}

/**
 * Encerrar, nunca deletar: `ativa=false` + `fim=data`. O histórico de por que
 * uma obrigação existiu numa competência é auditável — e o banco nem tem
 * policy de DELETE nesta tabela, então deletar falharia de qualquer forma.
 */
export function useEncerrarVinculo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, fim }: { id: string; fim: string }) => {
      const { error } = await supabase
        .from('empresa_obrigacao')
        .update({ ativa: false, fim })
        .eq('id', id)
      erro('Falha ao encerrar vínculo', error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obrigacoes', 'parametrizacao'] }),
  })
}

export function useVincularObrigacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      empresaId: string
      obrigacaoId: string
      inicio: string
      responsavelId?: string | null
    }) => {
      // Vínculo criado pela tela é sempre MANUAL: REGIME e GRUPO são gerados
      // por rotina, e marcar manual como REGIME faria a próxima aplicação de
      // regime tributário sobrescrever a escolha de um humano.
      const { error } = await supabase.from('empresa_obrigacao').insert({
        empresa_id: v.empresaId,
        obrigacao_id: v.obrigacaoId,
        origem: 'MANUAL',
        inicio: v.inicio,
        responsavel_id: v.responsavelId ?? null,
      })
      erro('Falha ao vincular obrigação', error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obrigacoes', 'parametrizacao'] }),
  })
}

// ------------------------------------------------------------------ agenda

export function useAgenda(ano: number, mes: number) {
  return useQuery<DiaAgenda[]>({
    queryKey: ['obrigacoes', 'agenda', ano, mes],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('agenda_mes', { p_ano: ano, p_mes: mes })
      erro('Falha ao carregar agenda', error)
      return (data ?? []) as DiaAgenda[]
    },
  })
}

// ----------------------------------------------------------------- revisão

export function useFilaRevisao() {
  return useQuery<ItemRevisao[]>({
    queryKey: ['obrigacoes', 'revisao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recibo_revisao')
        .select(`id, hash_arquivo, storage_path, motivo, cnpj_lido,
                 codigo_obrigacao_lido, competencia_lida, status, criado_em`)
        .eq('status', 'ABERTO')
        .order('criado_em', { ascending: true })
      erro('Falha ao carregar fila de revisão', error)
      return (data ?? []) as ItemRevisao[]
    },
  })
}

export function useDescartarRecibo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recibo_revisao')
        .update({ status: 'DESCARTADO', resolvido_em: new Date().toISOString() })
        .eq('id', id)
      erro('Falha ao descartar recibo', error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obrigacoes', 'revisao'] }),
  })
}

export interface CandidataRevisao {
  entrega_id: string
  empresa: string
  obrigacao: string
  competencia: string
  vencimento: string
  status: StatusEntrega
}

/** Entregas em aberto da empresa cujo CNPJ o parser leu. */
export function useCandidatasRevisao(itemId: string | null) {
  return useQuery<CandidataRevisao[]>({
    queryKey: ['obrigacoes', 'revisao', 'candidatas', itemId],
    enabled: Boolean(itemId),
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('candidatas_para_revisao', { p_item_id: itemId })
      erro('Falha ao buscar entregas candidatas', error)
      return (data ?? []) as CandidataRevisao[]
    },
  })
}

/**
 * Vincula o recibo à entrega que o humano confirmou.
 *
 * Uma RPC, não três chamadas: baixar a entrega, anexar o documento e fechar o
 * item precisam ser tudo ou nada. Em passos separados, uma falha no meio
 * deixaria item fechado sem baixa — ou baixa sem item fechado.
 */
export function useResolverRevisao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, entregaId }: { itemId: string; entregaId: string }) => {
      const { error } = await supabase.rpc('resolver_revisao', {
        p_item_id: itemId,
        p_entrega_id: entregaId,
      })
      erro('Falha ao resolver a revisão', error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obrigacoes', 'revisao'] })
      qc.invalidateQueries({ queryKey: ['obrigacoes', 'entregas'] })
      qc.invalidateQueries({ queryKey: ['obrigacoes', 'painel'] })
    },
  })
}
