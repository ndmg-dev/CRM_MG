
/**
 * Reusable glassmorphism container card.
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 * @param {boolean} [props.hoverable=false]
 * @param {boolean} [props.goldAccent=false]
 * @param {function} [props.onClick]
 * @param {object} [props.style]
 */
export default function GlassCard({
  children,
  className = '',
  hoverable = false,
  goldAccent = false,
  onClick,
  style,
}) {
  const classes = [
    'glass-card',
    hoverable && 'hoverable',
    goldAccent && 'gold-accent',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={onClick} style={style}>
      {children}
    </div>
  );
}
