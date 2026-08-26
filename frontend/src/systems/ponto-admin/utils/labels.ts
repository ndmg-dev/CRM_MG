export const TYPE_LABELS: Record<string, string> = {
  ENTRADA: 'Entrada', SAIDA_ALMOCO: 'S. Almoço', RETORNO_ALMOCO: 'R. Almoço', SAIDA: 'Saída',
  SAIDA_INTERVALO: 'S. Intervalo', RETORNO_INTERVALO: 'R. Intervalo',
}

export const STATUS_LABELS: Record<string, string> = {
  VERIFICADO: 'Verificado', FORA_DO_LOCAL: 'Fora do local', MANUAL: 'Manual',
  PENDENTE: 'Pendente', JUSTIFICADO: 'Justificado', WIFI_DESCONHECIDO: 'Wi-Fi desconhecido',
}

export const OCCURRENCE_TYPE_LABELS: Record<string, string> = {
  FALTA_INTEGRAL:   'Falta integral (dia todo)',
  FALTA_PARCIAL:    'Falta parcial (com horário)',
  ATRASO:           'Atraso',
  SAIDA_ANTECIPADA: 'Saída antecipada',
  ABONO:            'Abono',
  LOCAL_EXTERNO:    'Ponto fora do local (home office, cliente etc.)',
}

export const JUSTIFICATION_STATUS_LABELS: Record<string, string> = {
  PENDENTE: 'Pendente', APROVADO: 'Aprovado', REPROVADO: 'Recusado',
}
