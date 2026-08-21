interface Props {
  children: React.ReactNode
  variant?: 'ok' | 'warn' | 'err' | 'neutral'
}

export default function Badge({ children, variant = 'neutral' }: Props) {
  return <span className={`badge badge-${variant}`}>{children}</span>
}
