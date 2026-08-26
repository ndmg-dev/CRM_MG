import { forwardRef, useState, useCallback } from 'react'
import type { InputHTMLAttributes } from 'react'
import { formatCnpj } from '../utils/cnpj'

interface CnpjInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string
  onChange?: (value: string) => void
  error?: string
}

const CnpjInput = forwardRef<HTMLInputElement, CnpjInputProps>(function CnpjInput(
  { value = '', onChange, error, className = '', ...rest },
  ref,
) {
  const [touched, setTouched] = useState(false)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, '').slice(0, 14)
      const formatted = formatCnpj(raw)
      onChange?.(formatted)
    },
    [onChange],
  )

  const handleBlur = useCallback(() => {
    setTouched(true)
  }, [])

  const showError = touched && error
  const inputClass = ['cnpj-input', showError ? 'cnpj-input--error' : '', className].filter(Boolean).join(' ')

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      className={inputClass}
      placeholder="00.000.000/0000-00"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      maxLength={18}
      autoComplete="off"
      aria-label="CNPJ"
      aria-invalid={showError ? 'true' : 'false'}
      {...rest}
    />
  )
})

export default CnpjInput
