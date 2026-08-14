/** Classes de campo de formulário. Fica fora de Campo.tsx porque um módulo
 *  que exporta componentes não deve exportar também utilitários — isso quebra
 *  o Fast Refresh do Vite (regra react-refresh/only-export-components). */

const BASE_INPUT =
  'w-full rounded-lg border bg-card px-3 py-2 text-sm text-text-primary ' +
  'placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-gold-border'

export function classesInput(erro?: string): string {
  return `${BASE_INPUT} ${erro ? 'border-error' : 'border-border focus:border-gold'}`
}
