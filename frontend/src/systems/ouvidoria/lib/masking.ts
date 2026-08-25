// Port literal (mesmos 2 padrões regex, só traduzidos de Python `re` pra JS
// `RegExp`) de `mask_personal_names()` em
// app/services/ouvidoria_service.py do repo original. Aplicado no client
// ANTES de inserir a description no Supabase quando "is_confidential" está
// marcado — mesma heurística, mesmo momento (só que aqui em vez de no
// backend Flask, já que agora quem grava a manifestação é o próprio
// navegador via RLS).
const MASKING_PATTERNS: [RegExp, string][] = [
  // "meu nome é João" / "me chamo Maria" / "sou o Pedro" / "sou a Ana"
  [/(meu nome [eé]\s+|me chamo\s+|sou o\s+|sou a\s+)(\w+)/gi, '$1[nome omitido]'],
  // Nome próprio depois de palavra-gatilho (gerente/supervisor/diretor/colega/funcionário)
  [
    /(gerente|supervisor|diretor|colega|funcionário|funcionaria)\s+(\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+\b)/gi,
    '$1 [nome omitido]',
  ],
]

export function maskPersonalNames(text: string): string {
  return MASKING_PATTERNS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text)
}
