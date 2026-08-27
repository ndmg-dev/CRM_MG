
/**
 * Premium loading spinner with gold accent.
 * @param {object} props
 * @param {string} [props.size='md'] — 'sm' | 'md' | 'lg'
 * @param {string} [props.text] — optional loading text
 */
export default function Loader({ size = 'md', text }) {
  return (
    <div className={`loader loader--${size}`} role="status" aria-label="Carregando">
      <div className="loader__spinner">
        <div className="loader__ring" />
      </div>
      {text && <p className="loader__text">{text}</p>}
    </div>
  );
}
