export function formatCnpj(value: string): string {
  const digits = (value || '').replace(/\D/g, '').slice(0, 14)
  const len = digits.length

  if (len <= 2) return digits
  if (len <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (len <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (len <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

export function cleanCnpj(value: string): string {
  return (value || '').replace(/\D/g, '')
}

export function validateCnpj(value: string): boolean {
  const digits = cleanCnpj(value)

  if (digits.length !== 14) return false
  if (/^(\d)\1{13}$/.test(digits)) return false

  const numbers = digits.split('').map(Number)

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let sum1 = 0
  for (let i = 0; i < 12; i++) {
    sum1 += numbers[i] * weights1[i]
  }
  const remainder1 = sum1 % 11
  const check1 = remainder1 < 2 ? 0 : 11 - remainder1

  if (numbers[12] !== check1) return false

  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let sum2 = 0
  for (let i = 0; i < 13; i++) {
    sum2 += numbers[i] * weights2[i]
  }
  const remainder2 = sum2 % 11
  const check2 = remainder2 < 2 ? 0 : 11 - remainder2

  if (numbers[13] !== check2) return false

  return true
}

export function isCnpj(value: string): boolean {
  const digits = cleanCnpj(value)
  return digits.length === 14
}
