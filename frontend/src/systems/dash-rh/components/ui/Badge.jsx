
/**
 * Status badge component.
 * @param {object} props
 * @param {'positive'|'negative'|'warning'|'info'|'gold'|'neutral'} [props.variant='neutral']
 * @param {React.ReactNode} props.children
 */
export default function Badge({ variant = 'neutral', children, className = '' }) {
  return (
    <span className={`badge badge--${variant} ${className}`}>
      {children}
    </span>
  );
}
