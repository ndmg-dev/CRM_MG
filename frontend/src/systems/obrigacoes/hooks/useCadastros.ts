import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../integrations/supabase/client'
import { somenteDigitos } from '../lib/validacao'
import type { DadosEmpresa, DadosObrigacao } from '../lib/validacao'

/**
 * Mutações de cadastro.
 *
 * Nenhuma envia `tenant_id`: ele tem DEFAULT nenhum no schema, então é
 * preenchido pela policy? Não — é preenchido aqui a partir da sessão lida do
 * JWT (ver `tenantDaSessao`), e o `with check` do RLS recusa qualquer valor
 * diferente do tenant do token. Mandar outro tenant simplesmente falha.
 */

function erro(msg: string, e: { message: string } | null): void {
  if (e) throw new Error(`${msg}: ${e.message}`)
}

async function tenantDaSessao(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const tenant = (data.session?.user.app_metadata as Record<string, unknown> | undefined)?.tenant_id
  if (typeof tenant !== 'string') {
    throw new Error('Sessão sem tenant. Recarregue a página e entre novamente.')
  }
  return tenant
}

/** Colaboradores ativos, para o seletor de responsável. */
export function useColaboradores() {
  return useQuery({
    queryKey: ['obrigacoes', 'colaboradores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuario')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome')
      erro('Falha ao carregar colaboradores', error)
      return (data ?? []) as { id: string; nome: string }[]
    },
  })
}

// ---------------------------------------------------------------- empresa

function payloadEmpresa(d: DadosEmpresa) {
  return {
    razao_social: d.razao_social.trim(),
    nome_fantasia: d.nome_fantasia.trim() || null,
    // O trigger do banco também limpa, mas mandar já normalizado evita
    // depender da ordem de execução para o CHECK de dígitos passar.
    cnpj: somenteDigitos(d.cnpj),
    regime: d.regime,
    uf: d.uf ? d.uf.toUpperCase() : null,
    codigo_municipio: d.codigo_municipio.trim() || null,
    responsavel_id: d.responsavel_id || null,
  }
}

export function useCriarEmpresa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: DadosEmpresa) => {
      const tenant_id = await tenantDaSessao()
      const { error } = await supabase.from('empresa').insert({ ...payloadEmpresa(d), tenant_id })
      erro('Falha ao cadastrar empresa', error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obrigacoes', 'empresas'] }),
  })
}

export function useAtualizarEmpresa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: DadosEmpresa }) => {
      const { error } = await supabase.from('empresa').update(payloadEmpresa(dados)).eq('id', id)
      erro('Falha ao atualizar empresa', error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obrigacoes', 'empresas'] }),
  })
}

/**
 * Empresa não é deletada — é desativada. Ela tem entregas e parametrizações
 * penduradas, e o histórico de uma competência precisa continuar explicável.
 */
export function useDesativarEmpresa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('empresa').update({ ativa: false }).eq('id', id)
      erro('Falha ao desativar empresa', error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obrigacoes', 'empresas'] }),
  })
}

export function useEmpresa(id: string | null) {
  return useQuery({
    queryKey: ['obrigacoes', 'empresa', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresa')
        .select('id, razao_social, nome_fantasia, cnpj, regime, uf, codigo_municipio, responsavel_id, ativa')
        .eq('id', id as string)
        .single()
      erro('Falha ao carregar empresa', error)
      return data
    },
  })
}

// -------------------------------------------------------------- obrigação

export function useCriarObrigacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: DadosObrigacao) => {
      const tenant_id = await tenantDaSessao()

      const { data: criada, error: erroObrigacao } = await supabase
        .from('obrigacao')
        .insert({
          tenant_id,
          codigo: d.codigo.trim().toUpperCase(),
          nome: d.nome.trim(),
          descricao: d.descricao.trim() || null,
          departamento: d.departamento,
          esfera: d.esfera,
          periodicidade: d.periodicidade,
          uf: d.esfera === 'ESTADUAL' ? d.uf.toUpperCase() : null,
          codigo_municipio: d.esfera === 'MUNICIPAL' ? d.codigo_municipio.trim() : null,
        })
        .select('id')
        .single()
      erro('Falha ao cadastrar obrigação', erroObrigacao)

      // Obrigação sem regra de prazo nunca gera entrega: o job pula quem não
      // tem regra vigente. Por isso a primeira versão nasce junto do cadastro.
      const { error: erroPrazo } = await supabase.from('obrigacao_prazo').insert({
        tenant_id,
        obrigacao_id: criada!.id,
        tipo_dia: d.tipo_dia,
        dia_base: Number(d.dia_base),
        referencia: d.referencia,
        ajuste: d.ajuste,
        sabado_e_util: d.sabado_e_util,
        vigencia_inicio: d.vigencia_inicio,
      })
      erro('Obrigação criada, mas a regra de prazo falhou', erroPrazo)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obrigacoes', 'catalogo'] }),
  })
}

export function useAtualizarObrigacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: DadosObrigacao }) => {
      const { error } = await supabase
        .from('obrigacao')
        .update({
          nome: dados.nome.trim(),
          descricao: dados.descricao.trim() || null,
          periodicidade: dados.periodicidade,
        })
        .eq('id', id)
      erro('Falha ao atualizar obrigação', error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obrigacoes', 'catalogo'] }),
  })
}

export function usePrazos(obrigacaoId: string | null) {
  return useQuery({
    queryKey: ['obrigacoes', 'prazos', obrigacaoId],
    enabled: Boolean(obrigacaoId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('obrigacao_prazo')
        .select('id, tipo_dia, dia_base, referencia, ajuste, sabado_e_util, vigencia_inicio, vigencia_fim, observacao')
        .eq('obrigacao_id', obrigacaoId as string)
        .order('vigencia_inicio', { ascending: false })
      erro('Falha ao carregar regras de prazo', error)
      return data ?? []
    },
  })
}

/**
 * Nova VERSÃO da regra de prazo — nunca edição da anterior.
 *
 * Encerra a vigente no dia anterior ao início da nova e insere a nova. É o que
 * faz o reprocessamento de uma competência antiga devolver o prazo histórico
 * correto em vez do prazo de hoje. O banco reforça: `obrigacao_prazo` não tem
 * policy de DELETE e o UPDATE só aceita preencher `vigencia_fim`.
 */
export function useNovaVersaoPrazo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      obrigacaoId: string
      vigenteId: string | null
      tipo_dia: string
      dia_base: number
      referencia: string
      ajuste: string
      sabado_e_util: boolean
      vigencia_inicio: string
      observacao?: string
    }) => {
      const tenant_id = await tenantDaSessao()

      if (v.vigenteId) {
        const inicio = new Date(`${v.vigencia_inicio}T00:00:00Z`)
        inicio.setUTCDate(inicio.getUTCDate() - 1)
        const fim = inicio.toISOString().slice(0, 10)

        const { error } = await supabase
          .from('obrigacao_prazo')
          .update({ vigencia_fim: fim })
          .eq('id', v.vigenteId)
        erro('Falha ao encerrar a regra anterior', error)
      }

      const { error } = await supabase.from('obrigacao_prazo').insert({
        tenant_id,
        obrigacao_id: v.obrigacaoId,
        tipo_dia: v.tipo_dia,
        dia_base: v.dia_base,
        referencia: v.referencia,
        ajuste: v.ajuste,
        sabado_e_util: v.sabado_e_util,
        vigencia_inicio: v.vigencia_inicio,
        observacao: v.observacao || null,
      })
      erro('Falha ao criar a nova versão da regra', error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obrigacoes', 'prazos'] }),
  })
}
