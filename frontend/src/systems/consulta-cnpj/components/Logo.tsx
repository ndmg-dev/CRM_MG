const sizeMap = {
  sm: { width: 120, height: 60 },
  md: { width: 200, height: 100 },
  lg: { width: 280, height: 140 },
}

interface LogoProps {
  size?: keyof typeof sizeMap
  className?: string
}

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  const { width, height } = sizeMap[size] || sizeMap.md

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 280 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Mendonça Galvão Contadores Associados"
    >
      <path d="M40 100C40 100 70 25 140 25C210 25 240 100 240 100" stroke="#B89B64" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M60 100C60 100 85 40 140 40C195 40 220 100 220 100" stroke="#B89B64" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.65" />
      <path d="M80 100C80 100 100 55 140 55C180 55 200 100 200 100" stroke="#B89B64" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.35" />
      <circle cx="140" cy="20" r="3" fill="#B89B64" opacity="0.8" />
      <text x="140" y="115" textAnchor="middle" fill="#FBFBFB" fontFamily="Inter, sans-serif" fontSize="16" fontWeight="600" letterSpacing="4">
        MENDONÇA GALVÃO
      </text>
      <text x="140" y="132" textAnchor="middle" fill="#9E9FA1" fontFamily="Inter, sans-serif" fontSize="8" fontWeight="400" letterSpacing="3">
        CONTADORES ASSOCIADOS
      </text>
    </svg>
  )
}
