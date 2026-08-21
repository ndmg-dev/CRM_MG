interface Props {
  name: string
  size?: number
}

export default function Avatar({ name, size = 32 }: Props) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.375 }}>
      {initials}
    </div>
  )
}
